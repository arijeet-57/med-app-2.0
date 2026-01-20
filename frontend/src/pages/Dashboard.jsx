import { useEffect, useState, useRef } from "react";
import { db } from "../firebase";
import axios from "axios";
import { collection, getDocs, addDoc, query, deleteDoc, doc, updateDoc, orderBy, onSnapshot } from "firebase/firestore";

export default function Dashboard() {
  const [medicines, setMedicines] = useState([]);
  const [ocrResult, setOcrResult] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const [debugInfo, setDebugInfo] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showBanner, setShowBanner] = useState(false);
  const [bannerNotification, setBannerNotification] = useState(null);
  const [listenerActive, setListenerActive] = useState(false);

  const audioRef = useRef(null);
  const userId = "user-1";
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    console.log("🚀 Dashboard mounted, setting up listeners...");
    fetchMeds();

    const handleFocus = () => {
      console.log("Window focused - refreshing medicines...");
      fetchMeds();
    };

    window.addEventListener("focus", handleFocus);

    // NOTIFICATION LISTENER
    const notifRef = collection(db, `users/${userId}/notifications`);
    const qNotif = query(notifRef, orderBy("createdAt", "desc"));

    console.log("📡 Setting up notification listener for:", `users/${userId}/notifications`);

    const unsub = onSnapshot(qNotif, 
      (snap) => {
        console.log("🔔 Snapshot received! Documents:", snap.docs.length);
        
        const notifs = snap.docs.map(d => {
          const data = { id: d.id, ...d.data() };
          console.log("   Notification:", data);
          return data;
        });
        
        setListenerActive(true);
        setNotifications(prevNotifs => {
          const prevUnread = prevNotifs.filter(n => !n.read).length;
          const newUnread = notifs.filter(n => !n.read).length;

          console.log(`   Unread count: ${prevUnread} → ${newUnread}`);

          if (newUnread > prevUnread && newUnread > 0) {
            const latestUnread = notifs.find(n => !n.read);
            if (latestUnread) {
              console.log("   🎵 Playing sound for new notification");
              setBannerNotification(latestUnread);
              setShowBanner(true);
              
              if (audioRef.current) {
                audioRef.current.play().catch(e => console.log("Audio play failed:", e));
              }
            }
          }

          if (newUnread === 0 && audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setShowBanner(false);
          }

          setUnreadCount(newUnread);
          return notifs;
        });
      },
      (error) => {
        console.error("❌ Snapshot error:", error);
        setDebugInfo(`Listener error: ${error.message}`);
      }
    );

    return () => {
      console.log("🛑 Cleaning up listeners...");
      window.removeEventListener("focus", handleFocus);
      unsub();
    };
  }, []);

  async function fetchMeds() {
    try {
      setLoading(true);
      setDebugInfo("Loading medicines for next 7 days...");

      const medsRef = collection(db, `users/${userId}/medicines`);
      const snap = await getDocs(medsRef);

      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);

      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(med => {
          const medDate = new Date(med.date);
          medDate.setHours(0, 0, 0, 0);
          const diffDays = (medDate - todayDate) / (1000 * 60 * 60 * 24);
          return diffDays >= 0 && diffDays <= 7;
        });

      list.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

      setMedicines(list);
      setDebugInfo(`✅ Loaded ${list.length} medicines`);

    } catch (error) {
      console.error("❌ Error fetching medicines:", error);
      setMessage("❌ Failed to load medicines");
    } finally {
      setLoading(false);
    }
  }

  const uploadPhoto = async (event, med) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage("❌ Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("❌ Image must be less than 5MB");
      return;
    }

    setUploadingId(med.id);
    setMessage("🔄 Processing image...");

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await axios.post(
        "http://localhost:5000/api/ocr/upload",
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000
        }
      );

      const extracted = res.data.text.toLowerCase().trim();
      setOcrResult(extracted);

      const dosageParts = med.dosage.toLowerCase().split(" ");
      const dosageNumber = dosageParts[0];
      const dosageUnit = dosageParts.slice(1).join(" ");

      const components = [
        med.name.toLowerCase(),
        dosageNumber,
        dosageUnit || "mg"
      ];

      let matchCount = 0;
      const matchedItems = [];

      components.forEach(item => {
        if (item && extracted.includes(item)) {
          matchCount++;
          matchedItems.push(item);
        }
      });

      if (matchCount >= 3) {
        setMessage(`✅ OK — matched ${matchCount}/3 components`);
      } else {
        setMessage(`❌ Not OK — only matched ${matchCount}/3 components`);
      }

    } catch (error) {
      console.error("OCR error:", error);
      setMessage("❌ Upload failed");
    } finally {
      setUploadingId(null);
      event.target.value = '';
    }
  };

  const markTaken = async (medId, medName) => {
    try {
      await addDoc(collection(db, `users/${userId}/logs`), {
        date: today,
        medicineId: medId,
        medicineName: medName,
        status: "taken",
        timestamp: new Date()
      });

      await updateDoc(doc(db, `users/${userId}/medicines`, medId), {
        status: "taken",
        takenAt: new Date()
      });

      setMessage(`✅ ${medName} marked as taken`);
      
      setMedicines(prev => 
        prev.map(m => m.id === medId ? { ...m, taken: true, status: "taken" } : m)
      );
    } catch (error) {
      console.error("❌ Error logging medicine:", error);
      setMessage("❌ Failed to log medicine");
    }
  };

  const deleteMedicine = async (medId, medName) => {
    const ok = window.confirm(`Are you sure you want to delete ${medName}?`);
    if (!ok) return;

    try {
      await deleteDoc(doc(db, `users/${userId}/medicines`, medId));
      setMedicines(prev => prev.filter(m => m.id !== medId));
      setMessage(`🗑️ Deleted ${medName}`);
    } catch (err) {
      console.error("Delete failed:", err);
      setMessage("❌ Failed to delete medicine");
    }
  };

  const markNotificationAsRead = async (notifId) => {
    try {
      await updateDoc(doc(db, `users/${userId}/notifications`, notifId), {
        read: true,
        readAt: new Date()
      });
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const dismissBanner = async () => {
    if (bannerNotification) {
      await markNotificationAsRead(bannerNotification.id);
    }
    setShowBanner(false);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const clearAllNotifications = async () => {
    const ok = window.confirm("Clear all notifications?");
    if (!ok) return;

    try {
      const batch = notifications.map(n => 
        deleteDoc(doc(db, `users/${userId}/notifications`, n.id))
      );
      await Promise.all(batch);
      console.log("✅ All notifications cleared");
    } catch (err) {
      console.error("Failed to clear notifications:", err);
    }
  };

  const testServerConnection = async () => {
    try {
      setDebugInfo("Testing server connection...");
      const res = await axios.get("http://localhost:5000/api/health");
      console.log("Server health:", res.data);
      setDebugInfo(`✅ Server OK: ${JSON.stringify(res.data)}`);
    } catch (err) {
      console.error("Server connection failed:", err);
      setDebugInfo(`❌ Server connection failed: ${err.message}`);
    }
  };

  const testNotification = async () => {
    try {
      setDebugInfo("🧪 Sending test notification...");
      console.log("Creating test notification via API...");
      
      const res = await axios.post("http://localhost:5000/api/test-notification", {
        userId: userId,
        message: `Test notification at ${new Date().toLocaleTimeString()}`,
        type: "reminder"
      });

      console.log("Test notification response:", res.data);
      setDebugInfo(`✅ Test notification created: ${res.data.notificationId}`);
      setMessage("🧪 Test notification sent! Check the bell icon.");
    } catch (err) {
      console.error("Test notification failed:", err);
      setDebugInfo(`❌ Failed: ${err.message}`);
      setMessage("❌ Test notification failed");
    }
  };

  const checkNotifications = async () => {
    try {
      setDebugInfo("Checking notifications in Firestore...");
      const res = await axios.get(`http://localhost:5000/api/notifications/${userId}`);
      console.log("Notifications from API:", res.data);
      setDebugInfo(`Found ${res.data.count} notifications in database`);
    } catch (err) {
      console.error("Check failed:", err);
      setDebugInfo(`❌ Check failed: ${err.message}`);
    }
  };

  const getNotificationIcon = (type) => {
    switch(type) {
      case "reminder": return "⏰";
      case "late": return "⚠️";
      case "missed": return "❌";
      default: return "🔔";
    }
  };

  const getNotificationColor = (type) => {
    switch(type) {
      case "reminder": return "#e7f3ff";
      case "late": return "#fff3cd";
      case "missed": return "#f8d7da";
      default: return "#f8f9fa";
    }
  };

  const getBannerColor = (type) => {
    switch(type) {
      case "reminder": return { bg: "#0d6efd", border: "#0a58ca" };
      case "late": return { bg: "#ffc107", border: "#ffca2c" };
      case "missed": return { bg: "#dc3545", border: "#bb2d3b" };
      default: return { bg: "#6c757d", border: "#5c636a" };
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <audio 
        ref={audioRef} 
        src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" 
        preload="auto" 
        loop
      />

      {showBanner && bannerNotification && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            background: getBannerColor(bannerNotification.type).bg,
            color: "white",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 2000,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            borderBottom: `4px solid ${getBannerColor(bannerNotification.type).border}`
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
            <span style={{ fontSize: "32px" }}>
              {getNotificationIcon(bannerNotification.type)}
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "bold" }}>
                MEDICATION REMINDER
              </h2>
              <p style={{ margin: "4px 0 0 0", fontSize: "16px" }}>
                {bannerNotification.message}
              </p>
            </div>
          </div>
          
          <button
            onClick={dismissBanner}
            style={{
              padding: "10px 24px",
              background: "white",
              color: getBannerColor(bannerNotification.type).bg,
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "bold",
              marginLeft: "20px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
            }}
          >
            ✓ GOT IT
          </button>
        </div>
      )}

      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginTop: showBanner ? "80px" : "0"
      }}>
        <h1>Smart Medication Assistant</h1>
        
        <button
          onClick={() => setShowNotif(!showNotif)}
          style={{
            position: "relative",
            padding: "10px 15px",
            background: unreadCount > 0 ? "#dc3545" : "#6c757d",
            color: "white",
            border: "none",
            borderRadius: "50%",
            cursor: "pointer",
            fontSize: "20px",
            width: "50px",
            height: "50px"
          }}
        >
          🔔
          {unreadCount > 0 && (
            <span style={{
              position: "absolute",
              top: "-5px",
              right: "-5px",
              background: "#ff0000",
              color: "white",
              borderRadius: "50%",
              width: "24px",
              height: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: "bold"
            }}>
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {showNotif && (
        <>
          <div style={{
            position: "fixed",
            top: "80px",
            right: "20px",
            width: "360px",
            maxHeight: "500px",
            overflowY: "auto",
            background: "white",
            border: "1px solid #ddd",
            borderRadius: "8px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            padding: "16px",
            zIndex: 1000
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0 }}>Notifications ({notifications.length})</h3>
              {notifications.length > 0 && (
                <button
                  onClick={clearAllNotifications}
                  style={{
                    padding: "4px 8px",
                    background: "#dc3545",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px"
                  }}
                >
                  Clear All
                </button>
              )}
            </div>

            {notifications.length === 0 && (
              <p style={{ textAlign: "center", color: "#6c757d", padding: "20px" }}>
                No notifications yet.
              </p>
            )}

            {notifications.map(n => (
              <div
                key={n.id}
                style={{
                  padding: "12px",
                  marginBottom: "10px",
                  background: n.read ? "#f8f9fa" : getNotificationColor(n.type),
                  borderRadius: "6px",
                  border: `1px solid ${n.read ? "#dee2e6" : "#007bff"}`,
                  opacity: n.read ? 0.7 : 1
                }}
              >
                <div style={{ display: "flex", alignItems: "start", gap: "8px" }}>
                  <span style={{ fontSize: "20px" }}>
                    {getNotificationIcon(n.type)}
                  </span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 4px 0", fontWeight: n.read ? "normal" : "bold" }}>
                      {n.message}
                    </p>
                    <small style={{ color: "#6c757d" }}>
                      {n.createdAt?.seconds 
                        ? new Date(n.createdAt.seconds * 1000).toLocaleString()
                        : "Just now"}
                    </small>
                  </div>
                </div>

                {!n.read && (
                  <button
                    style={{
                      marginTop: "8px",
                      background: "#28a745",
                      color: "white",
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                      width: "100%"
                    }}
                    onClick={() => markNotificationAsRead(n.id)}
                  >
                    Mark as Read
                  </button>
                )}
              </div>
            ))}
          </div>

          <div
            onClick={() => setShowNotif(false)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "transparent",
              zIndex: 999
            }}
          />
        </>
      )}

      {debugInfo && (
        <div style={{
          background: "#e7f3ff",
          color: "#004085",
          padding: "12px",
          borderRadius: "4px",
          marginBottom: "16px",
          border: "1px solid #b8daff",
          fontSize: "12px",
          fontFamily: "monospace"
        }}>
          {debugInfo}
        </div>
      )}

      <div style={{ marginBottom: "16px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          onClick={testServerConnection}
          style={{
            padding: "8px 16px",
            background: "#6c757d",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px"
          }}
        >
          🔧 Test Server
        </button>

        <button
          onClick={testNotification}
          style={{
            padding: "8px 16px",
            background: "#ffc107",
            color: "black",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "bold"
          }}
        >
          🧪 Send Test Notification
        </button>

        <button
          onClick={checkNotifications}
          style={{
            padding: "8px 16px",
            background: "#17a2b8",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px"
          }}
        >
          📋 Check Notifications
        </button>

        <button
          onClick={fetchMeds}
          style={{
            padding: "8px 16px",
            background: "#28a745",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px"
          }}
        >
          🔄 Refresh Medicines
        </button>
      </div>

      <div style={{
        background: listenerActive ? "#d4edda" : "#f8d7da",
        color: listenerActive ? "#155724" : "#721c24",
        padding: "8px 12px",
        borderRadius: "4px",
        marginBottom: "16px",
        fontSize: "12px"
      }}>
        Listener Status: {listenerActive ? "✅ Active" : "❌ Not Active"} | 
        Total Notifications: {notifications.length} | 
        Unread: {unreadCount}
      </div>

      {message && (
        <div style={{ 
          background: message.includes("✅") ? "#d4edda" : "#f8d7da",
          color: message.includes("✅") ? "#155724" : "#721c24",
          padding: "12px",
          borderRadius: "4px",
          marginBottom: "16px"
        }}>
          {message}
        </div>
      )}

      {ocrResult && (
        <details style={{ 
          background: "#f8f9fa", 
          padding: "12px", 
          borderRadius: "4px",
          marginBottom: "16px",
          border: "1px solid #dee2e6"
        }}>
          <summary style={{ cursor: "pointer", fontWeight: "bold" }}>
            OCR Text Extracted
          </summary>
          <pre style={{ 
            marginTop: "8px", 
            whiteSpace: "pre-wrap",
            fontSize: "12px"
          }}>
            {ocrResult}
          </pre>
        </details>
      )}

      <h2>Upcoming Medicines (Next 7 Days)</h2>

      {loading && <p>Loading medicines...</p>}

      {!loading && medicines.length === 0 && (
        <div style={{ 
          textAlign: "center", 
          padding: "40px 20px",
          background: "#f8f9fa",
          borderRadius: "8px",
          border: "2px dashed #dee2e6"
        }}>
          <p style={{ color: "#6c757d", fontStyle: "italic", fontSize: "16px" }}>
            No medicines scheduled for the next 7 days.
          </p>
        </div>
      )}

      {medicines.map(med => (
        <div
          key={med.id}
          style={{ 
            border: "1px solid #dee2e6", 
            padding: "16px", 
            margin: "12px 0",
            borderRadius: "8px",
            background: med.status === "taken" ? "#f0f0f0" : "white",
            opacity: med.status === "taken" ? 0.7 : 1
          }}
        >
          <div style={{ marginBottom: "12px" }}>
            <h3 style={{ margin: "0 0 8px 0" }}>
              {med.name} {med.status === "taken" && "✓"}
            </h3>
            <p style={{ margin: "4px 0", color: "#495057" }}>
              <strong>Date:</strong> {med.date}
            </p>
            <p style={{ margin: "4px 0", color: "#495057" }}>
              <strong>Dosage:</strong> {med.dosage}
            </p>
            <p style={{ margin: "4px 0", color: "#495057" }}>
              <strong>Time:</strong> {med.time}
            </p>
            {med.status && (
              <p style={{ 
                margin: "4px 0", 
                color: med.status === "taken" ? "#28a745" : 
                       med.status === "late" ? "#ffc107" : 
                       med.status === "missed" ? "#dc3545" : "#6c757d",
                fontWeight: "bold",
                fontSize: "12px"
              }}>
                Status: {med.status.toUpperCase()}
              </p>
            )}
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <label style={{ 
              cursor: uploadingId === med.id ? "wait" : "pointer",
              padding: "8px 16px",
              background: "#007bff",
              color: "white",
              borderRadius: "4px",
              display: "inline-block"
            }}>
              {uploadingId === med.id ? "Processing..." : "📷 Verify Photo"}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => uploadPhoto(e, med)}
                style={{ display: "none" }}
                disabled={uploadingId === med.id || med.status === "taken"}
              />
            </label>

            <button 
              onClick={() => markTaken(med.id, med.name)}
              disabled={med.status === "taken"}
              style={{
                padding: "8px 16px",
                background: med.status === "taken" ? "#6c757d" : "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: med.status === "taken" ? "not-allowed" : "pointer"
              }}
            >
              {med.status === "taken" ? "Taken ✓" : "Mark Taken"}
            </button>   

            <button 
              onClick={() => deleteMedicine(med.id, med.name)}
              style={{
                padding: "8px 16px",
                background: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}