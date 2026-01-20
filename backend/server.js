import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import multer from "multer";
import Tesseract from "tesseract.js";
import cron from "node-cron";
import { db } from "./firebaseAdmin.js";
import twilio from "twilio";

const app = express();
app.use(cors());

const upload = multer({ dest: "uploads/" });

const client = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_TOKEN
);

/* =========================
   OCR ENDPOINT
========================= */

app.post("/api/ocr/upload", upload.single("image"), async (req, res) => {
  try {
    const result = await Tesseract.recognize(req.file.path, "eng");
    res.json({ text: result.data.text });
  } catch (err) {
    res.status(500).json({ error: "OCR failed", details: err.message });
  }
});

/* =========================
   REMINDER SCHEDULER
========================= */

cron.schedule("* * * * *", async () => {
  console.log("Checking today’s reminders...");

  const today = new Date().toISOString().split("T")[0];
  const currentTime = new Date().toTimeString().slice(0, 5);

  const usersSnap = await db.collection("users").get();

  for (const userDoc of usersSnap.docs) {
    const medsSnap = await db
      .collection(`users/${userDoc.id}/medicines`)
      .where("date", "==", today)   // 👈 only today
      .get();

    for (const med of medsSnap.docs) {
      const data = med.data();

      if (data.time === currentTime) {
        await client.messages.create({
          body: `Reminder: Take ${data.name} ${data.dosage} now.`,
          from: process.env.TWILIO_PHONE,
          to: process.env.USER_PHONE
        });

        console.log("Reminder sent!");
      }
    }
  }
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
