# med-app-2.0

# 🏥 Smart Medication Assistant

> An intelligent medication management system with OCR verification, real-time notifications, and SMS reminders.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-10+-orange.svg)](https://firebase.google.com/)

## ✨ Features

- 📅 **Smart Scheduling** - Schedule medicines with daily/one-time options
- 📷 **OCR Verification** - Verify medicine using photo of bottle/packet
- 🔔 **Real-time Notifications** - In-app notifications with sound alerts
- 📱 **SMS Reminders** - Optional Twilio integration for text reminders
- ⏰ **Status Tracking** - Track scheduled → pending → late → missed → taken
- 🎯 **Fuzzy Matching** - Advanced OCR text matching with 70%+ accuracy
- 📊 **7-Day View** - See all upcoming medicines at a glance
- 🔄 **Auto-refresh** - Real-time updates using Firebase listeners

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Firebase account (free tier works)
- Twilio account (for SMS)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/arijeet-57/smart-medication-assistant.git
cd smart-medication-assistant
```

2. **Install dependencies**
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

3. **Set up Firebase**

- Go to [Firebase Console](https://console.firebase.google.com)
- Create a new project
- Enable Firestore Database
- Get your web app credentials

4. **Set up Firebase Admin SDK (Backend)**

The backend needs Firebase Admin SDK credentials to access Firestore.

**Step-by-step:**

a. Go to [Firebase Console](https://console.firebase.google.com)
b. Select your project
c. Click **gear icon** (⚙️) → **Project Settings**
d. Go to **Service Accounts** tab
e. Click **Generate New Private Key**
f. Click **Generate Key** (a JSON file will download)
g. **Rename** the downloaded file to `service.json`
h. **Move** it to `backend/service.json`

```bash
# Your file structure should look like:
backend/
├── server.js
├── firebaseAdmin.js
├── service.json          ← Place downloaded file here
├── package.json
└── .env
```

**⚠️ IMPORTANT:** 
- `service.json` contains sensitive credentials
- It's already in `.gitignore` - **NEVER commit this file to Git**
- Keep this file secure and private

**Verify the file structure:**
```json
// service.json should look like this:
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "firebase-adminsdk-...@your-project.iam.gserviceaccount.com",
  ...
}
```

5. **Configure environment variables**

**Backend** - Create `backend/.env`:
```bash
# Twilio (Optional - for SMS)
TWILIO_SID=your_twilio_account_sid
TWILIO_TOKEN=your_twilio_auth_token
TWILIO_PHONE=+1234567890
USER_PHONE=+1987654321

# Server
PORT=5000
NODE_ENV=development
```

**Frontend** - Create `frontend/.env`:
```bash
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

6. **Configure Firestore**

**Security Rules** (for development):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**Database Structure**:
```
users/
  └─ user-1/
      ├─ medicines/
      │   └─ {medicineId}/
      │       ├─ name: "Aspirin"
      │       ├─ dosage: "500mg"
      │       ├─ time: "08:00"
      │       ├─ date: "2026-01-21"
      │       ├─ status: "scheduled"
      │       └─ createdAt: timestamp
      │
      ├─ notifications/
      │   └─ {notificationId}/
      │       ├─ message: "Time to take..."
      │       ├─ type: "reminder"
      │       ├─ read: false
      │       └─ createdAt: timestamp
      │
      └─ logs/
          └─ {logId}/
              ├─ medicineId: "abc123"
              ├─ medicineName: "Aspirin"
              ├─ status: "taken"
              └─ timestamp: timestamp
```

7. **Create initial user document**

In Firestore Console:
- Collection ID: `users`
- Document ID: `user-1`
- Field: `created` (timestamp)

8. **Run the application**

```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend
cd frontend
npm run dev
```

9. **Open in browser**
```
http://localhost:5173
```

## 📚 Project Structure

```
smart-medication-assistant/
├── backend/
│   ├── server.js              # Express server with OCR & scheduler
│   ├── firebaseAdmin.js       # Firebase Admin SDK config
│   ├── service.json           # Firebase service account key (gitignored)
│   ├── .env                   # Environment variables (gitignored)
│   ├── package.json
│   └── uploads/               # Temporary OCR uploads (auto-created)
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx  # Main medicine list & notifications
│   │   │   └── Schedule.jsx   # Add medicine form
│   │   ├── firebase.js        # Firebase client config
│   │   ├── App.jsx            # Router & navigation
│   │   └── main.jsx           # App entry point
│   ├── .env                   # Environment variables (gitignored)
│   ├── package.json
│   └── index.html
│
├── .gitignore
├── LICENSE
└── README.md
```

## 🔧 Configuration

### Timezone Setup

The app uses local timezone by default. The server automatically detects your timezone.

### Notification Sound

Default sound: Mixkit notification sound (CDN)

To use custom sound, update in `Dashboard.jsx`:
```jsx
<audio 
  ref={audioRef} 
  src="YOUR_SOUND_URL_HERE" 
  preload="auto" 
  loop
/>
```

### Reminder Timing

Edit in `backend/server.js`:
```javascript
// ON-TIME: 0-1 minute after scheduled
if (diffMinutes >= 0 && diffMinutes < 1)

// LATE: 30-120 minutes after scheduled
else if (diffMinutes >= 30 && diffMinutes < 120)

// MISSED: 120+ minutes after scheduled
else if (diffMinutes >= 120)
```

### OCR Matching Sensitivity

Adjust in `Dashboard.jsx`:
```javascript
// Fuzzy match threshold (0.7 = 70% similarity)
return similarity > 0.7;

// Match criteria (2-6 words)
const isMatch = matchCount >= 2 && matchCount <= 6;
```

