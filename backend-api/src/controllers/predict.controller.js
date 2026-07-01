async function predict(req, res) {
  try {
    const { language, mode, landmarks, imageBase64, videoBase64 } = req.body;

    if (!language || !mode) {
      return res.status(400).json({
        message: "language and mode are required",
      });
    }

    if (!landmarks && !imageBase64 && !videoBase64) {
      return res.status(400).json({
        message: "landmarks, imageBase64, or videoBase64 is required",
      });
    }

    const modelServiceUrl = process.env.MODEL_SERVICE_URL || "http://127.0.0.1:8000";
    console.log("Forwarding prediction request to model service", {
      modelServiceUrl,
      language,
      mode,
      hasLandmarks: Boolean(landmarks),
      hasImage: Boolean(imageBase64),
      hasVideo: Boolean(videoBase64),
    });

    try {
      const response = await fetch(`${modelServiceUrl}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ language, mode, landmarks, imageBase64, videoBase64 }),
      });

      if (!response.ok) {
        throw new Error(`Model service responded with ${response.status}`);
      }

      const result = await response.json();
      return res.status(200).json(result);
    } catch (serviceError) {
      console.error("Model service request failed:", serviceError);
      return res.status(503).json({
        message:
          "Model service unavailable. Please start the model service on http://127.0.0.1:8000 or set MODEL_SERVICE_URL.",
      });
    }
  } catch (error) {
    console.error("predict error:", error);
    return res.status(500).json({ message: "Failed to process prediction request" });
  }
}

module.exports = {
  predict,
};
