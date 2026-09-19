import express from "express";
import path from "path";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Configure multer for memory audio uploads
const upload = multer({
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB
});

app.use(express.json());

// API health endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Lazy initialize Gemini client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: key });
  }
  return geminiClient;
}

// Audio Transcription API endpoint
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    const mimeType = file.mimetype || "audio/webm";
    const audioBase64 = file.buffer.toString("base64");

    // 1. Try Gemini API first if available
    const gemini = getGeminiClient();
    if (gemini) {
      try {
        const response = await gemini.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType.startsWith("audio/") ? mimeType : "audio/webm",
                    data: audioBase64,
                  },
                },
                {
                  text: "Please accurately transcribe this audio recording verbatim. Provide only the plain transcript text without introductory notes or markdown formatting.",
                },
              ],
            },
          ],
        });

        const transcript = response.text ? response.text.trim() : "";
        if (transcript) {
          return res.json({ text: transcript, provider: "gemini" });
        }
      } catch (geminiErr: any) {
        console.warn("Gemini transcription error, trying fallback:", geminiErr?.message);
      }
    }

    // 2. Try Groq Whisper API if GROQ_API_KEY is available
    const groqApiKey = process.env.GROQ_API_KEY;
    if (groqApiKey) {
      try {
        const formData = new FormData();
        const blob = new Blob([new Uint8Array(file.buffer)], { type: mimeType });
        formData.append("file", blob, "recording.webm");
        formData.append("model", "whisper-large-v3");
        formData.append("response_format", "json");

        const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqApiKey}`,
          },
          body: formData,
        });

        if (groqRes.ok) {
          const data: any = await groqRes.json();
          if (data?.text) {
            return res.json({ text: data.text.trim(), provider: "groq" });
          }
        }
      } catch (groqErr: any) {
        console.warn("Groq transcription error:", groqErr?.message);
      }
    }

    // If no API key configured
    return res.json({
      text: "Audio recorded successfully. (To enable AI cloud transcription, set GEMINI_API_KEY or GROQ_API_KEY in environment variables. Real-time browser speech recognition is also active).",
      provider: "local",
    });
  } catch (error: any) {
    console.error("Transcription endpoint failure:", error);
    res.status(500).json({ error: error.message || "Failed to process audio transcription" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // In Express 5 wildcard routing:
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`TP-7 Audio Recorder server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
