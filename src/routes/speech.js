import { Router } from "express";
import multer from "multer";
import { extname } from "node:path";
import requireAuth from "../middleware/requireAuth.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB upload limit
});

// These routes require the user to be logged in.
router.use(requireAuth);

// POST /speech/stt
// Send a file using the form-data field name "audio".
router.post("/stt", upload.single("audio"), async (req, res) => {
  try {
    if (!process.env.GNANI_API_KEY_ID) {
      return res.status(500).json({ error: "Gnani API key is not configured" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Choose an audio file" });
    }

    const allowedExtensions = new Set([".wav", ".mp3", ".ogg", ".flac", ".aac", ".m4a"]);
    const extension = extname(req.file.originalname).toLowerCase();
    if (!allowedExtensions.has(extension)) {
      return res.status(400).json({
        error: "Audio must be WAV, MP3, OGG, FLAC, AAC, or M4A",
      });
    }

    const languageCode = String(req.body?.language_code || "hi-IN");
    const model = String(req.body?.model || "prisma-v2.5");

    if (!["prisma-v2.5", "prisma-v3.0"].includes(model)) {
      return res.status(400).json({ error: "Unsupported STT model" });
    }

    const form = new FormData();
    const audioBlob = new Blob([req.file.buffer], {
      type: req.file.mimetype || "application/octet-stream",
    });

    form.append("audio_file", audioBlob, req.file.originalname);
    form.append("language_code", languageCode);

    if (model === "prisma-v3.0") {
      form.append("model", model);
    }

    const gnaniResponse = await fetch("https://api.vachana.ai/stt/v3", {
      method: "POST",
      headers: {
        "X-API-Key-ID": process.env.GNANI_API_KEY_ID,
      },
      body: form,
    });

    const responseText = await gnaniResponse.text();
    let result;

    try {
      result = JSON.parse(responseText);
    } catch {
      result = { message: responseText };
    }

    if (!gnaniResponse.ok) {
      return res.status(gnaniResponse.status).json({
        error: "Gnani STT request failed",
        details: result,
      });
    }

    return res.json(result);
  } catch (error) {
    console.error("STT error:", error);
    return res.status(500).json({ error: "Could not transcribe audio" });
  }
});

router.post("/tts", async (req, res) => {
  try {
    if (!process.env.GNANI_API_KEY_ID) {
      return res.status(500).json({ error: "Gnani API key is not configured" });
    }

    const text = String(req.body?.text || "").trim();
    const voice = String(req.body?.voice || "");
    const model = String(req.body?.model || "timbre-v2.5");
    const language = String(req.body?.language || "hi-IN");

    if (!text || !voice) {
      return res.status(400).json({
        error: "Provide text and a voice name",
      });
    }

    if (!["timbre-v2.5", "timbre-v3.0"].includes(model)) {
      return res.status(400).json({ error: "Unsupported TTS model" });
    }

    const gnaniResponse = await fetch(
      "https://api.vachana.ai/api/v1/tts/inference",
      {
        method: "POST",
        headers: {
          "X-API-Key-ID": process.env.GNANI_API_KEY_ID,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          voice,
          model,
          language,
          speed: 1.0,
          audio_config: {
            sample_rate: 48000,
            num_channels: 1,
            sample_width: 2,
            encoding: "linear_pcm",
            container: "wav",
          },
        }),
      }
    );

    if (!gnaniResponse.ok) {
      const details = await gnaniResponse.text();
      return res.status(gnaniResponse.status).json({
        error: "Gnani TTS request failed",
        details,
      });
    }

    const audio = Buffer.from(await gnaniResponse.arrayBuffer());
    res.set("Content-Type", gnaniResponse.headers.get("content-type") || "audio/wav");
    return res.send(audio);
  } catch (error) {
    console.error("TTS error:", error);
    return res.status(500).json({ error: "Could not generate speech" });
  }
});

// Multer runs before the STT route handler, so handle upload errors here.
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return res.status(status).json({ error: error.message });
  }

  return next(error);
});

export default router;
