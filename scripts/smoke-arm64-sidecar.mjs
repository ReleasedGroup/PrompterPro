import { spawn } from "node:child_process";
import { once } from "node:events";
import { access } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const require = createRequire(import.meta.url);
const sherpa = require("sherpa-onnx-node");
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, "..");
const packageOutputDirectory = process.env.PROMPTER_PACKAGE_OUTPUT_DIR
  ? path.resolve(rootDirectory, process.env.PROMPTER_PACKAGE_OUTPUT_DIR)
  : path.join(rootDirectory, "out");
const arm64Directory = path.join(
  packageOutputDirectory,
  "PrompterPro-win32-arm64",
);
const nodeExecutable = path.join(
  arm64Directory,
  "resources",
  "x64-sidecar",
  "node.exe",
);
const serverEntry = path.join(
  arm64Directory,
  "resources",
  "app",
  "dist-server",
  "index.mjs",
);
const modelDirectory = path.join(
  arm64Directory,
  "resources",
  "sherpa-onnx-streaming-zipformer-en-20M-2023-02-17",
);

await access(nodeExecutable);
await access(serverEntry);

const sidecar = spawn(nodeExecutable, [serverEntry], {
  env: {
    ...process.env,
    PORT: "0",
    PROMPTER_PRODUCTION: "1",
    SHERPA_ONNX_MODEL_DIR: modelDirectory,
  },
  stdio: ["ignore", "pipe", "pipe", "ipc"],
  windowsHide: true,
});
sidecar.stdout.on("data", (data) => {
  console.log(data.toString().trimEnd());
});
sidecar.stderr.on("data", (data) => {
  console.error(data.toString().trimEnd());
});

try {
  const port = await waitForSidecar(sidecar);
  const health = await fetch(`http://127.0.0.1:${port}/api/health`);
  if (!health.ok) {
    throw new Error(`ARM64 sidecar health check returned ${health.status}.`);
  }

  const wave = sherpa.readWave(
    path.join(modelDirectory, "test_wavs", "0.wav"),
  );
  const transcript = await recognizeReferenceAudio(port, wave);
  console.log(`ARM64 sidecar speech transcript: ${transcript}`);
} finally {
  if (!sidecar.killed) sidecar.kill();
  if (sidecar.exitCode === null) await once(sidecar, "exit");
}

function waitForSidecar(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for the ARM64 service sidecar."));
    }, 30_000);

    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`The ARM64 service sidecar exited with code ${code}.`));
    });
    child.on("message", (message) => {
      if (
        message?.type === "prompter:server-ready" &&
        Number.isInteger(message.port)
      ) {
        clearTimeout(timeout);
        resolve(message.port);
      }
    });
  });
}

function recognizeReferenceAudio(port, wave) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(
      `ws://127.0.0.1:${port}/api/speech`,
    );
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("Timed out waiting for the sidecar transcript."));
    }, 15_000);

    socket.on("open", () => {
      socket.send(
        JSON.stringify({ type: "start", sampleRate: wave.sampleRate }),
      );
    });
    socket.on("message", (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === "ready") {
        sendSamples(socket, wave.sampleRate, wave.samples);
        sendSamples(
          socket,
          wave.sampleRate,
          new Float32Array(Math.round(wave.sampleRate * 2.5)),
        );
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
        reject(new Error(message.message || "Sidecar recognition failed."));
      }
    });
    socket.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function sendSamples(socket, sampleRate, samples) {
  const chunkLength = Math.max(1, Math.round(sampleRate / 10));
  for (let start = 0; start < samples.length; start += chunkLength) {
    const chunk = samples.subarray(start, start + chunkLength);
    socket.send(
      Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength),
    );
  }
}
