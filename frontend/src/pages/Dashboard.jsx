import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, addDoc } from "firebase/firestore";
import axios from "axios";

const today = new Date().toISOString().split("T")[0];

export default function Dashboard() {
  const [medicines, setMedicines] = useState([]);
  const [ocrResult, setOcrResult] = useState("");
  const [message, setMessage] = useState("");

  const userId = "user123";

  useEffect(() => {
    async function fetchMeds() {
      const snap = await getDocs(
  collection(db, `users/${userId}/medicines`)
);

const list = snap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .filter(med => med.date === today);   

setMedicines(list);

    }
    fetchMeds();
  }, []);

 const uploadPhoto = async (med) => {
  const file = event.target.files[0];
  const formData = new FormData();
  formData.append("image", file);

  const res = await axios.post(
    "http://localhost:5000/api/ocr/upload",
    formData
  );

  const extracted = res.data.text.toLowerCase();
  setOcrResult(extracted);

  const scheduled = `${med.name} ${med.dosage}`.toLowerCase();

  if (extracted.includes(scheduled)) {
    alert("Correct medicine detected ✅");
  } else {
    alert("Mismatch detected ❌");
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

    <input
      type="file"
      onChange={() => uploadPhoto(med)}
    />

    <button onClick={() => markTaken(med.id)}>
      Mark Taken
    </button>
  </div>
))}
    </div>
  );
}
