import { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from "react-router-dom";
import Dashboard from "./pages/dashboard";
import Schedule from "./pages/Schedule";
import Login from "./pages/login";
import "./index.css";
import "./App.css";

export default function App() {
  const [user, setUser] = useState(null);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    const confirmed = window.confirm("Are you sure you want to logout?");
    if (confirmed) {
      setUser(null);
    }
  };

  // If user is not logged in, show login page
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      {/* ===== TOP NAVIGATION BAR ===== */}
      <nav style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "20px",
        padding: "16px 32px",
        position: "sticky",
        top: 0,
        zIndex: 100
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px"
        }}>
          <span style={{
            fontSize: "28px",
            filter: "drop-shadow(0 0 10px rgba(59, 130, 246, 0.8))"
          }}>💊</span>
          <span style={{
            fontSize: "20px",
            fontWeight: "700",
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "0.5px"
          }}>
            PillPal
          </span>
        </div>

        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <Link to="/">
            Dashboard
          </Link>

          <Link className="addMedicine" to="/schedule">
            + Add Medicine
          </Link>

          <div style={{
            height: "24px",
            width: "1px",
            background: "rgba(59, 130, 246, 0.3)"
          }} />

          <span style={{
            color: "#94a3b8",
            fontSize: "14px",
            fontWeight: "500"
          }}>
            👤 {user.username}
          </span>

          <button
            onClick={handleLogout}
            style={{
              padding: "8px 20px",
              background: "linear-gradient(135deg, #ef4444, #dc2626)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "12px",
              boxShadow: "0 4px 15px rgba(239, 68, 68, 0.4)"
            }}
          >
            Logout
          </button>
        </div>
      </nav>

      {/* ===== ROUTES ===== */}
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}