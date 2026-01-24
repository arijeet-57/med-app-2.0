import { useState } from "react";
import "../index.css";
import "../App.css";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!username.trim()) {
      setError("Please enter your username");
      return;
    }

    if (!password.trim()) {
      setError("Please enter your password");
      return;
    }

    setLoading(true);

    // Simulate authentication delay
    setTimeout(() => {
      // Demo: Accept any credentials
      onLogin({ username: username.trim() });
      setLoading(false);
    }, 800);
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Animated Background Particles */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: "hidden",
        pointerEvents: "none"
      }}>
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: Math.random() * 4 + 2 + "px",
              height: Math.random() * 4 + 2 + "px",
              background: i % 3 === 0 ? "#3b82f6" : i % 3 === 1 ? "#8b5cf6" : "#10b981",
              borderRadius: "50%",
              top: Math.random() * 100 + "%",
              left: Math.random() * 100 + "%",
              opacity: Math.random() * 0.5 + 0.2,
              animation: `float ${Math.random() * 10 + 10}s linear infinite`,
              boxShadow: `0 0 ${Math.random() * 20 + 10}px currentColor`
            }}
          />
        ))}
      </div>

      <div style={{
        background: "rgba(30, 41, 59, 0.7)",
        backdropFilter: "blur(20px)",
        border: "2px solid rgba(59, 130, 246, 0.4)",
        borderRadius: "24px",
        padding: "48px",
        width: "100%",
        maxWidth: "480px",
        boxShadow: "0 20px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(59, 130, 246, 0.1) inset",
        position: "relative",
        zIndex: 1
      }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{
            fontSize: "80px",
            marginBottom: "16px",
            filter: "drop-shadow(0 0 30px rgba(59, 130, 246, 0.8))",
            animation: "float 3s ease-in-out infinite"
          }}>
            💊
          </div>
          
          <h1 style={{
            fontSize: "40px",
            fontWeight: "700",
            color: "#e2e8f0",
            marginBottom: "8px",
            letterSpacing: "-0.5px"
          }}>
            PillPal
          </h1>

          <h3 style={{
            fontWeight: "700",
            color: "#e2e8f0",
            marginBottom: "8px",
            letterSpacing: "-0.5px"
          }}>
            Smart Medical Assitant
          </h3>
          
          <p style={{
            color: "#94a3b8",
            fontSize: "14px",
            fontStyle: "italic",
            fontWeight: "400"
          }}>
            Healthcare meets technology
          </p>
          
          <div style={{
            width: "60px",
            height: "3px",
            background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
            margin: "16px auto 0",
            borderRadius: "10px"
          }} />
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            padding: "16px 20px",
            borderRadius: "12px",
            marginBottom: "24px",
            border: "2px solid #ef4444",
            background: "rgba(239, 68, 68, 0.2)",
            color: "#fca5a5",
            fontWeight: "500",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            animation: "shake 0.5s ease"
          }}>
            <span style={{ fontSize: "20px" }}>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          {/* Username Field */}
          <div style={{ marginBottom: "24px" }}>
            <label style={{
              display: "block",
              marginBottom: "8px",
              color: "#cbd5e1",
              fontWeight: "600",
              fontSize: "12px",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}>
              Username
            </label>
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px 18px",
                background: "rgba(15, 23, 42, 0.9)",
                border: "2px solid rgba(59, 130, 246, 0.3)",
                borderRadius: "12px",
                color: "#e2e8f0",
                fontSize: "16px",
                outline: "none",
                transition: "all 0.3s ease"
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#3b82f6";
                e.target.style.boxShadow = "0 0 20px rgba(59, 130, 246, 0.3)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "rgba(59, 130, 246, 0.3)";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>

          {/* Password Field */}
          <div style={{ marginBottom: "32px" }}>
            <label style={{
              display: "block",
              marginBottom: "8px",
              color: "#cbd5e1",
              fontWeight: "600",
              fontSize: "12px",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}>
              Password
            </label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px 18px",
                background: "rgba(15, 23, 42, 0.9)",
                border: "2px solid rgba(59, 130, 246, 0.3)",
                borderRadius: "12px",
                color: "#e2e8f0",
                fontSize: "16px",
                outline: "none",
                transition: "all 0.3s ease"
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#3b82f6";
                e.target.style.boxShadow = "0 0 20px rgba(59, 130, 246, 0.3)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "rgba(59, 130, 246, 0.3)";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "16px",
              background: loading 
                ? "linear-gradient(135deg, #475569, #334155)"
                : "linear-gradient(135deg, #3b82f6, #2563eb)",
              border: "none",
              borderRadius: "12px",
              color: "white",
              fontSize: "18px",
              fontWeight: "700",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.3s ease",
              boxShadow: loading 
                ? "0 4px 15px rgba(71, 85, 105, 0.4)"
                : "0 8px 24px rgba(59, 130, 246, 0.5)",
              textTransform: "uppercase",
              letterSpacing: "1px",
              position: "relative",
              overflow: "hidden"
            }}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>
                <span className="spinner" style={{
                  width: "20px",
                  height: "20px",
                  border: "3px solid rgba(255, 255, 255, 0.3)",
                  borderTop: "3px solid white",
                  borderRadius: "50%",
                  display: "inline-block"
                }} />
                Signing in...
              </span>
            ) : (
              "Login"
            )}
          </button>
        </form>

       

        {/* Footer */}
        <div style={{
          marginTop: "24px",
          textAlign: "center",
          color: "#64748b",
          fontSize: "12px"
        }}>
          <p style={{ margin: "4px 0" }}>Powered by Firebase & React</p>
          <p style={{ margin: "4px 0" }}>© 2025 MedAssist. All rights reserved.</p>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          33% {
            transform: translateY(-20px) rotate(5deg);
          }
          66% {
            transform: translateY(-10px) rotate(-5deg);
          }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}