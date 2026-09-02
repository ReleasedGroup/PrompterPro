import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import dotenv from "dotenv";
import express from "express";
import OpenAI from "openai";
import {
  attachLocalSpeechServer,
  getSpeechModelStatus,
} from "./localSpeech.js";
import {
  buildAssSubtitles,
  buildVideoFilter,
  parseCaptionExportBody,
} from "./subtitleExport.js";

const currentFile = fileURLToPath(import.meta.url);
const serverDirectory = path.dirname(currentFile);
const rootDirectory = path.resolve(serverDirectory, "..");
dotenv.config({ path: path.join(rootDirectory, ".env.local") });
dotenv.config({ path: path.join(rootDirectory, ".env") });

const app = express();
const port = Number(process.env.PORT ?? 8787);
const production =
  process.argv.includes("--production") ||
  process.env.PROMPTER_PRODUCTION === "1";
const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const importedFfmpegPath = require("ffmpeg-static") as string | null;

function resolveFfmpegPath(): string | null {
  const candidates = [
    importedFfmpegPath,
    importedFfmpegPath?.replace("app.asar", "app.asar.unpacked"),
    path.join(rootDirectory, "node_modules", "ffmpeg-static", "ffmpeg.exe"),
  ];
  return (
    candidates.find((candidate) => candidate && existsSync(candidate)) ?? null
  );
}

const ffmpegPath = resolveFfmpegPath();

app.disable("x-powered-by");

app.post(
  "/api/recordings/mp4",
  express.raw({
    type: ["video/webm", "application/octet-stream"],
    limit: "1gb",
  }),
  async (request, response) => {
    if (!ffmpegPath) {
      response.status(503).json({
        error: "MP4 export is not available on this computer.",
      });
      return;
    }

    if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
      response.status(400).json({ error: "No recorded video was supplied." });
      return;
    }

    const workingDirectory = await mkdtemp(
      path.join(tmpdir(), "prompter-export-"),
    );
    const inputPath = path.join(workingDirectory, "take.webm");
    const outputPath = path.join(workingDirectory, "take.mp4");

    try {
      await writeFile(inputPath, request.body);
      await execFileAsync(
        ffmpegPath,
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-i",
          inputPath,
          "-map",
          "0:v:0",
          "-map",
          "0:a:0",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "20",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-b:a",
          "192k",
          "-shortest",
          "-movflags",
          "+faststart",
          outputPath,
        ],
        {
          maxBuffer: 16 * 1024 * 1024,
          windowsHide: true,
        },
      );

      response.type("video/mp4");
      response.setHeader("Cache-Control", "no-store");
      response.sendFile(outputPath, (sendError) => {
        void rm(workingDirectory, { recursive: true, force: true });
        if (sendError && !response.headersSent) {
          response.status(500).json({
            error: "The finished MP4 could not be returned.",
          });
        }
      });
    } catch (error) {
      await rm(workingDirectory, { recursive: true, force: true });
      const message =
        error instanceof Error ? error.message : "Unknown conversion error";
      console.error("MP4 export failed:", message);
      response.status(500).json({
        error:
          "MP4 export failed. Check that the recording contains both video and audio.",
      });
    }
  },
);

app.post(
  "/api/recordings/render",
  express.raw({
    type: "application/x-prompter-export",
    limit: "1gb",
  }),
  async (request, response) => {
    if (!ffmpegPath) {
      response.status(503).json({
        error: "Video rendering is not available on this computer.",
      });
      return;
    }
    if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
      response.status(400).json({ error: "No recorded video was supplied." });
      return;
    }

    let parsedExport;
    try {
      parsedExport = parseCaptionExportBody(request.body);
    } catch (error) {
      response.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "The subtitle export options are invalid.",
      });
      return;
    }

    const workingDirectory = await mkdtemp(
      path.join(tmpdir(), "prompter-subtitle-export-"),
    );
    const inputPath = path.join(workingDirectory, "take.recording");
    const audioPath = path.join(workingDirectory, "take-audio.recording");
    const subtitlePath = path.join(workingDirectory, "captions.ass");
    const outputPath = path.join(workingDirectory, "take-rendered.mp4");

    try {
      const writes = [writeFile(inputPath, parsedExport.recording)];
      if (parsedExport.audioRecording) {
        writes.push(writeFile(audioPath, parsedExport.audioRecording));
      }
      if (parsedExport.request.mode === "subtitles") {
        writes.push(
          writeFile(
            subtitlePath,
            buildAssSubtitles(
              parsedExport.request.words,
              parsedExport.request.fontFamily,
              parsedExport.request.aspectRatio,
              parsedExport.request.highlightColor,
              parsedExport.request.subtitleTreatment,
            ),
            "utf8",
          ),
        );
      }
      await Promise.all(writes);
      const videoFilter = buildVideoFilter(parsedExport.request);
      await execFileAsync(
        ffmpegPath,
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-i",
          inputPath,
          ...(parsedExport.audioRecording ? ["-i", audioPath] : []),
          "-map",
          "0:v:0",
          "-map",
          parsedExport.audioRecording ? "1:a:0" : "0:a:0",
          ...(videoFilter ? ["-vf", videoFilter] : []),
          "-c:v",
          "libx264",
          "-preset",
          parsedExport.request.preserveQuality ? "medium" : "veryfast",
          "-crf",
          parsedExport.request.preserveQuality ? "17" : "20",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-b:a",
          "192k",
          "-shortest",
          "-movflags",
          "+faststart",
          outputPath,
        ],
        {
          cwd: workingDirectory,
          maxBuffer: 16 * 1024 * 1024,
          windowsHide: true,
        },
      );

      response.type("video/mp4");
      response.setHeader("Cache-Control", "no-store");
      response.sendFile(outputPath, (sendError) => {
        void rm(workingDirectory, { recursive: true, force: true });
        if (sendError && !response.headersSent) {
          response.status(500).json({
            error: "The rendered MP4 could not be returned.",
          });
        }
      });
    } catch (error) {
      await rm(workingDirectory, { recursive: true, force: true });
      const message =
        error instanceof Error ? error.message : "Unknown video render error";
      console.error("Video rendering failed:", message);
      response.status(500).json({
        error: "Video rendering failed. Your clean recording is still safe.",
      });
    }
  },
);

