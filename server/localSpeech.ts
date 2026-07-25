import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { Server } from "node:http";
import { WebSocketServer, type RawData, type WebSocket } from "ws";

const require = createRequire(import.meta.url);
const TARGET_SAMPLE_RATE = 16_000;
const MODEL_DIRECTORY_NAME =
  "sherpa-onnx-streaming-zipformer-en-20M-2023-02-17";

const MODEL_FILES = {
  encoder: "encoder-epoch-99-avg-1.int8.onnx",
  decoder: "decoder-epoch-99-avg-1.onnx",
  joiner: "joiner-epoch-99-avg-1.int8.onnx",
  tokens: "tokens.txt",
} as const;

interface OnlineStream {
  acceptWaveform(input: {
    sampleRate: number;
    samples: Float32Array;
  }): void;
  inputFinished(): void;
}

interface OnlineRecognizer {
  createStream(): OnlineStream;
  isReady(stream: OnlineStream): boolean;
  decode(stream: OnlineStream): void;
  getResult(stream: OnlineStream): { text: string };
  isEndpoint(stream: OnlineStream): boolean;
  reset(stream: OnlineStream): void;
}

interface LinearResampler {
  resample(samples: Float32Array): Float32Array;
}

interface SherpaOnnxModule {
  OnlineRecognizer: new (config: object) => OnlineRecognizer;
  LinearResampler: new (
    inputSampleRate: number,
    outputSampleRate: number,
  ) => LinearResampler;
}

interface SpeechStartMessage {
  type: "start";
  sampleRate: number;
}

interface SpeechSession {
  stream: OnlineStream;
  resampler: LinearResampler | null;
  lastText: string;
}

export interface SpeechModelStatus {
  available: boolean;
  directory: string;
  missingFiles: string[];
}

function modelDirectory(rootDirectory: string): string {
  return path.resolve(
    process.env.SHERPA_ONNX_MODEL_DIR ??
      path.join(rootDirectory, ".models", MODEL_DIRECTORY_NAME),
  );
}

export function getSpeechModelStatus(
  rootDirectory: string,
): SpeechModelStatus {
  const directory = modelDirectory(rootDirectory);
  const missingFiles = Object.values(MODEL_FILES).filter(
    (file) => !existsSync(path.join(directory, file)),
  );

  return {
    available: missingFiles.length === 0,
    directory,
    missingFiles,
  };
}

function createRecognizer(
  rootDirectory: string,
  sherpa: SherpaOnnxModule,
): OnlineRecognizer {
  const status = getSpeechModelStatus(rootDirectory);
  if (!status.available) {
    throw new Error(
      "The local speech model is not installed. Run npm run speech:model.",
    );
  }

  return new sherpa.OnlineRecognizer({
    featConfig: {
      sampleRate: TARGET_SAMPLE_RATE,
      featureDim: 80,
    },
    modelConfig: {
      transducer: {
        encoder: path.join(status.directory, MODEL_FILES.encoder),
        decoder: path.join(status.directory, MODEL_FILES.decoder),
        joiner: path.join(status.directory, MODEL_FILES.joiner),
      },
      tokens: path.join(status.directory, MODEL_FILES.tokens),
      numThreads: Math.max(
        1,
        Math.min(4, Number(process.env.SHERPA_ONNX_THREADS) || 2),
      ),
      provider: "cpu",
      debug: false,
    },
    decodingMethod: "greedy_search",
    maxActivePaths: 4,
    enableEndpoint: true,
    rule1MinTrailingSilence: 2.4,
    rule2MinTrailingSilence: 1.2,
    rule3MinUtteranceLength: 20,
  });
}

function sendJson(socket: WebSocket, message: object) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function parseStartMessage(data: RawData): SpeechStartMessage | null {
  try {
    const parsed = JSON.parse(data.toString()) as Partial<SpeechStartMessage>;
    if (
      parsed.type !== "start" ||
      typeof parsed.sampleRate !== "number" ||
      !Number.isFinite(parsed.sampleRate) ||
      parsed.sampleRate < 8_000 ||
      parsed.sampleRate > 192_000
    ) {
      return null;
    }
    return { type: "start", sampleRate: parsed.sampleRate };
  } catch {
    return null;
  }
}

