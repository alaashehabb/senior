import { useEffect, useRef, useState } from "react";

// Shared webcam lifecycle used by both the live Chatting tab and the
// Education tab's Practice Mode: start/stop the stream, enumerate devices,
// and grab either a single JPEG frame (letters) or a short recorded clip
// (words) to send to /predict. Extracted from AppHomePage.jsx so both
// consumers share one implementation instead of drifting independently.
export function useCamera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [status, setStatus] = useState("Camera is off");
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");

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

  // Stop the stream if this consumer unmounts with the camera still running.
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

  return {
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
  };
}
