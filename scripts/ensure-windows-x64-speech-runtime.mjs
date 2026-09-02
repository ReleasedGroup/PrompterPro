import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, "..");
const runtimeDirectory = path.join(
  rootDirectory,
  ".tmp",
  "windows-x64-speech",
);

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function assertX64Executable(filePath) {
  const executable = await readFile(filePath);
  if (executable.toString("ascii", 0, 2) !== "MZ") {
    throw new Error(`${filePath} is not a Windows executable.`);
  }
  const peOffset = executable.readUInt32LE(0x3c);
  if (executable.readUInt16LE(peOffset + 4) !== 0x8664) {
    throw new Error(`${filePath} is not an x64 executable.`);
  }
}

async function verifiedDownload(url, integrity, destination) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Runtime download failed with HTTP ${response.status}.`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const [algorithm, expected] = integrity.split("-", 2);
  const actual = createHash(algorithm).update(bytes).digest("base64");
  if (actual !== expected) {
    throw new Error(`Runtime download from ${url} failed its integrity check.`);
  }
  await writeFile(destination, bytes);
}

async function ensureX64Node() {
  const nodeExecutable = path.join(runtimeDirectory, "node.exe");
  if (await fileExists(nodeExecutable)) {
    await assertX64Executable(nodeExecutable);
    return nodeExecutable;
  }

  const version = `v${process.versions.node}`;
  const baseUrl = `https://nodejs.org/dist/${version}`;
  const checksumResponse = await fetch(`${baseUrl}/SHASUMS256.txt`);
  if (!checksumResponse.ok) {
    throw new Error(
      `Could not read the Node.js ${version} release checksums.`,
    );
  }
  const checksumLine = (await checksumResponse.text())
    .split(/\r?\n/u)
    .find((line) => line.endsWith("  win-x64/node.exe"));
  const checksum = checksumLine?.split(/\s+/u, 1)[0];
  if (!checksum) {
    throw new Error(`Node.js ${version} has no Windows x64 runtime.`);
  }

  console.log("Preparing the Windows x64 speech sidecar (one-time setup)…");
  const response = await fetch(`${baseUrl}/win-x64/node.exe`);
  if (!response.ok) {
    throw new Error(`Node.js runtime download failed with HTTP ${response.status}.`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== checksum) {
    throw new Error("The Node.js x64 runtime failed its checksum validation.");
  }
  await writeFile(nodeExecutable, bytes);
  await assertX64Executable(nodeExecutable);
  return nodeExecutable;
}

async function ensureSherpaX64() {
  const sherpaNodePackage = JSON.parse(
    await readFile(
      path.join(rootDirectory, "node_modules", "sherpa-onnx-node", "package.json"),
      "utf8",
    ),
  );
  const requestedVersion =
    sherpaNodePackage.optionalDependencies?.["sherpa-onnx-win-x64"];
  const version = requestedVersion?.replace(/^[^0-9]*/u, "");
  if (!version) {
    throw new Error("sherpa-onnx-node does not declare a Windows x64 runtime.");
  }

  const destination = path.join(
    rootDirectory,
    "node_modules",
    "sherpa-onnx-win-x64",
  );
  const nativeAddon = path.join(destination, "sherpa-onnx.node");
  if (await fileExists(nativeAddon)) return;

  console.log("Installing the Windows x64 Sherpa speech runtime…");
  const metadataResponse = await fetch(
    `https://registry.npmjs.org/sherpa-onnx-win-x64/${version}`,
  );
  if (!metadataResponse.ok) {
    throw new Error(
      `Sherpa runtime metadata returned HTTP ${metadataResponse.status}.`,
    );
  }
  const metadata = await metadataResponse.json();
  const tarballUrl = metadata.dist?.tarball;
  const integrity = metadata.dist?.integrity;
  if (typeof tarballUrl !== "string" || typeof integrity !== "string") {
    throw new Error("Sherpa runtime metadata is incomplete.");
  }

  const archivePath = path.join(runtimeDirectory, "sherpa-onnx-win-x64.tgz");
  await verifiedDownload(tarballUrl, integrity, archivePath);
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  const extraction = spawn(
    "tar",
    ["-xzf", archivePath, "--strip-components", "1", "-C", destination],
    { cwd: rootDirectory, stdio: "inherit", windowsHide: true },
  );
  const [exitCode] = await once(extraction, "exit");
  await rm(archivePath, { force: true });
  if (exitCode !== 0 || !(await fileExists(nativeAddon))) {
    throw new Error("The Windows x64 Sherpa runtime could not be extracted.");
  }
}

export async function ensureWindowsX64SpeechRuntime() {
  if (process.platform !== "win32" || process.arch !== "arm64") {
    return process.execPath;
  }
  await mkdir(runtimeDirectory, { recursive: true });
  const nodeExecutable = await ensureX64Node();
  await ensureSherpaX64();
  return nodeExecutable;
}