function samplesFromMessage(data: RawData): Float32Array {
  const buffer = Buffer.isBuffer(data)
    ? data
    : Array.isArray(data)
      ? Buffer.concat(data)
      : Buffer.from(data);
  if (buffer.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) {
    throw new Error("Audio frames must contain 32-bit float samples.");
  }

  const copy = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );
  return new Float32Array(copy);
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const hostname = new URL(origin).hostname;
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
}

export function attachLocalSpeechServer(
  server: Server,
  rootDirectory: string,
) {
  const webSockets = new WebSocketServer({
    noServer: true,
    maxPayload: 256 * 1024,
  });
  let sherpa: SherpaOnnxModule | null = null;
  let recognizer: OnlineRecognizer | null = null;

  function getRecognizer(): {
    sherpa: SherpaOnnxModule;
    recognizer: OnlineRecognizer;
  } {
    sherpa ??= require("sherpa-onnx-node") as SherpaOnnxModule;
    recognizer ??= createRecognizer(rootDirectory, sherpa);
    return { sherpa, recognizer };
  }

  server.on("upgrade", (request, socket, head) => {
    const requestUrl = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? "127.0.0.1"}`,
    );
    if (requestUrl.pathname !== "/api/speech") {
      socket.destroy();
      return;
    }

    const origin = request.headers.origin;
    if (origin && !isLoopbackOrigin(origin)) {
      socket.destroy();
      return;
    }

    webSockets.handleUpgrade(request, socket, head, (webSocket) => {
      webSockets.emit("connection", webSocket, request);
    });
  });

  webSockets.on("connection", (socket) => {
    let session: SpeechSession | null = null;

    socket.on("error", (error) => {
      console.error("Local speech WebSocket error:", error.message);
    });

    socket.on("message", (data, isBinary) => {
      try {
        if (!isBinary) {
          if (session) {
            throw new Error("The speech session has already started.");
          }
          const start = parseStartMessage(data);
          if (!start) {
            throw new Error("Invalid speech session configuration.");
          }

          const local = getRecognizer();
          session = {
            stream: local.recognizer.createStream(),
            resampler:
              start.sampleRate === TARGET_SAMPLE_RATE
                ? null
                : new local.sherpa.LinearResampler(
                    start.sampleRate,
                    TARGET_SAMPLE_RATE,
                  ),
            lastText: "",
          };
          sendJson(socket, { type: "ready" });
          return;
        }

        if (!session || !recognizer) {
          throw new Error("Start the speech session before sending audio.");
        }

        const inputSamples = samplesFromMessage(data);
        const samples = session.resampler
          ? session.resampler.resample(inputSamples)
          : inputSamples;
        session.stream.acceptWaveform({
          sampleRate: TARGET_SAMPLE_RATE,
          samples,
        });

        while (recognizer.isReady(session.stream)) {
          recognizer.decode(session.stream);
        }

        const text = recognizer
          .getResult(session.stream)
          .text.trim()
          .toLowerCase();
        const endpoint = recognizer.isEndpoint(session.stream);

        if (text && text !== session.lastText) {
          session.lastText = text;
          sendJson(socket, { type: "transcript", text, final: false });
        }

        if (endpoint) {
          if (text) {
            sendJson(socket, { type: "transcript", text, final: true });
          }
          recognizer.reset(session.stream);
          session.lastText = "";
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Local speech recognition failed.";
        console.error("Local speech recognition failed:", message);
        sendJson(socket, { type: "error", message });
        socket.close(1011, "Local speech recognition failed");
      }
    });

    socket.on("close", () => {
      try {
        session?.stream.inputFinished();
      } catch {
        // The native stream may already be finalized after an engine error.
      }
      session = null;
    });
  });

  return webSockets;
}
