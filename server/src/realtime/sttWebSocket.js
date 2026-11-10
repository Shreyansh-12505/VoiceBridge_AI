import jwt from "jsonwebtoken";
import { WebSocket, WebSocketServer } from "ws";

const GNANI_STT_URL = "wss://api.vachana.ai/stt/v3/stream";
const REALTIME_PATH = "/speech/realtime";
const ALLOWED_LANGUAGES = new Set([
  "bn-IN", "en-IN", "gu-IN", "hi-IN", "kn-IN", "ml-IN", "mr-IN",
  "pa-IN", "ta-IN", "te-IN",
]);
const ALLOWED_SAMPLE_RATES = new Set([8000, 16000, 44100, 48000]);

function rejectUpgrade(socket, status, message) {
  const statusText = status === 401
    ? "Unauthorized"
    : status === 403
      ? "Forbidden"
      : status === 500
        ? "Internal Server Error"
        : "Bad Request";
  socket.write(
    `HTTP/1.1 ${status} ${statusText}\r\nConnection: close\r\nContent-Type: text/plain\r\n\r\n${message}`
  );
  socket.destroy();
}

function getToken(request, requestUrl) {
  // 1. Check query parameter first (fixes cross-domain WebSocket issues)
  const queryToken = requestUrl.searchParams.get("token");
  if (queryToken) return queryToken;

  // 2. Fall back to reading from the cookie header
  const cookieHeader = request.headers.cookie || "";
  const tokenPair = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("token="));

  if (!tokenPair) return null;

  try {
    return decodeURIComponent(tokenPair.slice("token=".length));
  } catch {
    return null;
  }
}

function isOriginAllowed(origin) {
  if (!origin) return true;

  const configuredOrigins = (process.env.FRONTEND_ORIGIN || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (configuredOrigins.length) return configuredOrigins.includes(origin);

  try {
    const hostname = new URL(origin).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function getStreamSettings(url) {
  const params = url.searchParams;
  const model = params.get("model") || "prisma-v2.5";
  const languageCode = params.get("language_code") || "hi-IN";
  const sampleRate = Number(params.get("sample_rate") || 16000);
  const format = params.get("format") || "verbatim";

  if (!["prisma-v2.5", "prisma-v3.0"].includes(model)) {
    return { error: "model must be prisma-v2.5 or prisma-v3.0" };
  }

  if (!ALLOWED_SAMPLE_RATES.has(sampleRate)) {
    return { error: "sample_rate must be 8000, 16000, 44100, or 48000" };
  }

  const languages = languageCode.split(",").map((code) => code.trim());
  if (languageCode === "indic-auto") {
    if (model !== "prisma-v3.0") {
      return { error: "indic-auto requires model=prisma-v3.0" };
    }
  } else if (
    languages.length > (model === "prisma-v3.0" ? 4 : 1) ||
    languages.some((code) => !ALLOWED_LANGUAGES.has(code))
  ) {
    return { error: "language_code must contain supported language codes for the selected model" };
  }

  const allowedFormats = model === "prisma-v3.0"
    ? new Set(["verbatim", "transcribe", "codemix", "transliterate"])
    : new Set(["verbatim", "transcribe"]);
  if (!allowedFormats.has(format)) {
    return { error: `format is not supported for ${model}` };
  }

  return { model, languageCode, sampleRate, format };
}

export default function attachRealtimeSTT(server) {
  const browserSockets = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });

  server.on("upgrade", (request, socket, head) => {
    let requestUrl;
    try {
      requestUrl = new URL(request.url, "http://localhost");
    } catch {
      return rejectUpgrade(socket, 400, "Invalid WebSocket request");
    }

    if (requestUrl.pathname !== REALTIME_PATH) return;

    if (!isOriginAllowed(request.headers.origin)) {
      return rejectUpgrade(socket, 403, "Origin is not allowed");
    }

    const token = getToken(request, requestUrl);
    if (!token || !process.env.JWT_SECRET) {
      return rejectUpgrade(socket, 401, "Please log in first");
    }

    try {
      jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return rejectUpgrade(socket, 401, "Your login has expired");
    }

    if (!process.env.GNANI_API_KEY_ID) {
      return rejectUpgrade(socket, 500, "Gnani API key is not configured");
    }

    const settings = getStreamSettings(requestUrl);
    if (settings.error) {
      return rejectUpgrade(socket, 400, settings.error);
    }

    browserSockets.handleUpgrade(request, socket, head, (browserSocket) => {
      const upstreamUrl = new URL(GNANI_STT_URL);
      const upstreamHeaders = {
        "x-api-key-id": process.env.GNANI_API_KEY_ID,
        language_code: settings.languageCode,
        "x-sample-rate": String(settings.sampleRate),
        format: settings.format,
      };
      if (settings.model !== "prisma-v2.5") upstreamHeaders.model = settings.model;

      const gnaniSocket = new WebSocket(upstreamUrl, { headers: upstreamHeaders });
      let upstreamReady = false;

      browserSocket.on("message", (data, isBinary) => {
        if (gnaniSocket.readyState !== WebSocket.OPEN || !upstreamReady) {
          browserSocket.close(1013, "Wait for the STT connection to become ready");
          return;
        }

        if (isBinary && data.length !== 1024) {
          browserSocket.close(1003, "Send PCM audio in 1024-byte frames");
          gnaniSocket.close();
          return;
        }

        gnaniSocket.send(data, { binary: isBinary });
      });

      gnaniSocket.on("open", () => {
        upstreamReady = true;
      });

      gnaniSocket.on("message", (data, isBinary) => {
        if (browserSocket.readyState === WebSocket.OPEN) {
          browserSocket.send(data, { binary: isBinary });
        }
      });

      gnaniSocket.on("error", (error) => {
        console.error("Gnani realtime STT error:", error.message);
        if (browserSocket.readyState === WebSocket.OPEN) {
          browserSocket.close(1011, "Could not connect to Gnani STT");
        }
      });

      browserSocket.on("error", (error) => {
        console.error("Realtime client WebSocket error:", error.message);
      });

      browserSocket.on("close", () => {
        if (gnaniSocket.readyState === WebSocket.OPEN || gnaniSocket.readyState === WebSocket.CONNECTING) {
          gnaniSocket.close();
        }
      });

      gnaniSocket.on("close", (code, reason) => {
        if (browserSocket.readyState === WebSocket.OPEN) {
          const standardCode = code === 1000 || code === 1001 ||
            (code >= 1002 && code <= 1014 && ![1004, 1005, 1006].includes(code));
          const applicationCode = code >= 3000 && code <= 4999;
          const closeCode = standardCode || applicationCode ? code : 1011;
          browserSocket.close(closeCode, reason.toString().slice(0, 100));
        }
      });
    });
  });

  return browserSockets;
}