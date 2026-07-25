import { once } from "node:events";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket, { WebSocketServer } from "ws";
import { attachLocalSpeechServer } from "../server/localSpeech.js";

interface SherpaWave {
  sampleRate: number;
  samples: Float32Array;
}

interface SherpaModule {
  readWave(file: string): SherpaWave;
}

interface SpeechMessage {
  type: "ready" | "transcript" | "error";
  text?: string;
  final?: boolean;
  message?: string;
}

const require = createRequire(import.meta.url);
const sherpa = require("sherpa-onnx-node") as SherpaModule;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, "..");
const modelDirectory = path.join(
  rootDirectory,
  ".models",
  "sherpa-onnx-streaming-zipformer-en-20M-2023-02-17",
);
const wave = sherpa.readWave(path.join(modelDirectory, "test_wavs", "0.wav"));

function sendSamples(socket: WebSocket, samples: Float32Array) {
  const chunkLength = Math.max(1, Math.round(wave.sampleRate / 10));
  for (let start = 0; start < samples.length; start += chunkLength) {
    const chunk = samples.subarray(start, start + chunkLength);
    socket.send(
      Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength),
    );
  }
}

const server = createServer();
const webSockets: WebSocketServer = attachLocalSpeechServer(
  server,
  rootDirectory,
);
server.listen(0, "127.0.0.1");
await once(server, "listening");

const address = server.address();
if (!address || typeof address === "string") {
  throw new Error("The speech smoke-test server has no TCP address.");
}

try {
  const transcript = await new Promise<string>((resolve, reject) => {
    const socket = new WebSocket(
      `ws://127.0.0.1:${address.port}/api/speech`,
    );
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("Timed out waiting for a finalized local transcript."));
    }, 15_000);

    socket.on("open", () => {
      socket.send(
        JSON.stringify({ type: "start", sampleRate: wave.sampleRate }),
      );
    });

    socket.on("message", (data) => {
      const message = JSON.parse(data.toString()) as SpeechMessage;
      if (message.type === "ready") {
        sendSamples(socket, wave.samples);
        const padding = new Float32Array(Math.round(wave.sampleRate * 2.5));
        sendSamples(socket, padding);
      } else if (
        message.type === "transcript" &&
        message.final &&
        message.text
      ) {
        clearTimeout(timeout);
        socket.close();
        resolve(message.text);
      } else if (message.type === "error") {
        clearTimeout(timeout);
        socket.close();
        reject(new Error(message.message || "Local recognition failed."));
      }
    });

    socket.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

  console.log(`Local speech transcript: ${transcript}`);
} finally {
  for (const client of webSockets.clients) client.close();
  webSockets.close();
  server.close();
  await once(server, "close");
}
