import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { Hands, HAND_CONNECTIONS } from "@mediapipe/hands";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { io } from "socket.io-client";

function AppHomePage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("chat");
  const [language, setLanguage] = useState("en");
  const [mode, setMode] = useState("letters");
  const [predictedText, setPredictedText] = useState("");
  const [status, setStatus] = useState("Camera is off");
  const [sending, setSending] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [messages, setMessages] = useState([]);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const handsRef = useRef(null);
  const requestRef = useRef(null);
  const lastLandmarksRef = useRef(null);
  const socketRef = useRef(null);

  // Initialize Socket.IO
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const socket = io("http://localhost:5000", {
      auth: { token },
    });

    socket.on("connect", () => {
      console.log("Connected to chat server");
    });

    socket.on("chat:message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  const initMediaPipe = useCallback(() => {
    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    hands.onResults((results) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      const ctx = canvas.getContext("2d");
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 3 });
        drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 1, radius: 4 });

        const flatLandmarks = [];
        for (const lm of landmarks) {
          flatLandmarks.push(lm.x, lm.y, lm.z);
        }
        lastLandmarksRef.current = flatLandmarks;
      } else {
        lastLandmarksRef.current = null;
      }
      ctx.restore();
    });

    handsRef.current = hands;
  }, []);

  const detectFrame = useCallback(async () => {
    if (videoRef.current && handsRef.current && cameraOn) {
      if (videoRef.current.readyState >= 2) {
        await handsRef.current.send({ image: videoRef.current });
      }
    }
    requestRef.current = requestAnimationFrame(detectFrame);
  }, [cameraOn]);

  const startCamera = async () => {
    try {
      setStatus("Initializing MediaPipe...");
      if (!handsRef.current) {
        initMediaPipe();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setCameraOn(true);
          setStatus("Camera is ready. Detecting hands...");
          requestRef.current = requestAnimationFrame(detectFrame);
        };
      }
    } catch (_error) {
      setStatus("Cannot access camera. Please allow webcam permission.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setCameraOn(false);
    lastLandmarksRef.current = null;
    setStatus("Camera is off");
  };

  const handlePredict = async () => {
    if (!cameraOn) {
      setStatus("Start camera first.");
      return;
    }

    const landmarks = lastLandmarksRef.current;
    if (!landmarks || landmarks.length !== 63) {
      setStatus("No hand detected. Please hold your sign clearly.");
      return;
    }

    setSending(true);
    setStatus("Translating sign...");
    try {
      const res = await api.post("/predict", { language, mode, landmarks });
      const text = res.data?.prediction?.text || "";
      setPredictedText((prev) => prev ? `${prev} ${text}` : text);
      setStatus(`Sign translated: ${text} (${Math.round((res.data?.prediction?.confidence || 0)*100)}%)`);
    } catch (err) {
      setStatus(err.response?.data?.message || "Translation failed");
    } finally {
      setSending(false);
    }
  };

  const handleSendToChat = () => {
    if (!predictedText.trim()) return;
    
    // Add locally to UI
    const newMsg = {
      id: Date.now(),
      senderName: user.name,
      content: predictedText,
      isMe: true,
    };
    setMessages((prev) => [...prev, newMsg]);
    
    // Send via socket
    if (socketRef.current) {
      socketRef.current.emit("chat:message", { content: predictedText });
    }
    
    setPredictedText("");
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <main className="page-shell">
      <div className="card wide">
        <div className="header-row">
          <h2>Hello, {user?.name}</h2>
          <button type="button" onClick={logout}>
            Logout
          </button>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px' }}>
            {/* Left Column: Camera and Prediction */}
            <section className="tab-panel">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="label">Language</label>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{marginTop: '12px'}}>
                    <option value="en">English (ASL)</option>
                    <option value="ar">Arabic (ArSL)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Mode</label>
                  <select value={mode} onChange={(e) => setMode(e.target.value)} style={{marginTop: '12px'}}>
                    <option value="letters">Letters</option>
                    <option value="words">Words</option>
                  </select>
                </div>
              </div>

              <div className="video-placeholder" style={{ position: 'relative', width: '100%', aspectRatio: '4/3' }}>
                <video ref={videoRef} playsInline muted style={{ display: 'none' }} />
                <canvas ref={canvasRef} width="640" height="480" className="camera-view" />
                {!cameraOn && (
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
                    Camera Off
                  </div>
                )}
              </div>

              <div className="controls">
                <button type="button" onClick={startCamera}>Start Camera</button>
                <button type="button" onClick={stopCamera}>End Camera</button>
                <button type="button" onClick={handlePredict} disabled={sending}>
                  {sending ? "Translating..." : "Translate Sign"}
                </button>
              </div>

              <p className="status-text">{status}</p>
            </section>

            {/* Right Column: Chat Box */}
            <section className="chat-section" style={{ display: 'flex', flexDirection: 'column', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '16px', padding: '16px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#A78BFA' }}>Live Chat</h3>
              
              <div className="chat-log" style={{ flex: 1, overflowY: 'auto', minHeight: '300px', maxHeight: '400px', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '8px', marginBottom: '16px' }}>
                {messages.length === 0 ? (
                  <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 'auto', marginBottom: 'auto' }}>No messages yet. Start translating signs!</p>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} style={{ alignSelf: msg.isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                      <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '4px', textAlign: msg.isMe ? 'right' : 'left' }}>
                        {msg.senderName}
                      </div>
                      <div style={{ background: msg.isMe ? 'linear-gradient(135deg, #4F46E5, #818CF8)' : 'rgba(255, 255, 255, 0.1)', padding: '10px 14px', borderRadius: '12px', borderBottomRightRadius: msg.isMe ? '4px' : '12px', borderTopLeftRadius: !msg.isMe ? '4px' : '12px' }}>
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                <input 
                  value={predictedText} 
                  onChange={(e) => setPredictedText(e.target.value)}
                  placeholder="Type or translate a sign..." 
                  style={{ flex: 1 }} 
                />
                <button 
                  type="button" 
                  onClick={handleSendToChat} 
                  disabled={!predictedText.trim()}
                  style={{ width: 'auto', padding: '10px 16px', background: '#EC4899' }}
                >
                  Send
                </button>
              </div>
            </section>
          </div>
        ) : (
          <section className="tab-panel">
            <h3>Educational module</h3>
            <p>Exercises and guided learning will be added in the next steps.</p>
          </section>
        )}
      </div>
    </main>
  );
}

export default AppHomePage;
