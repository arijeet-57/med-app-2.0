import { useState } from "react";
import { db } from "../firebase";
import axios from "axios";
import { collection, addDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function Schedule() {
  const [ocrLoading, setOcrLoading] = useState(false);
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [repeat, setRepeat] = useState("once");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const navigate = useNavigate();
  const userId = "user-1";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name || !dosage || !time || !date) {
      setError("Please fill all required fields!");
      return;
    }

    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      setError("Cannot schedule for past dates!");
      return;
    }

    setLoading(true);

    try {
      const medicineData = {
        name: name.trim(),
        dosage: dosage.trim(),
        time,
        date,
        repeat,
        status: "scheduled",
        createdAt: new Date(),
        active: true
      };

      await addDoc(collection(db, `users/${userId}/medicines`), medicineData);

      if (repeat === "daily") {
        const promises = [];
        
        for (let i = 1; i <= 7; i++) {
          const futureDate = new Date(selectedDate);
          futureDate.setDate(futureDate.getDate() + i);
          
          promises.push(
            addDoc(collection(db, `users/${userId}/medicines`), {
              ...medicineData,
              date: futureDate.toISOString().split("T")[0]
            })
          );
        }
        
        await Promise.all(promises);
      }

      setSuccess(`✅ Medicine scheduled successfully!${repeat === "daily" ? " (Next 7 days)" : ""}`);
      
      setTimeout(() => {
        navigate("/");
      }, 1500);

    } catch (err) {
      console.error("Error scheduling medicine:", err);
      setError("Failed to save medicine. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getTodayDate = () => {
    return new Date().toISOString().split("T")[0];
  };

 const scanMedicineName = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    setError("Please upload an image file");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    setError("Image must be less than 5MB");
    return;
  }

  setOcrLoading(true);
  setError("");

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

    // ✅ CONVERT TO LOWERCASE HERE
    const extractedText = res.data.text
      .toLowerCase()      // <-- IMPORTANT
      .trim();

    const lines = extractedText
      .split("\n")
      .filter(line => line.trim());

    const firstLine = lines[0] || "";

    if (firstLine) {
      setName(firstLine);   // field will now always be lowercase
      setSuccess(`✅ Detected: ${firstLine}`);
    } else {
      setError("Could not detect medicine name");
    }

  } catch (err) {
    console.error("OCR error:", err);

    if (err.code === 'ECONNABORTED') {
      setError("Upload timeout. Please try again.");
    } else if (err.request) {
      setError("Cannot connect to server");
    } else {
      setError("Failed to scan image");
    }
  } finally {
    setOcrLoading(false);
    event.target.value = "";
  }
};

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Schedule Medicine</h1>

      {error && (
        <div style={{
          background: "#f8d7da",
          color: "#721c24",
          padding: "12px",
          borderRadius: "4px",
          marginBottom: "16px",
          border: "1px solid #f5c6cb"
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          background: "#d4edda",
          color: "#155724",
          padding: "12px",
          borderRadius: "4px",
          marginBottom: "16px",
          border: "1px solid #c3e6cb"
        }}>
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}>
            Medicine Name *
          </label>

          <label
            style={{
              display: "inline-block",
              marginBottom: "8px",
              padding: "8px 16px",
              background: ocrLoading ? "#6c757d" : "#17a2b8",
              color: "white",
              borderRadius: "4px",
              cursor: ocrLoading ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "500"
            }}
          >
            {ocrLoading ? "⏳ Scanning..." : "📷 Scan from Photo"}
            <input
              type="file"
              accept="image/*"
              onChange={scanMedicineName}
              style={{ display: "none" }}
              disabled={ocrLoading}
            />
          </label>

          <input
            placeholder="e.g., Aspirin, Metformin"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #ced4da",
              borderRadius: "4px",
              fontSize: "14px"
            }}
          />
          <small style={{ color: "#6c757d", display: "block", marginTop: "4px" }}>
            Type manually or scan from medicine bottle
          </small>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}>
            Dosage *
          </label>
          <input
            placeholder="e.g., 500mg, 1 tablet, 5ml"
            value={dosage}
            onChange={e => setDosage(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #ced4da",
              borderRadius: "4px",
              fontSize: "14px"
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}>
            Date *
          </label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            min={getTodayDate()}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #ced4da",
              borderRadius: "4px",
              fontSize: "14px"
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}>
            Time *
          </label>
          <input
            type="time"
            value={time}
            onChange={e => setTime(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #ced4da",
              borderRadius: "4px",
              fontSize: "14px"
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}>
            Frequency
          </label>
          <select
            value={repeat}
            onChange={e => setRepeat(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #ced4da",
              borderRadius: "4px",
              fontSize: "14px"
            }}
          >
            <option value="once">One time only</option>
            <option value="daily">Daily (next 7 days)</option>
          </select>
          <small style={{ color: "#6c757d", display: "block", marginTop: "4px" }}>
            Daily creates 7 entries automatically
          </small>
        </div>

        <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px 24px",
              background: loading ? "#6c757d" : "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "16px",
              fontWeight: "600",
              flex: 1
            }}
          >
            {loading ? "Saving..." : "💾 Save Medicine"}
          </button>

          <button
            type="button"
            onClick={() => navigate("/")}
            disabled={loading}
            style={{
              padding: "12px 24px",
              background: "white",
              color: "#6c757d",
              border: "2px solid #6c757d",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "16px",
              fontWeight: "600"
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}