import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import multer from "multer";
import Tesseract from "tesseract.js";
import cron from "node-cron";
import { db } from "./firebaseAdmin.js";
import twilio from "twilio";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

const uploadsDir = "uploads";
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const upload = multer({ 
  dest: uploadsDir,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    file.mimetype.startsWith("image/")
      ? cb(null, true)
      : cb(new Error("Only image files are allowed"));
  }
});

const twilioConfigured = !!(process.env.TWILIO_SID && process.env.TWILIO_TOKEN);
const client = twilioConfigured ? twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_TOKEN
) : null;

// -------- HELPER: GET LOCAL DATE/TIME --------
function getLocalDateTime() {
  const now = new Date();
  
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const today = `${year}-${month}-${day}`;
  
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${hours}:${minutes}`;
  
  return { today, currentTime, now };
}

// -------- HELPER: CREATE UI NOTIFICATION --------
async function createUINotification(userId, message, type) {
  try {
    const notificationData = {
      message,
      type,
      createdAt: new Date(),
      read: false
    };

    const docRef = await db.collection(`users/${userId}/notifications`).add(notificationData);
    console.log(`📱 Notification created: ${type} - ${message}`);
    return docRef.id;
  } catch (err) {
    console.error("❌ Failed to create notification:", err.message);
    return null;
  }
}

// -------- HELPER: SEND SMS --------
async function sendSMS(message, to) {
  if (!twilioConfigured) {
    return false;
  }

  if (!to) {
    console.error("❌ Phone number not configured");
    return false;
  }

  try {
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE,
      to: to
    });
    console.log(`📱 SMS sent: ${message.substring(0, 50)}...`);
    return true;
  } catch (err) {
    console.error("SMS failed:", err.message);
    return false;
  }
}

const sentReminders = new Map();

/* =========================
   OCR ENDPOINT
========================= */
app.post("/api/ocr/upload", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image file uploaded" });
  }

  const filePath = req.file.path;

  try {
    const result = await Tesseract.recognize(filePath, "eng");
    fs.unlinkSync(filePath);

    res.json({ 
      text: result.data.text,
      confidence: result.data.confidence 
    });
  } catch (err) {
    console.error("OCR Error:", err.message);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.status(500).json({ 
      error: "OCR processing failed", 
      details: err.message 
    });
  }
});

/* =========================
   HEALTH CHECK
========================= */
app.get("/api/health", (req, res) => {
  const { today, currentTime } = getLocalDateTime();
  
  res.json({
    status: "ok",
    serverTime: new Date().toString(),
    localDate: today,
    localTime: currentTime,
    features: {
      ocr: true,
      reminders: true,
      sms: twilioConfigured,
      notifications: true
    }
  });
});

/* =========================
   GET TODAY'S MEDICINES
========================= */
app.get("/api/medicines/:userId/today", async (req, res) => {
  try {
    const { userId } = req.params;
    const { today } = getLocalDateTime();

    const medsSnap = await db
      .collection(`users/${userId}/medicines`)
      .where("date", "==", today)
      .get();

    const medicines = medsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({ medicines, date: today });
  } catch (err) {
    console.error("Error fetching medicines:", err.message);
    res.status(500).json({ error: "Failed to fetch medicines" });
  }
});

/* =========================
   REMINDER SCHEDULER
========================= */

// Clear cache at midnight
cron.schedule("0 0 * * *", () => {
  sentReminders.clear();
  console.log("🔄 Cleared reminder cache");
});

// Check every minute
cron.schedule("* * * * *", async () => {
  const { today, currentTime, now } = getLocalDateTime();

  try {
    const usersSnap = await db.collection("users").get();

    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;

      const medsSnap = await db
        .collection(`users/${userId}/medicines`)
        .where("date", "==", today)
        .get();

      for (const medDoc of medsSnap.docs) {
        const data = medDoc.data();
        const medRef = medDoc.ref;
        const medId = medDoc.id;

        if (data.status === "taken") {
          continue;
        }

        const [h, m] = data.time.split(":").map(Number);
        const scheduledDate = new Date();
        scheduledDate.setHours(h, m, 0, 0);

        const diffMinutes = (now - scheduledDate) / (1000 * 60);
        const toNumber = process.env.USER_PHONE;
        const reminderKey = `${userId}-${medId}-${today}`;

        // ON TIME (0-1 minute)
        if (diffMinutes >= 0 && diffMinutes < 1) {
          const alreadySent = sentReminders.get(`${reminderKey}-reminder`);
          
          if (!alreadySent && (!data.status || data.status === "scheduled")) {
            await sendSMS(
              `⏰ Reminder: Take ${data.name} ${data.dosage} now.`,
              toNumber
            );

            await createUINotification(
              userId,
              `⏰ Time to take ${data.name} ${data.dosage}`,
              "reminder"
            );

            await medRef.update({ status: "pending", remindedAt: new Date() });
            sentReminders.set(`${reminderKey}-reminder`, true);
          }
        }

        // LATE (30-120 minutes)
        else if (diffMinutes >= 30 && diffMinutes < 120) {
          const alreadySent = sentReminders.get(`${reminderKey}-late`);
          
          if (!alreadySent && data.status === "pending") {
            await sendSMS(
              `⚠️ You are late for your medicine: ${data.name} ${data.dosage}.`,
              toNumber
            );

            await createUINotification(
              userId,
              `⚠️ You're late! Please take ${data.name} ${data.dosage}`,
              "late"
            );

            await medRef.update({ status: "late", lateAt: new Date() });
            sentReminders.set(`${reminderKey}-late`, true);
          }
        }

        // MISSED (120+ minutes)
        else if (diffMinutes >= 120) {
          const alreadySent = sentReminders.get(`${reminderKey}-missed`);
          
          if (!alreadySent && data.status === "late") {
            await sendSMS(
              `❌ You missed your medicine: ${data.name} ${data.dosage}.`,
              toNumber
            );

            await createUINotification(
              userId,
              `❌ Missed: ${data.name} ${data.dosage} at ${data.time}`,
              "missed"
            );

            await medRef.update({ status: "missed", missedAt: new Date() });
            sentReminders.set(`${reminderKey}-missed`, true);
          }
        }
      }
    }
  } catch (err) {
    console.error("❌ Scheduler error:", err.message);
  }
});

/* =========================
   ERROR HANDLING
========================= */
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Max size is 5MB' });
    }
    return res.status(400).json({ error: err.message });
  }
  
  console.error("Server error:", err.message);
  res.status(500).json({ error: 'Internal server error' });
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  const { today, currentTime } = getLocalDateTime();
  
  console.log(`
✓ Server: http://localhost:${PORT}
✓ Date: ${today} | Time: ${currentTime}
✓ OCR: Enabled
✓ Reminders: Active (every minute)
✓ Notifications: Enabled
${twilioConfigured ? '✓ SMS: Configured' : '⚠ SMS: Not configured'}

Ready to serve!
  `);
});