## 🧪 Testing

### Test Medicine Scheduling

1. Go to "Add Medicine"
2. Fill form:
   - Name: Test Medicine
   - Dosage: 500mg
   - Date: Today
   - Time: Current time + 2 minutes
3. Save and wait 2 minutes
4. Should receive notification with sound

### Test OCR Verification

1. Schedule a medicine (e.g., "Aspirin 500mg")
2. Take photo of Aspirin bottle
3. Click "Verify" and upload photo
4. Should show match/mismatch result

### Test Notifications

1. Click bell icon (top right)
2. Should see notification panel
3. Click "Mark as Read"
4. Badge count should decrease

## 📱 Mobile Usage

### Testing on Mobile Device

1. Find your computer's IP address:
```bash
# Windows
ipconfig

# Mac/Linux
ifconfig
```

2. Update frontend API URL in `Dashboard.jsx` and `Schedule.jsx`:
```javascript
const API_URL = "http://YOUR_IP:5000";
```

3. On mobile browser, visit:
```
http://YOUR_IP:5173
```

### PWA (Progressive Web App)

To install as mobile app:
1. Open in mobile browser
2. Click browser menu → "Add to Home Screen"
3. App icon appears on home screen

## 🤝 Contributing

We welcome contributions! Please follow these steps:

### 1. Fork the Repository

Click the "Fork" button at the top right of this page.

### 2. Clone Your Fork

```bash
git clone https://github.com/arijeet-57/smart-medication-assistant.git
cd smart-medication-assistant
```

### 3. Create a Branch

```bash
git checkout -b feature/your-feature-name
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation
- `refactor/` - Code refactoring

### 4. Make Changes

- Follow existing code style
- Add comments for complex logic
- Test your changes thoroughly

### 5. Commit Changes

```bash
git add .
git commit -m "feat: add new feature description"
```

Commit message format:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Formatting
- `refactor:` - Code restructuring
- `test:` - Adding tests
- `chore:` - Maintenance

### 6. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 7. Create Pull Request

1. Go to original repository
2. Click "Pull Requests" → "New Pull Request"
3. Select your branch
4. Fill in description
5. Submit PR

### Code Style Guidelines

**JavaScript/React:**
- Use functional components with hooks
- Use descriptive variable names
- Add JSDoc comments for functions
- Keep functions small and focused
- Use async/await for promises

**Example:**
```javascript
/**
 * Uploads and processes medicine photo using OCR
 * @param {Event} event - File input change event
 * @param {Object} med - Medicine object to verify
 */
const uploadPhoto = async (event, med) => {
  // Implementation
};
```

### Testing Your Contribution

Before submitting PR:
- [ ] Backend runs without errors
- [ ] Frontend runs without errors
- [ ] No console errors
- [ ] Feature works as expected
- [ ] Existing features not broken
- [ ] Code follows style guide

## 🐛 Bug Reports

Found a bug? Please create an issue with:

**Title:** Brief description
**Description:**
- What happened
- What you expected
- Steps to reproduce
- Screenshots (if applicable)
- Browser/OS info

**Example:**
```markdown
**Bug:** Notification sound not playing on iOS Safari

**Description:**
The notification sound doesn't play when reminder is triggered on iPhone.

**Steps to Reproduce:**
1. Schedule medicine on iPhone
2. Wait for reminder time
3. Notification appears but no sound

**Environment:**
- Browser: Safari 17
- OS: iOS 17.2
- Device: iPhone 15
```

## 💡 Feature Requests

Have an idea? Create an issue with:

**Title:** Feature request: [Your feature]
**Description:**
- What feature you want
- Why it's useful
- How it should work

## 🔐 Security

### Reporting Security Issues

**DO NOT** create public issues for security vulnerabilities.

Email: your-email@example.com

Include:
- Description of vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Security Best Practices

**Before Deployment:**
- [ ] Update Firestore security rules
- [ ] Add authentication
- [ ] Use environment variables
- [ ] Enable HTTPS
- [ ] Add rate limiting
- [ ] Validate all inputs
- [ ] Sanitize user data

## 🙏 Acknowledgments

- [Tesseract.js](https://tesseract.projectnaptha.com/) - OCR engine
- [Firebase](https://firebase.google.com/) - Backend services
- [Twilio](https://www.twilio.com/) - SMS service
- [Mixkit](https://mixkit.co/) - Notification sounds
- [React](https://reactjs.org/) - Frontend framework

## 📞 Support

- 📧 Email: blakelabs57@example.com

## 🗺️ Roadmap

### Future Ideas
- [ ] Apple Health / Google Fit integration
- [ ] Prescription scanning
- [ ] Drug interaction warnings
- [ ] Pharmacy integration
- [ ] Insurance coverage checker

## 📊 Stats

![GitHub stars](https://img.shields.io/github/stars/arijeet-57/smart-medication-assistant?style=social)
![GitHub forks](https://img.shields.io/github/forks/arijeet-57/smart-medication-assistant?style=social)
![GitHub issues](https://img.shields.io/github/issues/arijeet-57/smart-medication-assistant)
![GitHub pull requests](https://img.shields.io/github/issues-pr/arijeet-57/smart-medication-assistant)

## ⭐ Star History

If you find this project useful, please consider giving it a star!

---

## License

Copyright [2026] [Arijeet Roy]

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

---

**Made with ❤️ by [Arijeet Roy, Vandit Agrawal, Anupam Singh](https://github.com/arijeet-57)**