import { useState } from "react";
import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";

export default function Schedule() {
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  const userId = "user123";

  const handleSubmit = async (e) => {
    e.preventDefault();

    await addDoc(collection(db, `users/${userId}/medicines`), {
      name,
      dosage,
      time,
      date,   // 👈 important
      createdAt: new Date()
    });

    alert("Medicine scheduled for the day!");
  };

  return (
    <div>
      <h1>Schedule Medicine for a Day</h1>

      <form onSubmit={handleSubmit}>
        <input placeholder="Medicine name"
          onChange={e => setName(e.target.value)} />

        <input placeholder="Dosage"
          onChange={e => setDosage(e.target.value)} />

        <input type="date"
          onChange={e => setDate(e.target.value)} />

        <input type="time"
          onChange={e => setTime(e.target.value)} />

        <button>Save</button>
      </form>
    </div>
  );
}
