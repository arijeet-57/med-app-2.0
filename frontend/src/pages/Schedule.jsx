import { useState } from "react";
import { db } from "../firebase";
import axios from "axios";             
import { collection, addDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import '../index.css';
import "../App.css";

export default function Schedule() {
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [repeat, setRepeat] = useState("once");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [debugInfo, setDebugInfo] = useState("");

  const navigate = useNavigate();
  const userId = "user-1";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setDebugInfo("");

    if (!name || !dosage || !time || !date) {
      setError("Please fill all required fields!");
      return;
    }

    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      setError("Cannot schedule medicine for a past date!");
      return;
    }

    setLoading(true);
    setDebugInfo("Starting save process...");

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

      console.log("Saving medicine data:", medicineData);
      console.log("Collection path:", `users/${userId}/medicines`);

      setDebugInfo("Connecting to Firebase...");

      const docRef = await addDoc(
        collection(db, `users/${userId}/medicines`), 
        medicineData
      );

      console.log("Document written with ID:", docRef.id);
      setDebugInfo(`✅ Saved with ID: ${docRef.id}`);

      if (repeat === "daily") {
        setDebugInfo("Creating daily schedule for 7 days...");
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
        console.log("Daily schedule created for 7 days");
      }

      alert(`✅ Medicine scheduled successfully!${repeat === "daily" ? " (Next 7 days)" : ""}`);
      
      setTimeout(() => {
        navigate("/");
      }, 1000);

    } catch (err) {
      console.error("❌ Error scheduling medicine:", err);
      console.error("Error code:", err.code);
      console.error("Error message:", err.message);
      
      setError(`Failed to save: ${err.message}`);
      setDebugInfo(`Error: ${err.code || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const getTodayDate = () => {
    return new Date().toISOString().split("T")[0];
  };

  const testConnection = async () => {
    setDebugInfo("Testing Firebase connection...");
    try {
      const testData = {
        test: true,
        timestamp: new Date()
      };
      
      const docRef = await addDoc(
        collection(db, `users/${userId}/test`), 
        testData
      );
      
      setDebugInfo(`✅ Connection OK! Test doc ID: ${docRef.id}`);
      console.log("Firebase test successful:", docRef.id);
    } catch (err) {
      setDebugInfo(`❌ Connection failed: ${err.message}`);
      console.error("Firebase test failed:", err);
    }
  };

  // FIXED: Properly extracts medicine name from OCR
  const extractMedicineNameFromImage = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("❌ Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("❌ Image must be less than 5MB");
      return;
    }

    setOcrLoading(true);
    setError("");
    setDebugInfo("🔄 Extracting medicine name from image...");

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

      const extractedText = res.data.text.trim();
      setOcrText(extractedText);

      // Extract first line as medicine name
      const lines = extractedText.split("\n").filter(line => line.trim());
      const firstLine = lines[0] || "";
      
      // Clean up the extracted name
      const cleanedName = firstLine.trim();

      if (cleanedName) {
        setName(cleanedName);
        setDebugInfo(`✅ OCR detected name: "${cleanedName}"`);
      } else {
        setError("⚠️ Could not detect medicine name from image");
        setDebugInfo("OCR completed but no text found");
      }

    } catch (err) {
      console.error("OCR error:", err);
      if (err.code === 'ECONNABORTED') {
        setError("❌ Upload timeout - please try again");
      } else if (err.response) {
        setError(`❌ Server error: ${err.response.data.error || 'Unknown error'}`);
      } else if (err.request) {
        setError("❌ Cannot connect to server - is it running on port 5000?");
      } else {
        setError("❌ Failed to read medicine from image");
      }
      setDebugInfo(`Error: ${err.message}`);
    } finally {
      setOcrLoading(false);
      event.target.value = "";
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Schedule Medicine</h1>

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

      {ocrText && (
        <details style={{
          background: "#f8f9fa",
          padding: "12px",
          borderRadius: "4px",
          marginBottom: "16px",
          border: "1px solid #dee2e6"
        }}>
          <summary style={{ cursor: "pointer", fontWeight: "bold", marginBottom: "8px" }}>
            OCR Extracted Text (click to view)
          </summary>
          <pre style={{
            marginTop: "8px",
            whiteSpace: "pre-wrap",
            fontSize: "12px",
            background: "white",
            padding: "8px",
            borderRadius: "4px"
          }}>
            {ocrText}
          </pre>
        </details>
      )}

      <button
        type="button"
        onClick={testConnection}
        style={{
          padding: "8px 16px",
          background: "#6c757d",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          marginBottom: "20px",
          fontSize: "12px"
        }}
      >
        🔧 Test Firebase Connection
      </button>

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
            {ocrLoading ? "⏳ Scanning..." : "📷 Scan Medicine Name from Photo"}
            <input
              type="file"
              accept="image/*"
              onChange={extractMedicineNameFromImage}
              style={{ display: "none" }}
              disabled={ocrLoading}
            />
          </label>

          <input
            placeholder="e.g., Aspirin, Metformin, Paracetamol"
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
            You can type manually or scan from medicine bottle/packet
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
          <small style={{ color: "#6c757d", display: "block", marginTop: "4px" }}>
            Cannot schedule for past dates
          </small>
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
            Daily option will create 7 entries automatically
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
            {loading ? "⏳ Scheduling..." : "💾 Save Medicine"}
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

      <details style={{ marginTop: "30px", fontSize: "12px" }}>
        <summary style={{ cursor: "pointer", color: "#6c757d", fontWeight: "500" }}>
          Developer Info
        </summary>
        <pre style={{ 
          background: "#f8f9fa", 
          padding: "12px", 
          borderRadius: "4px",
          marginTop: "8px",
          overflow: "auto"
        }}>
          User ID: {userId}{"\n"}
          Collection Path: users/{userId}/medicines{"\n"}
          Today: {getTodayDate()}{"\n"}
          {"\n"}
          Form Data:{"\n"}
          - Name: {name || "(empty)"}{"\n"}
          - Dosage: {dosage || "(empty)"}{"\n"}
          - Date: {date || "(empty)"}{"\n"}
          - Time: {time || "(empty)"}{"\n"}
          - Repeat: {repeat}{"\n"}
          {"\n"}
          OCR Status: {ocrLoading ? "Processing..." : "Ready"}{"\n"}
          OCR Text Length: {ocrText.length} characters
        </pre>
      </details>
    </div>
  );
}