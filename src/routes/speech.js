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

    const model = String(req.body?.model || "prisma-v2.5");
    
    const defaultLang=model==="prisma-v3.0" ? "indic-auto" : "hi-IN";
       const languageCode = String(req.body?.language_code || defaultLang);

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


router.post("/stt/batch", upload.single("audio"), async (req, res) => {
  try {
    if (!process.env.GNANI_API_KEY_ID) {
      return res.status(500).json({ error: "Gnani API key is not configured" });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: "Choose an audio file" });
    }

    const languageCode = String(req.body?.language_code || "indic-auto");
    const model = String(req.body?.model || "prisma-v3.0");

    const form = new FormData();
    const audioBlob = new Blob([req.file.buffer], {
      type: req.file.mimetype || "application/octet-stream",
    });

    form.append("audio_file", audioBlob, req.file.originalname);
    form.append("language_code", languageCode);
    form.append("model", model);

    const createResponse = await fetch("https://api.vachana.ai/stt/v3/batch/jobs", {
      method: "POST",
      headers: { "X-API-Key-ID": process.env.GNANI_API_KEY_ID },
      body: form,
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      return res.status(createResponse.status).json({ error: "Failed to create job", details: errorText });
    }

    const jobData = await createResponse.json();
    const gnaniJobId = jobData.job_id;

    const startResponse = await fetch(`https://api.vachana.ai/stt/v3/batch/jobs/${gnaniJobId}/start`, {
      method: "POST",
      headers: { "X-API-Key-ID": process.env.GNANI_API_KEY_ID },
    });

    if (!startResponse.ok) {
      return res.status(startResponse.status).json({ error: "Failed to start job on Gnani servers" });
    }

    return res.status(202).json({
      message: "Batch STT job successfully created and started.",
      gnaniJobId: gnaniJobId 
    });

  } catch (error) {
    console.error("Batch STT submission error:", error);
    return res.status(500).json({ error: "Could not process batch STT request" });
  }
});

router.get("/stt/batch/:id", async (req, res) => {
  try {
    const gnaniJobId = req.params.id; 

    const statusResponse = await fetch(`https://api.vachana.ai/stt/v3/batch/jobs/${gnaniJobId}`, {
      method: "GET",
      headers: { "X-API-Key-ID": process.env.GNANI_API_KEY_ID },
    });
    
    const statusData = await statusResponse.json();

    if (statusData.status === "COMPLETED") {
      const filesResponse = await fetch(`https://api.vachana.ai/stt/v3/batch/jobs/${gnaniJobId}/files`, {
        method: "GET",
        headers: { "X-API-Key-ID": process.env.GNANI_API_KEY_ID },
      });
      
      const filesData = await filesResponse.json();
      
      if (filesData.files && filesData.files.length > 0) {
        const transcriptUrl = filesData.files[0].transcript_url;

        const transcriptResponse = await fetch(transcriptUrl, {
            method: "GET",
        });
        
        const transcriptText = await transcriptResponse.json();

        return res.json({ 
            status: "completed", 
            transcript: transcriptText 
        });
      }
    } else if (statusData.status === "FAILED") {
        return res.json({ status: "failed" });
    }

    return res.json({ status: statusData.status });

  } catch (error) {
    console.error("Batch STT polling error:", error);
    return res.status(500).json({ error: "Could not check job status" });
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


router.post("/tts/stream", async (req, res) => {
  try {
    if (!process.env.GNANI_API_KEY_ID) {
      return res.status(500).json({ error: "Gnani API key is not configured" });
    }

    const text = String(req.body?.text || "").trim();
    const voice = String(req.body?.voice || "");
    const model = String(req.body?.model || "timbre-v2.5");
    const language = String(req.body?.language || "hi-IN");

    if (!text || !voice) {
      return res.status(400).json({ error: "Provide text and a voice name" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const gnaniResponse = await fetch("https://api.vachana.ai/api/v1/tts/sse", {
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
    });

    if (!gnaniResponse.ok) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: "Gnani SSE request failed" })}\n\n`);
      return res.end();
    }

    const reader = gnaniResponse.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
    }

    res.end();
  } catch (error) {
    console.error("TTS Streaming error:", error);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Could not stream audio" });
    }
    res.end();
  }
});


router.get("/voices", (req, res) => {
  const model = String(req.query?.model || "timbre-v3.0");

  const catalog = {
    
    "timbre-v3.0": {
      model: "timbre-v3.0",
      description: "Expressive audio-tagged multilingual voices",
      supportedLanguages: ["hi-IN", "en-IN", "ta-IN", "te-IN", "kn-IN", "ml-IN", "mr-IN", "pa-IN", "bn-IN", "gu-IN"],
      voices: [
        { name: "Avinash", gender: "Male" },
        { name: "Chetana", gender: "Female" },
        { name: "Devansh", gender: "Male" },
        { name: "Kalpana", gender: "Female" },
        { name: "Lakshmi", gender: "Female" },
        { name: "Prakash", gender: "Male" },
        { name: "Riyaa", gender: "Female" },
        { name: "Shivani", gender: "Female" },
        { name: "Shubham", gender: "Male" },
        { name: "Tarika", gender: "Female" },
        { name: "Vasudha", gender: "Female" },
        { name: "Yashraj", gender: "Male" },
      ],
    },

    "timbre-v2.5": {
      model: "timbre-v2.5",
      description: "Regional targeted voices",
      supportedLanguages: ["hi-IN", "en-IN", "ta-IN", "te-IN", "kn-IN", "ml-IN", "mr-IN", "pa-IN", "bn-IN", "gu-IN"],
      voices: [
        { name: "Nalini", gender: "Female", defaultLanguage: "hi-IN" },
        { name: "Kaveri", gender: "Female", defaultLanguage: "hi-IN" },
        { name: "Asmita", gender: "Female", defaultLanguage: "hi-IN" },
        { name: "Suhana", gender: "Female", defaultLanguage: "hi-IN" },
        { name: "Poorvi", gender: "Female", defaultLanguage: "hi-IN" },
        { name: "Deepak", gender: "Male", defaultLanguage: "hi-IN" },
      ],
    },
  };

  const selectedCatalog = catalog[model] || catalog["timbre-v3.0"];
  return res.json(selectedCatalog);
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
