import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import api from "../services/api";
import ASLStickman from "../components/ASLStickman";
import ASLWordStickman from "../components/ASLWordStickman";

function AppHomePage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("chat");
  const [language, setLanguage] = useState("en");
  const [mode, setMode] = useState("letters");
  const [predictedText, setPredictedText] = useState("");
  const [status, setStatus] = useState("Camera is off");
  const [sending, setSending] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [chatStatus, setChatStatus] = useState("Choose a user to start chat.");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const socketRef = useRef(null);
  const chatEndRef = useRef(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOn(false);
    setStatus("Camera is off");
  };

  const startCamera = async () => {
    try {
      const videoConstraints = selectedDeviceId
        ? { deviceId: { exact: selectedDeviceId }, width: 640, height: 480 }
        : { facingMode: "user", width: 640, height: 480 };

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraOn(true);
      setStatus("Camera is ready");
    } catch (error) {
      console.error("Camera access error:", error);
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setStatus(
          "📷 Camera access denied. Please click the camera icon in your browser's address bar, allow access, and refresh the page."
        );
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        setStatus("📷 No camera found. Please connect a webcam and try again.");
      } else {
        setStatus("📷 Cannot access camera. Please check your device settings and try again.");
      }
    }
  };

  const captureImageBase64 = () => {
    const video = videoRef.current;
    if (!video || !cameraOn) return null;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  };

  const recordVideoBase64 = (durationMs) => {
    return new Promise((resolve, reject) => {
      const video = videoRef.current;
      if (!video || !video.srcObject) return resolve(null);

      try {
        const stream = video.srcObject;
        const mediaRecorder = new MediaRecorder(stream);
        const chunks = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks);
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("Failed to read video blob"));
        };

        mediaRecorder.start();
        setTimeout(() => {
          if (mediaRecorder.state === "recording") {
            mediaRecorder.stop();
          }
        }, durationMs);
      } catch (err) {
        reject(err);
      }
    });
  };

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

  useEffect(() => stopCamera, []);

  useEffect(() => {
    async function loadVideoDevices() {
      if (!navigator.mediaDevices?.enumerateDevices) {
        setStatus("Your browser does not support webcam device selection.");
        return;
      }

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((device) => device.kind === "videoinput");
        setVideoDevices(videoInputs);

        if (videoInputs.length === 0) {
          setStatus("No camera devices found.");
          return;
        }

        const internalCamera = videoInputs.find((device) =>
          /integrated|internal|built-in|front|face/i.test(device.label)
        );

        setSelectedDeviceId(internalCamera?.deviceId || videoInputs[0].deviceId);
      } catch (error) {
        console.error("Failed to enumerate camera devices:", error);
      }
    }

    loadVideoDevices();
  }, []);

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
                    No messages yet. Join a user and start chatting.
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
          <section className="tab-panel">
            <div className="edu-intro">
              <h3 style={{ margin: 0 }}>Learn to Sign</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: 0 }}>
                Practice ASL two ways: fingerspell any word letter-by-letter, or watch the
                stickman sign common everyday words. Each sign shows a plain-language cue —
                tap a letter to freeze on its handshape.
              </p>
            </div>

            <div className="edu-grid">
              {/* Left: letter fingerspelling */}
              <div className="edu-col">
                <h4 className="edu-col-title" style={{ color: "var(--primary)" }}>
                  Fingerspelling · A–Z
                </h4>
                <p className="edu-col-sub">
                  Type a word and press Play to spell it out. The hand morphs smoothly between
                  letters; J and Z are traced in the air.
                </p>
                <ASLStickman />
              </div>

              {/* Right: full-body word signing */}
              <div className="edu-col">
                <h4 className="edu-col-title" style={{ color: "var(--secondary)" }}>
                  Word Signs · Full Body
                </h4>
                <p className="edu-col-sub">
                  Pick a word and watch the full-body sign. Use 🐢 Slow to study the motion,
                  then ⚡ Normal for natural speed.
                </p>
                <ASLWordStickman />
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

export default AppHomePage;
