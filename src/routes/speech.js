import { Router } from "express";
import multer from "multer";
import { extname } from "node:path";
import requireAuth from "../middleware/requireAuth.js";
import countCredits from "../middleware/checkCredits.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB upload limit
});

// These routes require the user to be logged in.
router.use(requireAuth);
router.use(countCredits)
// POST /speech/stt
// Send a file using the form-data field name "audio".
router.post("/stt", upload.single("audio"), async (req, res) => {
  const startTime = Date.now();
  
  const job = await ProcessingJob.create({
    userId: req.user._id,
    jobType: "STT_ONLY",
    status: "processing"
  });

  try {
    if (!process.env.GNANI_API_KEY_ID) {
      job.status = "failed";
      job.errorMessage = "Gnani API key is not configured";
      await job.save();
      return res.status(500).json({ error: "Gnani API key is not configured" });
    }

    if (!req.file) {
      job.status = "failed";
      job.errorMessage = "Choose an audio file";
      await job.save();
      return res.status(400).json({ error: "Choose an audio file" });
    }

    const allowedExtensions = new Set([".wav", ".mp3", ".ogg", ".flac", ".aac", ".m4a"]);
    const extension = extname(req.file.originalname).toLowerCase();
    
    if (!allowedExtensions.has(extension)) {
      job.status = "failed";
      job.errorMessage = "Invalid audio extension";
      await job.save();
      return res.status(400).json({
        error: "Audio must be WAV, MP3, OGG, FLAC, AAC, or M4A",
      });
    }

    const model = String(req.body?.model || "prisma-v2.5");
    const defaultLang = model === "prisma-v3.0" ? "indic-auto" : "hi-IN";
    const languageCode = String(req.body?.language_code || defaultLang);

    if (!["prisma-v2.5", "prisma-v3.0"].includes(model)) {
      job.status = "failed";
      job.errorMessage = "Unsupported STT model";
      await job.save();
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

    const latency = Date.now() - startTime;

    await ApiLog.create({
      jobId: job._id,
      userId: req.user._id,
      serviceName: "GNANI_STT",
      endpoint: "/stt/v3",
      statusCode: gnaniResponse.status,
      latencyMs: latency,
      creditsBilled: 1
    });

    if (!gnaniResponse.ok) {
      job.status = "failed";
      job.errorMessage = result.message || "Gnani STT request failed";
      await job.save();
      return res.status(gnaniResponse.status).json({
        error: "Gnani STT request failed",
        details: result,
      });
    }

    req.userDoc.creditsUsed += 1;
    await req.userDoc.save();

    job.status = "completed";
    job.transcribedText = result.transcript;
    job.sttLanguage = languageCode;
    job.completedAt = new Date();
    await job.save();

    return res.json(result);
  } catch (error) {
    console.error("STT error:", error);
    job.status = "failed";
    job.errorMessage = error.message;
    await job.save();
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
  const startTime = Date.now();

  const job = await ProcessingJob.create({
    userId: req.user._id,
    jobType: "TTS_ONLY",
    status: "processing"
  });

  try {
    if (!process.env.GNANI_API_KEY_ID) {
      job.status = "failed";
      job.errorMessage = "Gnani API key is not configured";
      await job.save();
      return res.status(500).json({ error: "Gnani API key is not configured" });
    }

    const text = String(req.body?.text || "").trim();
    const voice = String(req.body?.voice || "");
    const model = String(req.body?.model || "timbre-v2.5");
    const language = String(req.body?.language || "hi-IN");

    if (!text || !voice) {
      job.status = "failed";
      job.errorMessage = "Provide text and a voice name";
      await job.save();
      return res.status(400).json({ error: "Provide text and a voice name" });
    }

    if (!["timbre-v2.5", "timbre-v3.0"].includes(model)) {
      job.status = "failed";
      job.errorMessage = "Unsupported TTS model";
      await job.save();
      return res.status(400).json({ error: "Unsupported TTS model" });
    }

    const gnaniResponse = await fetch("https://api.vachana.ai/api/v1/tts/inference", {
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

    const latency = Date.now() - startTime;

    await ApiLog.create({
      jobId: job._id,
      userId: req.user._id,
      serviceName: "GNANI_TTS",
      endpoint: "/api/v1/tts/inference",
      statusCode: gnaniResponse.status,
      latencyMs: latency,
      creditsBilled: 1
    });

    if (!gnaniResponse.ok) {
      const details = await gnaniResponse.text();
      job.status = "failed";
      job.errorMessage = details || "Gnani TTS request failed";
      await job.save();
      return res.status(gnaniResponse.status).json({
        error: "Gnani TTS request failed",
        details,
      });
    }

    req.userDoc.creditsUsed += 1;
    await req.userDoc.save();

    job.status = "completed";
    job.ttsLanguage = language;
    job.ttsVoice = voice;
    job.completedAt = new Date();
    await job.save();

    const audio = Buffer.from(await gnaniResponse.arrayBuffer());
    res.set("Content-Type", gnaniResponse.headers.get("content-type") || "audio/wav");
    return res.send(audio);
  } catch (error) {
    console.error("TTS error:", error);
    job.status = "failed";
    job.errorMessage = error.message;
    await job.save();
    return res.status(500).json({ error: "Could not generate speech" });
  }
});

router.post("/tts/stream", async (req, res) => {
  const startTime = Date.now();

  const job = await ProcessingJob.create({
    userId: req.user._id,
    jobType: "TTS_ONLY",
    status: "processing"
  });

  try {
    if (!process.env.GNANI_API_KEY_ID) {
      job.status = "failed";
      job.errorMessage = "Gnani API key is not configured";
      await job.save();
      return res.status(500).json({ error: "Gnani API key is not configured" });
    }

    const text = String(req.body?.text || "").trim();
    const voice = String(req.body?.voice || "");
    const model = String(req.body?.model || "timbre-v2.5");
    const language = String(req.body?.language || "hi-IN");

    if (!text || !voice) {
      job.status = "failed";
      job.errorMessage = "Provide text and a voice name";
      await job.save();
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

    const latency = Date.now() - startTime;

    await ApiLog.create({
      jobId: job._id,
      userId: req.user._id,
      serviceName: "GNANI_TTS",
      endpoint: "/api/v1/tts/sse",
      statusCode: gnaniResponse.status,
      latencyMs: latency,
      creditsBilled: 1
    });

    if (!gnaniResponse.ok) {
      job.status = "failed";
      job.errorMessage = "Gnani SSE request failed";
      await job.save();
      res.write(`event: error\ndata: ${JSON.stringify({ error: "Gnani SSE request failed" })}\n\n`);
      return res.end();
    }

    req.userDoc.creditsUsed += 1;
    await req.userDoc.save();

    const reader = gnaniResponse.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
    }

    job.status = "completed";
    job.ttsLanguage = language;
    job.ttsVoice = voice;
    job.completedAt = new Date();
    await job.save();

    res.end();
  } catch (error) {
    console.error("TTS Streaming error:", error);
    job.status = "failed";
    job.errorMessage = error.message;
    await job.save();
    
    if (!res.headersSent) {
      return res.status(500).json({ error: "Could not stream audio" });
    }
    res.end();
  }
});

router.post("/translate_voice",upload.single("audio"), async (req,res)=>{
  const startTime=Date.now()
  const job=await ProcessingJob.create({
    userId: req.user._id,
    jobType:"FULL-CYCLE",
    status:"pending"

  })

    try {
    if (!process.env.GNANI_API_KEY_ID) {
      job.status = "failed";
      job.errorMessage = "Gnani API key is not configured";
      await job.save();
      return res.status(500).json({ error: "Gnani API key is not configured" });
    }

    if (!req.file) {
      job.status = "failed";
      job.errorMessage = "Choose an audio file";
      await job.save();
      return res.status(400).json({ error: "Choose an audio file" });
    }

    const allowedExtensions = new Set([".wav", ".mp3", ".ogg", ".flac", ".aac", ".m4a"]);
    const extension = extname(req.file.originalname).toLowerCase();
    
    if (!allowedExtensions.has(extension)) {
      job.status = "failed";
      job.errorMessage = "Invalid audio extension";
      await job.save();
      return res.status(400).json({
        error: "Audio must be WAV, MP3, OGG, FLAC, AAC, or M4A",
      });
    }

    const targetVoice = String(req.body?.target_voice || "");
    const targetLanguage = String(req.body?.target_language || "hi-IN");
    const ttsModel = String(req.body?.tts_model || "timbre-v3.0"); // Timbre v3 is best for multilingual

    if (!targetVoice) {
      job.status = "failed";
      job.errorMessage = "Provide a target_voice";
      await job.save();
      return res.status(400).json({ error: "Provide a target_voice for the output" });
    }

//step 1: speech to text
const sttStartTime = Date.now();
    const form = new FormData();
    const audioBlob = new Blob([req.file.buffer], {
      type: req.file.mimetype || "application/octet-stream",
    });

    form.append("audio_file", audioBlob, req.file.originalname);
    form.append("language_code", "indic-auto"); // Always auto-detect input language
    form.append("model", "prisma-v3.0");

    const sttResponse = await fetch("https://api.vachana.ai/stt/v3", {
      method: "POST",
      headers: { "X-API-Key-ID": process.env.GNANI_API_KEY_ID },
      body: form,
    });

    const sttLatency = Date.now() - sttStartTime;
    const sttText = await sttResponse.text();
    let sttResult;

    try {
      sttResult = JSON.parse(sttText);
    } catch {
      sttResult = { message: sttText };
    }

    await ApiLog.create({
      jobId: job._id,
      userId: req.user._id,
      serviceName: "GNANI_STT",
      endpoint: "/stt/v3",
      statusCode: sttResponse.status,
      latencyMs: sttLatency,
      creditsBilled: 1
    });

    if (!sttResponse.ok) {
      job.status = "failed";
      job.errorMessage = sttResult.message || "STT Step Failed";
      await job.save();
      return res.status(sttResponse.status).json({
        error: "STT Step Failed",
        details: sttResult,
      });
    }

    const transcribedText = sttResult.transcript;

    if (!transcribedText) {
      job.status = "failed";
      job.errorMessage = "No text transcribed from audio";
      await job.save();
      return res.status(400).json({ error: "Could not transcribe any text from the provided audio." });
    }

    //step 2:text to speech 

    const ttsStartTime = Date.now();
    
    const ttsResponse = await fetch("https://api.vachana.ai/api/v1/tts/inference", {
      method: "POST",
      headers: {
        "X-API-Key-ID": process.env.GNANI_API_KEY_ID,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: transcribedText, 
        voice: targetVoice,
        model: ttsModel,
        language: targetLanguage,
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

    const ttsLatency = Date.now() - ttsStartTime;

    await ApiLog.create({
      jobId: job._id,
      userId: req.user._id,
      serviceName: "GNANI_TTS",
      endpoint: "/api/v1/tts/inference",
      statusCode: ttsResponse.status,
      latencyMs: ttsLatency,
      creditsBilled: 1
    });

    if (!ttsResponse.ok) {
      const ttsDetails = await ttsResponse.text();
      job.status = "failed";
      job.errorMessage = ttsDetails || "TTS Step Failed";
      await job.save();
      return res.status(ttsResponse.status).json({
        error: "TTS Step Failed",
        details: ttsDetails,
      });
    }
req.userDoc.creditsUsed += 2;
    await req.userDoc.save();

    job.status = "completed";
    job.transcribedText = transcribedText;
    job.sttLanguage = "indic-auto";
    job.ttsLanguage = targetLanguage;
    job.ttsVoice = targetVoice;
    job.completedAt = new Date();
    await job.save();

    const finalAudio = Buffer.from(await ttsResponse.arrayBuffer());
    
    // Add custom header so frontend knows what was originally spoken 
    // Encode to base64 to safely pass Hindi/Indic characters in HTTP headers
    res.set("X-Transcribed-Text", Buffer.from(transcribedText).toString("base64"));
    res.set("Content-Type", ttsResponse.headers.get("content-type") || "audio/wav");
    
    return res.send(finalAudio);

  } catch (error) {
    console.error("Full-Cycle Translation error:", error);
    job.status = "failed";
    job.errorMessage = error.message;
    await job.save();
    return res.status(500).json({ error: "Could not complete the translation cycle" });
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
