import { createWriteStream } from "node:fs";
import { access, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { spawn } from "node:child_process";

const MODEL_NAME = "sherpa-onnx-streaming-zipformer-en-20M-2023-02-17";
const ARCHIVE_NAME = `${MODEL_NAME}.tar.bz2`;
const EXPECTED_BYTES = 127_887_156;
const DOWNLOAD_URL =
  `https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/${ARCHIVE_NAME}`;
const REQUIRED_FILES = [
  "encoder-epoch-99-avg-1.int8.onnx",
  "decoder-epoch-99-avg-1.onnx",
  "joiner-epoch-99-avg-1.int8.onnx",
  "tokens.txt",
];

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, "..");
const modelsDirectory = path.join(rootDirectory, ".models");
const modelDirectory = path.join(modelsDirectory, MODEL_NAME);
const archivePath = path.join(modelsDirectory, ARCHIVE_NAME);

async function modelIsComplete() {
  try {
    await Promise.all(
      REQUIRED_FILES.map((file) => access(path.join(modelDirectory, file))),
    );
    return true;
  } catch {
    return false;
  }
}

async function downloadArchive() {
  console.log(
    `Downloading the ${Math.round(EXPECTED_BYTES / 1024 / 1024)} MB local speech model...`,
  );
  const response = await fetch(DOWNLOAD_URL, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(
      `Model download failed with HTTP ${response.status}.`,
    );
  }

  const output = createWriteStream(archivePath);
  let received = 0;
  let lastPercent = -1;

  try {
    for await (const chunk of response.body) {
      const bytes = Buffer.from(chunk);
      received += bytes.byteLength;
      if (!output.write(bytes)) await once(output, "drain");

      const percent = Math.floor((received / EXPECTED_BYTES) * 100);
      if (percent >= lastPercent + 10) {
        lastPercent = percent;
        console.log(`${Math.min(percent, 100)}%`);
      }
    }
    output.end();
    await once(output, "finish");
  } catch (error) {
    output.destroy();
    throw error;
  }

  const downloaded = await stat(archivePath);
  if (downloaded.size !== EXPECTED_BYTES) {
    throw new Error(
      `The model archive was incomplete (${downloaded.size} of ${EXPECTED_BYTES} bytes).`,
    );
  }
}

async function extractArchive() {
  console.log("Extracting the local speech model...");
  const child = spawn(
    "tar",
    ["-xjf", archivePath, "-C", modelsDirectory],
    { stdio: "inherit", windowsHide: true },
  );
  const [exitCode] = await once(child, "exit");
  if (exitCode !== 0) {
    throw new Error(
      "Model extraction failed. Ensure the system tar command is available.",
    );
  }
}

await mkdir(modelsDirectory, { recursive: true });

if (await modelIsComplete()) {
  console.log(`Local speech model is already installed at ${modelDirectory}`);
  process.exit(0);
}

try {
  await downloadArchive();
  await extractArchive();
  if (!(await modelIsComplete())) {
    throw new Error("The extracted model is missing required files.");
  }
  console.log(`Local speech model installed at ${modelDirectory}`);
} finally {
  await rm(archivePath, { force: true });
}
