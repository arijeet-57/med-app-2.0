import { useState } from "react";
import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";

export default function Schedule() {
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [time, setTime] = useState("");

  const userId = "user123";

  const handleSubmit = async (e) => {
    e.preventDefault();

    await addDoc(collection(db, `users/${userId}/medicines`), {
      name,
      dosage,
      time,
      createdAt: new Date()
    });

    alert("Medicine added!");
  };

  return (
    <div className="p-6">
      <h1>Add Medicine</h1>

      <form onSubmit={handleSubmit}>
        <input placeholder="Medicine name"
          onChange={e => setName(e.target.value)} />

        <input placeholder="Dosage"
          onChange={e => setDosage(e.target.value)} />

        <input type="time"
          onChange={e => setTime(e.target.value)} />

        <button>Save Medicine</button>
      </form>
    </div>
  );
}
