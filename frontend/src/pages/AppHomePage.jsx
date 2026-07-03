import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import api from "../services/api";
import { useCamera } from "../utils/useCamera";
import EducationTab from "./EducationTab";

function AppHomePage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("chat");
  const [language, setLanguage] = useState("en");
  const [mode, setMode] = useState("letters");
  const [predictedText, setPredictedText] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [roomId, setRoomId] = useState("");
  const roomIdRef = useRef("");
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  const [chatStatus, setChatStatus] = useState("Choose a user to start chat.");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const {
    videoRef,
    cameraOn,
    status,
    setStatus,
    videoDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    startCamera,
    stopCamera,
    captureImageBase64,
    recordVideoBase64,
  } = useCamera();

  const socketRef = useRef(null);
  const chatEndRef = useRef(null);

  const handlePredict = async () => {
    let payload = { language, mode };

    if (mode === "words") {
      setSending(true);
      setStatus("Recording sign for 2.5 seconds...");
      try {
        const videoBase64 = await recordVideoBase64(2500);
        if (!videoBase64) {
          setStatus("Start camera first, then click Translate.");
          setSending(false);
          return;
        }
        payload.videoBase64 = videoBase64;
      } catch (err) {
        setStatus("Could not record video.");
        setSending(false);
        return;
      }
    } else {
      const imageBase64 = captureImageBase64();
      if (!imageBase64) {
        setStatus("Start camera first, then click Translate.");
        return;
      }
      payload.imageBase64 = imageBase64;
      setSending(true);
    }

    setStatus("Translating sign...");
    try {
      const res = await api.post("/predict", payload);
      const prediction = res.data?.prediction || {};
      const text = prediction.text || "";
      if (prediction.action === "delete") {
        setPredictedText((prev) => prev.slice(0, -1));
        setStatus(`Deleted last character (${Math.round((prediction.confidence || 0) * 100)}%)`);
        return;
      }
      if (!text) {
        setStatus(prediction.message || res.data?.message || "No sign detected. Try again.");
        return;
      }
      setPredictedText((prev) => {
        const appended = mode === "words" ? `${text} ` : text;
        return prev ? `${prev}${appended}` : appended;
      });
      setStatus(
        `Sign translated: ${text} (${Math.round((prediction.confidence || 0) * 100)}%)`
      );
    } catch (err) {
      setStatus(err.response?.data?.message || "Translation failed");
    } finally {
      setSending(false);
    }
  };

  const handleSendToChat = () => {
    if (!predictedText.trim()) return;
    if (!roomId || !socketRef.current) {
      setChatStatus("Join a chat first.");
      return;
    }

    socketRef.current.emit(
      "chat:send",
      { roomId, content: predictedText, contentType: "TEXT" },
      (ack) => {
        if (!ack?.ok) {
          setChatStatus(ack?.message || "Failed to send message");
          return;
        }
        setPredictedText("");
      }
    );
  };

  const joinChat = () => {
    if (!selectedUserId || !socketRef.current) {
      setChatStatus("Select a user first.");
      return;
    }

    socketRef.current.emit("chat:join", { targetUserId: selectedUserId }, (ack) => {
      if (!ack?.ok) {
        setChatStatus(ack?.message || "Failed to join room.");
        return;
      }

      const chosen = users.find((item) => item.id === selectedUserId);
      setRoomId(ack.roomId);
      setMessages(ack.messages || []);
      setChatStatus(`Chat joined with ${chosen?.name || "user"}.`);
    });
  };

  useEffect(() => {
    setUsersLoading(true);
    api
      .get("/users")
      .then((res) => {
        const list = res.data?.users || [];
        setUsers(list);
        if (list.length > 0) {
          setSelectedUserId(list[0].id);
        }
      })
      .catch(() => setChatStatus("Could not load users."))
      .finally(() => setUsersLoading(false));
  }, []);

  // Auto-scroll chat to newest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleLogout = () => {
    if (showLogoutConfirm) {
      logout();
    } else {
      setShowLogoutConfirm(true);
      // Auto-reset after 3 seconds if user doesn't confirm
      setTimeout(() => setShowLogoutConfirm(false), 3000);
    }
  };

  const handleChatKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && predictedText.trim()) {
      e.preventDefault();
      handleSendToChat();
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("slr_token");
    if (!token) return undefined;

    const socket = io("http://localhost:3000", { auth: { token } });

    socket.on("connect", () => {
      setChatStatus("Connected. Select a user to chat.");
    });

    socket.on("chat:receive", (message) => {
      setMessages((prev) => {
        if (roomIdRef.current && message.roomId !== roomIdRef.current) return prev;
        if (prev.some((item) => item.id === message.id)) return prev;
        return [...prev, message];
      });
    });

    socket.on("connect_error", (error) => {
      setChatStatus(`Socket error: ${error.message}`);
    });

    socketRef.current = socket;
    return () => socket.disconnect();
  }, []);

  return (
    <main className="page-shell">
      <div className="card wide">
        <div className="header-row">
          <div className="logo-row header-logo-row">
            <img src="/eshara-logo.png" className="site-logo" alt="Eshara Logo" />
            <div>
              <h2 style={{ margin: 0 }}>Hello, {user?.name}</h2>
              <p className="logo-tagline" style={{ margin: 0 }}>Sign language letters and chat assistant</p>
            </div>
          </div>
          <div className="header-actions">
            <button type="button" className="theme-toggle" onClick={toggleTheme}>
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              onBlur={() => setShowLogoutConfirm(false)}
              className={showLogoutConfirm ? "logout-confirm" : ""}
            >
              {showLogoutConfirm ? "Sure? Click again" : "Logout"}
            </button>
          </div>
        </div>

        <div className="tabs">
          <button
            className={activeTab === "chat" ? "active" : ""}
            onClick={() => setActiveTab("chat")}
            type="button"
          >
            Chatting
          </button>
          <button
            className={activeTab === "educational" ? "active" : ""}
            onClick={() => setActiveTab("educational")}
            type="button"
          >
            Educational
          </button>
        </div>

        {activeTab === "chat" ? (
          <div className="app-grid">
            <section className="tab-panel">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label className="label">Language</label>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                    <option value="en">English (ASL)</option>
                    <option value="ar">Arabic (ArSL)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Mode</label>
                  <select value={mode} onChange={(e) => setMode(e.target.value)}>
                    <option value="letters">Letters</option>
                    <option value="words">Words</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "center" }}>
                {videoDevices.length > 0 && (
                  <div style={{ flex: 1 }}>
                    <label className="label" htmlFor="camera-device">
                      Camera device
                    </label>
                    <select
                      id="camera-device"
                      value={selectedDeviceId}
                      onChange={(e) => setSelectedDeviceId(e.target.value)}
                      style={{ width: "100%" }}
                    >
                      {videoDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Camera ${device.deviceId}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="video-placeholder" style={{ position: "relative", width: "100%", aspectRatio: "4/3" }}>
                <video ref={videoRef} autoPlay playsInline muted className="camera-view" style={{ transform: "scaleX(-1)" }} />
                {!cameraOn && (
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      zIndex: 10,
                    }}
                  >
                    Camera Off
                  </div>
                )}
              </div>

              <div className="controls">
                <button type="button" onClick={startCamera}>
                  Start Camera
                </button>
                <button type="button" onClick={stopCamera}>
                  End Camera
                </button>
                <button type="button" onClick={handlePredict} disabled={sending}>
                  {sending ? "Translating..." : "Translate Sign"}
                </button>
              </div>

              <p className="status-text">{status}</p>
            </section>

            <section
              className="chat-section"
              style={{
                display: "flex",
                flexDirection: "column",
                background: "var(--chat-bg)",
                borderRadius: "16px",
                padding: "16px",
              }}
            >
              <h3 style={{ margin: "0 0 16px 0", fontSize: "1.1rem", color: "var(--primary)" }}>Live Chat</h3>

              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} style={{ flex: 1 }}>
                  {usersLoading && <option value="">Loading users...</option>}
                  {!usersLoading && users.length === 0 && <option value="">No users available</option>}
                  {users.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={joinChat} style={{ width: "auto" }} disabled={usersLoading}>
                  {usersLoading ? "..." : "Join"}
                </button>
              </div>

              <div
                className="chat-log"
                style={{
                  flex: 1,
                  overflowY: "auto",
                  minHeight: "300px",
                  maxHeight: "400px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  paddingRight: "8px",
                  marginBottom: "16px",
                }}
              >
                {messages.length === 0 ? (
                  <p
                    style={{
                      color: "var(--text-muted)",
                      textAlign: "center",
                      marginTop: "auto",
                      marginBottom: "auto",
                    }}
                  >
                    {roomId ? "No messages yet. Start translating signs to send the first message!" : "No messages yet. Join a user and start chatting."}
                  </p>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.sender?.id === user.id;
                    return (
                      <div
                        key={msg.id}
                        style={{ alignSelf: isMe ? "flex-end" : "flex-start", maxWidth: "85%" }}
                      >
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                            marginBottom: "4px",
                            textAlign: isMe ? "right" : "left",
                          }}
                        >
                          {msg.sender?.name || "Unknown"}
                        </div>
                        <div
                          style={{
                            background: isMe
                              ? "var(--chat-msg-me-bg)"
                              : "var(--chat-msg-other-bg)",
                            color: isMe
                              ? "var(--chat-msg-me-color)"
                              : "var(--chat-msg-other-color)",
                            padding: "10px 14px",
                            borderRadius: "12px",
                            borderBottomRightRadius: isMe ? "4px" : "12px",
                            borderTopLeftRadius: !isMe ? "4px" : "12px",
                          }}
                        >
                          {msg.content}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
                <input
                  value={predictedText}
                  onChange={(e) => setPredictedText(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  placeholder="Type or translate a sign..."
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={handleSendToChat}
                  disabled={!predictedText.trim()}
                  style={{ width: "auto", padding: "10px 16px", background: "#EC4899" }}
                >
                  Send
                </button>
              </div>
              <p className="status-text" style={{ marginTop: "8px" }}>
                {chatStatus}
              </p>
            </section>
          </div>
        ) : (
          <EducationTab />
        )}
      </div>
    </main>
  );
}

export default AppHomePage;
