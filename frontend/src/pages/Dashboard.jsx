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
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showBanner, setShowBanner] = useState(false);
  const [bannerNotification, setBannerNotification] = useState(null);

  const audioRef = useRef(null);
  const userId = "user-1";
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    fetchMeds();

    const handleFocus = () => fetchMeds();
    window.addEventListener("focus", handleFocus);

    // Notification listener
    const notifRef = collection(db, `users/${userId}/notifications`);
    const qNotif = query(notifRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(qNotif, (snap) => {
      const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      setNotifications(prevNotifs => {
        const prevUnread = prevNotifs.filter(n => !n.read).length;
        const newUnread = notifs.filter(n => !n.read).length;

        if (newUnread > prevUnread && newUnread > 0) {
          const latestUnread = notifs.find(n => !n.read);
          if (latestUnread) {
            setBannerNotification(latestUnread);
            setShowBanner(true);
            
            if (audioRef.current) {
              audioRef.current.play().catch(e => console.log("Audio autoplay prevented"));
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
    });

    return () => {
      window.removeEventListener("focus", handleFocus);
      unsub();
    };
  }, []);

  async function fetchMeds() {
    try {
      setLoading(true);

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
    } catch (error) {
      console.error("Error fetching medicines:", error);
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

      // Extract all words from both medicine info and OCR text
      const medNameWords = med.name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const dosageWords = med.dosage.toLowerCase().split(/\s+/).filter(w => w.length > 0);
      
      // Combine all expected words
      const expectedWords = [...medNameWords, ...dosageWords];
      
      // Split OCR text into words
      const ocrWords = extracted.split(/\s+/).filter(w => w.length > 0);
      
      // Count matches
      let matchCount = 0;
      const matchedWords = [];
      
      expectedWords.forEach(expectedWord => {
        // Check for exact match or partial match (at least 80% similar)
        const found = ocrWords.some(ocrWord => {
          if (ocrWord.includes(expectedWord) || expectedWord.includes(ocrWord)) {
            return true;
          }
          // Check similarity for longer words (fuzzy matching)
          if (expectedWord.length > 3 && ocrWord.length > 3) {
            const similarity = calculateSimilarity(expectedWord, ocrWord);
            return similarity > 0.7;
          }
          return false;
        });
        
        if (found) {
          matchCount++;
          matchedWords.push(expectedWord);
        }
      });

      const totalExpected = expectedWords.length;
      const matchPercentage = (matchCount / totalExpected) * 100;

      // Match is valid if 2-6 words match (or at least 50% of expected words)
      const isMatch = matchCount >= 2 && (matchCount <= 6 || matchPercentage >= 50);

      if (isMatch) {
        setMessage(
          `✅ Verified: ${med.name} ${med.dosage} (${matchCount}/${totalExpected} words matched)`
        );
      } else {
        setMessage(
          `❌ Mismatch: Only ${matchCount}/${totalExpected} words matched. Expected: ${med.name} ${med.dosage}`
        );
      }

    } catch (error) {
      console.error("OCR error:", error);
      if (error.code === 'ECONNABORTED') {
        setMessage("❌ Upload timeout");
      } else if (error.request) {
        setMessage("❌ Cannot connect to server");
      } else {
        setMessage("❌ Upload failed");
      }
    } finally {
      setUploadingId(null);
      event.target.value = '';
    }
  };

  // Helper function to calculate string similarity (Levenshtein-based)
  const calculateSimilarity = (str1, str2) => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  const getEditDistance = (str1, str2) => {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
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
      console.error("Error logging medicine:", error);
      setMessage("❌ Failed to log medicine");
    }
  };

  const deleteMedicine = async (medId, medName) => {
    const ok = window.confirm(`Delete ${medName}?`);
    if (!ok) return;

    try {
      await deleteDoc(doc(db, `users/${userId}/medicines`, medId));
      setMedicines(prev => prev.filter(m => m.id !== medId));
      setMessage(`🗑️ Deleted ${medName}`);
    } catch (err) {
      console.error("Delete failed:", err);
      setMessage("❌ Failed to delete");
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
    } catch (err) {
      console.error("Failed to clear notifications:", err);
    }
  };

  const getNotificationIcon = (type) => {
    switch(type) {
      case "reminder": return "";
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
            height: "50px",
            transition: "all 0.3s"
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
              fontWeight: "bold",
              animation: "pulse 2s infinite"
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
              <p style={{ textAlign: "center", color: "#ffffff", padding: "20px" }}>
                No notifications
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
                  border: `1px solid ${n.read ? "#0d0d0d" : "#007bff"}`,
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
                    <small style={{ color: "#000000" }}>
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

      {message && (
        <div style={{ 
          background: message.includes("✅") ? "#d4edda" : "#f8d7da",
          color: message.includes("✅") ? "#155724" : "#721c24",
          padding: "12px",
          borderRadius: "4px",
          marginBottom: "16px",
          border: `1px solid ${message.includes("✅") ? "#c3e6cb" : "#f5c6cb"}`
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
          border: "1px solid #262a2e"
        }}>
          <summary style={{ cursor: "pointer", fontWeight: "bold" }}>
            OCR Results
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

      <h2>Upcoming Medicines</h2>

      {loading && <p>Loading...</p>}

      {!loading && medicines.length === 0 && (
        <div style={{ 
          textAlign: "center", 
          padding: "40px 20px",
          background: "#f8f9fa",
          borderRadius: "8px",
          border: "2px dashed #dee2e6"
        }}>
          <p style={{ color: "#dcdedf", fontStyle: "italic", fontSize: "16px" }}>
            No medicines scheduled for the next 7 days.
          </p>
        </div>
      )}

      {medicines.map(med => (
        <div
          key={med.id}
          style={{ 
  border: "1px solid #1c1d20", 
  padding: "16px", 
  margin: "12px 0",
  borderRadius: "10px",
  background: med.status === "taken" ? "#151617" : "#ffffff",
  opacity: med.status === "taken" ? 0.75 : 1,
  boxShadow: "0 4px 10px rgba(0,0,0,0.08)"
}}

        >
          <div style={{ marginBottom: "12px" }}>
            <h3 className="nameOfMedicine" style={{ margin: "0 0 8px 0" }}>
              {med.name} {med.status === "taken" && "✓"}
            </h3>
            <p style={{ margin: "4px 0", color: "#000000" }}>
              <strong>Date:</strong> {med.date}
            </p>
            <p style={{ margin: "4px 0", color: "#000000" }}>
              <strong>Dosage:</strong> {med.dosage}
            </p>
            <p style={{ margin: "4px 0", color: "#000000" }}>
              <strong>Time:</strong> {med.time}
            </p>
            {med.status && med.status !== "scheduled" && (
              <p style={{ 
                margin: "4px 0", 
                color: med.status === "taken" ? "#28a745" : 
                       med.status === "late" ? "#ffc107" : 
                       med.status === "missed" ? "#dc3545" : "#202224",
                fontWeight: "bold",
                fontSize: "12px"
              }}>
                {med.status.toUpperCase()}
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
              {uploadingId === med.id ? "Processing..." : "📷 Verify"}
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
                background: med.status === "taken" ? "#2a2c2e" : "#28a745",
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

      <style>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
        }
      `}</style>
    </div>
  );
}