app.use(express.json({ limit: "32kb" }));

interface GenerateBody {
  topic?: unknown;
  audience?: unknown;
  tone?: unknown;
  durationMinutes?: unknown;
  keyPoints?: unknown;
}

function stringField(value: unknown, maximum: number): string {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/speech/status", (_request, response) => {
  const status = getSpeechModelStatus(rootDirectory);
  response.json({
    available: status.available,
    model: status.available ? "sherpa-onnx Zipformer English 20M" : null,
    setup: status.available ? null : "Run npm run speech:model.",
  });
});

app.get("/api/scripts/generate/status", (_request, response) => {
  response.json({ available: Boolean(process.env.OPENAI_API_KEY) });
});

app.post("/api/scripts/generate", async (request, response) => {
  const body = request.body as GenerateBody;
  const topic = stringField(body.topic, 300);
  const audience = stringField(body.audience, 200);
  const tone = stringField(body.tone, 80);
  const keyPoints = stringField(body.keyPoints, 2_500);
  const durationMinutes = Math.min(
    20,
    Math.max(1, Number(body.durationMinutes) || 2),
  );

  if (!topic) {
    response.status(400).json({ error: "Add a topic before generating." });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    response.status(503).json({
      error: "AI generation is not configured on this installation.",
    });
    return;
  }

  const targetWords = Math.round(durationMinutes * 140);
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL ?? "gpt-5.6-sol";

  try {
    const result = await client.responses.create({
      model,
      reasoning: { effort: "low" },
      instructions:
        "You write natural teleprompter scripts for spoken delivery. " +
        "Return only the finished script: no title, markdown, notes, stage directions, " +
        "or explanation. Use short, speakable sentences and paragraph breaks for breath. " +
        "Preserve every supplied key point without inventing facts, names, metrics, or claims.",
      input: [
        `Topic: ${topic}`,
        `Audience: ${audience || "a general audience"}`,
        `Tone: ${tone || "clear, warm, and confident"}`,
        `Target length: about ${targetWords} words (${durationMinutes} minutes spoken)`,
        `Key points:\n${keyPoints || "Use only the topic and avoid unsupported specifics."}`,
        "Success means the opening earns attention, ideas flow logically, the wording sounds natural aloud, and the ending lands one clear takeaway.",
      ].join("\n\n"),
      max_output_tokens: Math.min(4_000, Math.max(700, targetWords * 3)),
      text: { verbosity: "medium" },
    });

    const script = result.output_text.trim();
    if (!script) throw new Error("The model returned no script text.");
    response.json({ script, model: result.model });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown generation error";
    console.error("Script generation failed:", message);
    response.status(502).json({
      error: "The script could not be generated. Please try again.",
    });
  }
});

if (production) {
  const distDirectory = path.join(rootDirectory, "dist");
  app.use(express.static(distDirectory));
  app.get("/{*splat}", (_request, response) => {
    response.sendFile(path.join(distDirectory, "index.html"));
  });
}

export const server = createServer(app);
attachLocalSpeechServer(server, rootDirectory);

server.listen(port, "127.0.0.1", () => {
  const address = server.address();
  const activePort =
    address && typeof address !== "string" ? address.port : port;
  process.send?.({
    type: "prompter:server-ready",
    port: activePort,
  });
  const productName = process.env.PROMPTER_PRODUCT_NAME || "PrompterPro";
  console.log(
    production
      ? `${productName} is running at http://127.0.0.1:${activePort}`
      : `${productName} API is running at http://127.0.0.1:${activePort}`,
  );
});
