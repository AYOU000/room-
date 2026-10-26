import express from "express";
import { AccessToken } from "livekit-server-sdk";
import cors from "cors";
export const app = express();

app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173",
  }),
);
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "room-api",
  });
});

app.post("/api/rooms/token", async (req, res) => {
  const roomName =
    typeof req.body?.roomName === "string"
      ? req.body.roomName.trim()
      : "";

  const identity =
    typeof req.body?.identity === "string"
      ? req.body.identity.trim()
      : "";

  const validName = /^[a-zA-Z0-9_-]{1,64}$/;

  if (!validName.test(roomName) || !validName.test(identity)) {
    res.status(400).json({
      error:
        "roomName and identity must contain 1–64 letters, numbers, underscores, or hyphens.",
    });
    return;
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    res.status(500).json({
      error: "LiveKit credentials are not configured.",
    });
    return;
  }

  try {
    const accessToken = new AccessToken(apiKey, apiSecret, {
      identity,
      ttl: "10m",
    });

    accessToken.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await accessToken.toJwt();

    res.status(200).json({
      serverUrl:
        process.env.LIVEKIT_PUBLIC_URL ?? "ws://localhost:7880",
      roomName,
      identity,
      token,
    });
  } catch (error) {
    console.error("Failed to generate LiveKit token:", error);

    res.status(500).json({
      error: "Could not generate a room token.",
    });
  }
});