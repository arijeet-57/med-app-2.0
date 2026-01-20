import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, addDoc } from "firebase/firestore";
import axios from "axios";

export default function Dashboard() {
  const [medicines, setMedicines] = useState([]);
  const [ocrResult, setOcrResult] = useState("");
  const [message, setMessage] = useState("");

  const userId = "user123";

  useEffect(() => {
    async function fetchMeds() {
      const snap = await getDocs(collection(db, `users/${userId}/medicines`));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMedicines(list);
    }
    fetchMeds();
  }, []);

  const uploadPhoto = async (e) => {
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("image", file);

    const res = await axios.post(
      "http://localhost:5000/api/ocr/upload",
      formData
    );

    const extracted = res.data.text.toLowerCase();
    setOcrResult(extracted);

    // SIMPLE MATCHING LOGIC
    const scheduled = "paracetamol 500mg"; // example

    if (extracted.includes(scheduled)) {
      setMessage("Correct medicine detected ✅");
    } else {
      setMessage("Mismatch detected ❌");
    }
  };

  const markTaken = async (medId) => {
    await addDoc(collection(db, `users/${userId}/logs`), {
      date: new Date().toISOString().split("T")[0],
      medicineId: medId,
      status: "taken"
    });

    alert("Logged as taken");
  };

  return (
    <div>
      <h1>Smart Medication Assistant</h1>

      <input type="file" onChange={uploadPhoto} />

      {ocrResult && <p>OCR: {ocrResult}</p>}
      {message && <p>{message}</p>}

      <h2>Today’s Medicines</h2>

      {medicines.map(med => (
        <div key={med.id}>
          <p>{med.name} — {med.dosage} at {med.time}</p>
          <button onClick={() => markTaken(med.id)}>
            Mark Taken
          </button>
        </div>
      ))}
    </div>
  );
}
