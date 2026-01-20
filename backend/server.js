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

    console.log(`\n📱 Creating UI Notification:`);
    console.log(`   User: ${userId}`);
    console.log(`   Type: ${type}`);
    console.log(`   Message: ${message}`);
    console.log(`   Path: users/${userId}/notifications`);

    const docRef = await db.collection(`users/${userId}/notifications`).add(notificationData);
    
    console.log(`✅ Notification created with ID: ${docRef.id}\n`);
    return docRef.id;
  } catch (err) {
    console.error("❌ Failed to create UI notification:", err);
    console.error("Error details:", err.message);
    return null;
  }
}

async function sendSMS(message, to) {
  if (!twilioConfigured) {
    console.log("📵 Twilio not configured, skipping SMS");
    return false;
  }

  if (!to) {
    console.error("❌ Phone number not provided");
    return false;
  }

  try {
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE,
      to: to
    });
    console.log(`📱 SMS sent: ${message}`);
    return true;
  } catch (err) {
    console.error("SMS send failed:", err.message);
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
    console.log("Processing OCR for:", filePath);

    const result = await Tesseract.recognize(filePath, "eng", {
      logger: m => {
        if (m.status === 'recognizing text') {
          process.stdout.write(`\rOCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });

    console.log("\n✓ OCR completed");
    fs.unlinkSync(filePath);

    res.json({ 
      text: result.data.text,
      confidence: result.data.confidence 
    });
  } catch (err) {
    console.error("OCR Error:", err);

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
    twilioConfigured: twilioConfigured,
    features: {
      ocr: true,
      reminders: true,
      sms: twilioConfigured,
      notifications: true
    }
  });
});

/* =========================
   TEST NOTIFICATION ENDPOINT
========================= */
app.post("/api/test-notification", async (req, res) => {
  const { userId = "user-1", message = "Test notification", type = "reminder" } = req.body;

  console.log("\n🧪 TEST NOTIFICATION REQUEST:");
  console.log("   User ID:", userId);
  console.log("   Message:", message);
  console.log("   Type:", type);

  try {
    const notifId = await createUINotification(userId, message, type);
    
    if (notifId) {
      res.json({ 
        success: true, 
        notificationId: notifId,
        message: "Test notification created successfully",
        path: `users/${userId}/notifications/${notifId}`
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: "Failed to create notification" 
      });
    }
  } catch (err) {
    console.error("Test notification error:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

/* =========================
   GET NOTIFICATIONS
========================= */
app.get("/api/notifications/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`\n📋 Fetching notifications for user: ${userId}`);
    
    const notifsSnap = await db
      .collection(`users/${userId}/notifications`)
      .orderBy("createdAt", "desc")
      .get();

    const notifications = notifsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`   Found ${notifications.length} notifications`);

    res.json({ notifications, count: notifications.length });
  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
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
    console.error("Error fetching medicines:", err);
    res.status(500).json({ error: "Failed to fetch medicines" });
  }
});

/* =========================
   REMINDER SCHEDULER - FIXED FOR LOCAL TIMEZONE
========================= */

cron.schedule("0 0 * * *", () => {
  sentReminders.clear();
  console.log("🔄 Cleared sent reminders cache at midnight");
});

cron.schedule("* * * * *", async () => {
  const { today, currentTime, now } = getLocalDateTime();

  console.log(`\n⏰ [${now.toString()}]`);
  console.log(`   Checking reminders for ${today} ${currentTime}`);

  try {
    const usersSnap = await db.collection("users").get();
    console.log(`   Found ${usersSnap.docs.length} users`);

    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      console.log(`   Checking user: ${userId}`);

      const medsSnap = await db
        .collection(`users/${userId}/medicines`)
        .where("date", "==", today)
        .get();

      console.log(`   Found ${medsSnap.docs.length} medicines for ${today}`);

      if (medsSnap.docs.length === 0) {
        console.log(`   ℹ️  No medicines scheduled for today (${today})`);
      }

      for (const medDoc of medsSnap.docs) {
        const data = medDoc.data();
        const medRef = medDoc.ref;
        const medId = medDoc.id;

        console.log(`\n   📋 Medicine: ${data.name} at ${data.time}`);
        console.log(`      Scheduled date: ${data.date}`);
        console.log(`      Current status: ${data.status || 'scheduled'}`);

        if (data.status === "taken") {
          console.log(`      ✓ Already taken, skipping`);
          continue;
        }

        const [h, m] = data.time.split(":").map(Number);
        const scheduledDate = new Date();
        scheduledDate.setHours(h, m, 0, 0);

        const diffMinutes = (now - scheduledDate) / (1000 * 60);
        console.log(`      Time difference: ${diffMinutes.toFixed(1)} minutes`);

        const toNumber = process.env.USER_PHONE;
        const reminderKey = `${userId}-${medId}-${today}`;

        // CASE 1: ON TIME (0-1 minute)
        if (diffMinutes >= 0 && diffMinutes < 1) {
          const alreadySent = sentReminders.get(`${reminderKey}-reminder`);
          
          if (!alreadySent && (!data.status || data.status === "scheduled")) {
            console.log(`      🔔 SENDING ON-TIME REMINDER`);

            await sendSMS(
              `⏰ Reminder: Take ${data.name} ${data.dosage} now.`,
              toNumber
            );

            const notifId = await createUINotification(
              userId,
              `⏰ Time to take ${data.name} ${data.dosage}`,
              "reminder"
            );

            if (notifId) {
              console.log(`      ✅ Created notification: ${notifId}`);
            }

            await medRef.update({ status: "pending", remindedAt: new Date() });
            sentReminders.set(`${reminderKey}-reminder`, true);
          } else {
            console.log(`      ⏭ Already sent or wrong status`);
          }
        }

        // CASE 2: LATE (30-120 minutes)
        else if (diffMinutes >= 30 && diffMinutes < 120) {
          const alreadySent = sentReminders.get(`${reminderKey}-late`);
          
          if (!alreadySent && data.status === "pending") {
            console.log(`      ⚠️ SENDING LATE ALERT`);

            await sendSMS(
              `⚠️ You are late for your medicine: ${data.name} ${data.dosage}.`,
              toNumber
            );

            const notifId = await createUINotification(
              userId,
              `⚠️ You're late! Please take ${data.name} ${data.dosage}`,
              "late"
            );

            if (notifId) {
              console.log(`      ✅ Created notification: ${notifId}`);
            }

            await medRef.update({ status: "late", lateAt: new Date() });
            sentReminders.set(`${reminderKey}-late`, true);
          } else {
            console.log(`      ⏭ Already sent or wrong status`);
          }
        }

        // CASE 3: MISSED (120+ minutes)
        else if (diffMinutes >= 120) {
          const alreadySent = sentReminders.get(`${reminderKey}-missed`);
          
          if (!alreadySent && data.status === "late") {
            console.log(`      ❌ MARKING AS MISSED`);

            await sendSMS(
              `❌ You missed your medicine: ${data.name} ${data.dosage}.`,
              toNumber
            );

            const notifId = await createUINotification(
              userId,
              `❌ Missed: ${data.name} ${data.dosage} at ${data.time}`,
              "missed"
            );

            if (notifId) {
              console.log(`      ✅ Created notification: ${notifId}`);
            }

            await medRef.update({ status: "missed", missedAt: new Date() });
            sentReminders.set(`${reminderKey}-missed`, true);
          } else {
            console.log(`      ⏭ Already sent or wrong status`);
          }
        } else {
          console.log(`      ⏳ Not time yet (${diffMinutes.toFixed(1)} min from scheduled)`);
        }
      }
    }
  } catch (err) {
    console.error("❌ Scheduler error:", err);
  }

  console.log(`\n✓ Reminder check complete\n`);
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
  
  console.error("Server error:", err);
  res.status(500).json({ error: 'Internal server error' });
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  const { today, currentTime } = getLocalDateTime();
  
  console.log(`
╔════════════════════════════════════════════════════════╗
║  🏥 SMART MEDICATION ASSISTANT SERVER (FIXED)          ║
╚════════════════════════════════════════════════════════╝

✓ Server running on http://localhost:${PORT}
✓ Local Date: ${today}
✓ Local Time: ${currentTime}
✓ OCR endpoint: POST /api/ocr/upload
✓ Health check: GET /api/health
✓ Medicines API: GET /api/medicines/:userId/today
✓ Notifications API: GET /api/notifications/:userId
✓ Test Notification: POST /api/test-notification
✓ Reminder scheduler: Active (checks every minute)
✓ UI Notifications: Enabled
${twilioConfigured ? '✓ Twilio SMS: Configured ✅' : '⚠ Twilio SMS: Not configured (UI notifications only)'}

📝 To test notifications manually:
   curl -X POST http://localhost:${PORT}/api/test-notification \\
        -H "Content-Type: application/json" \\
        -d '{"userId":"user-1","message":"Test notification","type":"reminder"}'

⚠️  TIMEZONE FIX APPLIED - Now using local timezone instead of UTC
Status Flow: scheduled → pending → late → missed
Waiting for medicine schedules...
  `);
});