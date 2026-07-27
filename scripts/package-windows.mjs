import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  access,
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listPackage } from "@electron/asar";
import { packager } from "@electron/packager";
import { renderStoreManifest } from "./store-manifest.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, "..");
const modelDirectoryName =
  "sherpa-onnx-streaming-zipformer-en-20M-2023-02-17";
const modelDirectory = path.join(
  rootDirectory,
  ".models",
  modelDirectoryName,
);
const storeDirectory = path.join(rootDirectory, "store");
const outputDirectory = process.env.PROMPTER_PACKAGE_OUTPUT_DIR
  ? path.resolve(rootDirectory, process.env.PROMPTER_PACKAGE_OUTPUT_DIR)
  : path.join(rootDirectory, "out");
const packageJson = JSON.parse(
  await readFile(path.join(rootDirectory, "package.json"), "utf8"),
);
const allowedAppEntries = new Set([
  "desktop",
  "dist",
  "dist-server",
  "node_modules",
  "package.json",
]);
const runtimeModuleFiles = new Map([
  [
    "ffmpeg-static",
    new Set(["ffmpeg.exe", "index.js", "package.json"]),
  ],
  [
    "sherpa-onnx-node",
    new Set([
      "addon-static-import.js",
      "addon.js",
      "audio-tagg.js",
      "keyword-spotter.js",
      "non-streaming-asr.js",
      "non-streaming-speaker-diarization.js",
      "non-streaming-speech-denoiser.js",
      "non-streaming-tts.js",
      "online-speech-denoiser.js",
      "package.json",
      "punctuation.js",
      "resampler.js",
      "sherpa-onnx.js",
      "speaker-identification.js",
      "spoken-language-identification.js",
      "streaming-asr.js",
      "vad.js",
    ]),
  ],
  [
    "sherpa-onnx-win-x64",
    new Set([
      "index.js",
      "onnxruntime.dll",
      "onnxruntime_providers_shared.dll",
      "package.json",
      "sherpa-onnx-c-api.dll",
      "sherpa-onnx-cxx-api.dll",
      "sherpa-onnx.node",
    ]),
  ],
]);
const requiredRuntimeFiles = [
  "node_modules/ffmpeg-static/ffmpeg.exe",
  "node_modules/sherpa-onnx-node/sherpa-onnx.js",
  "node_modules/sherpa-onnx-win-x64/sherpa-onnx.node",
];
const architectures = [
  {
    name: "x64",
    minimumWindowsVersion: "10.0.22000.0",
    asar: { unpack: "**/*.{node,dll,exe}" },
  },
  {
    name: "arm64",
    minimumWindowsVersion: "10.0.22000.0",
    asar: false,
  },
];

if (process.platform !== "win32") {
  throw new Error("The Windows MSIX bundle must be built on Windows.");
}
if (process.arch !== "x64") {
  throw new Error(
    "The multi-architecture bundle must be built with x64 Node.js.",
  );
}

try {
  await access(path.join(modelDirectory, "tokens.txt"));
} catch {
  throw new Error(
    "The offline speech model is missing. Run npm run speech:model first.",
  );
}

const packageDirectories = [];
for (const architecture of architectures) {
  console.log(`Packaging the ${architecture.name} Electron application...`);
  const packagePaths = await packager({
    dir: rootDirectory,
    name: "Prompter",
    executableName: "Prompter",
    platform: "win32",
    arch: architecture.name,
    out: outputDirectory,
    overwrite: true,
    prune: true,
    asar: architecture.asar,
    icon: path.join(storeDirectory, "assets", "AppIcon.ico"),
    extraResource: [modelDirectory],
    afterPrune: [removeUnneededRuntimeModules],
    appVersion: packageJson.version,
    buildVersion: packageJson.version,
    win32metadata: {
      CompanyName: "Released Group",
      FileDescription: packageJson.description,
      ProductName: "Prompter",
      InternalName: "Prompter",
      OriginalFilename: "Prompter.exe",
      "requested-execution-level": "asInvoker",
    },
    ignore: shouldIgnorePackageFile,
  });

  if (packagePaths.length !== 1) {
    throw new Error(
      `Expected one ${architecture.name} package directory, got ${packagePaths.length}.`,
    );
  }

  const packageDirectory = packagePaths[0];
  await assertPeArchitecture(
    path.join(packageDirectory, "Prompter.exe"),
    architecture.name,
  );
  await assertPackagedAppAllowList(
    packageDirectory,
    architecture.name,
  );
  await cp(
    path.join(storeDirectory, "assets"),
    path.join(packageDirectory, "Assets"),
    { recursive: true },
  );
  if (architecture.name === "arm64") {
    await addArm64ServiceSidecar(packageDirectory);
  }
  await addStoreManifest(packageDirectory, architecture);
  packageDirectories.push(packageDirectory);
}

const version =
  process.env.MS_STORE_VERSION || packageJson.version;
const msixOutputDirectory = path.join(outputDirectory, "store");
await mkdir(msixOutputDirectory, { recursive: true });
const bundlePath = path.join(
  msixOutputDirectory,
  `Prompter_${toSafeVersion(version)}_x64_arm64.msixbundle`,
);
const winAppCli = path.join(
  rootDirectory,
  "node_modules",
  "@microsoft",
  "winappcli",
  "dist",
  "cli.js",
);

console.log("Creating the unsigned x64/ARM64 MSIX bundle...");
const winApp = spawn(
  process.execPath,
  [
    winAppCli,
    "package",
    ...packageDirectories,
    "--output",
    bundlePath,
  ],
  {
    cwd: rootDirectory,
    env: {
      ...process.env,
      WINAPP_CLI_TELEMETRY_OPTOUT: "1",
    },
    stdio: "inherit",
    windowsHide: true,
  },
);
const [exitCode] = await once(winApp, "exit");
if (exitCode !== 0) {
  throw new Error(`WinApp CLI exited with code ${exitCode}.`);
}

console.log(`Windows Store bundle created at ${bundlePath}`);

function shouldIgnorePackageFile(file) {
  const normalizedRoot = rootDirectory.replaceAll(path.sep, "/");
  const normalizedFile = file.replaceAll(path.sep, "/");
  const relative = normalizedFile
    .toLowerCase()
    .startsWith(`${normalizedRoot.toLowerCase()}/`)
    ? normalizedFile.slice(normalizedRoot.length + 1)
    : normalizedFile.replace(/^\/+/, "");
  return !isAllowedAppPath(relative);
}

function isAllowedAppPath(relative) {
  if (!relative) return true;
  const topLevel = relative.split("/", 1)[0];
  if (!allowedAppEntries.has(topLevel)) return false;
  if (topLevel !== "node_modules") return true;
  return isRequiredRuntimeModulePath(relative);
}

function isRequiredRuntimeModulePath(relative) {
  const parts = relative.split("/");
  if (parts.length === 1) return true;

  const packageName = parts[1];
  const allowedFiles = runtimeModuleFiles.get(packageName);
  if (!allowedFiles) return false;
  if (parts.length === 2) return true;
  return allowedFiles.has(parts.slice(2).join("/"));
}

async function removeUnneededRuntimeModules({ buildPath }) {
  const modulesDirectory = path.join(buildPath, "node_modules");
  const moduleEntries = await readdir(modulesDirectory, {
    withFileTypes: true,
  });

  for (const moduleEntry of moduleEntries) {
    const modulePath = path.join(modulesDirectory, moduleEntry.name);
    const allowedFiles = runtimeModuleFiles.get(moduleEntry.name);
    if (!allowedFiles || !moduleEntry.isDirectory()) {
      await rm(modulePath, { recursive: true, force: true });
      continue;
    }

    const packageEntries = await readdir(modulePath, {
      withFileTypes: true,
    });
    for (const packageEntry of packageEntries) {
      if (!allowedFiles.has(packageEntry.name)) {
        await rm(path.join(modulePath, packageEntry.name), {
          recursive: true,
          force: true,
        });
      }
    }
  }
}

async function assertPackagedAppAllowList(
  packageDirectory,
  architecture,
) {
  const resourcesDirectory = path.join(packageDirectory, "resources");
  const entries =
    architecture === "x64"
      ? listPackage(
          path.join(resourcesDirectory, "app.asar"),
          { isPack: false },
        )
      : await readdir(
          path.join(resourcesDirectory, "app"),
          { recursive: true },
        );
  const normalizedEntries = entries.map((entry) =>
    entry
      .replaceAll("\\", "/")
      .replace(/^\/+/, ""),
  );
  const unexpected = normalizedEntries
    .filter((entry) => !isAllowedAppPath(entry))
    .slice(0, 10);
  if (unexpected.length > 0) {
    throw new Error(
      `${architecture} package contains unexpected app files: ${unexpected.join(", ")}.`,
    );
  }
  const packagedEntries = new Set(normalizedEntries);
  const missingRuntimeFiles = requiredRuntimeFiles.filter(
    (entry) => !packagedEntries.has(entry),
  );
  if (missingRuntimeFiles.length > 0) {
    throw new Error(
      `${architecture} package is missing runtime files: ${missingRuntimeFiles.join(", ")}.`,
    );
  }
}

async function addArm64ServiceSidecar(packageDirectory) {
  const sidecarDirectory = path.join(
    packageDirectory,
    "resources",
    "x64-sidecar",
  );
  await mkdir(sidecarDirectory, { recursive: true });
  const sidecarExecutable = path.join(sidecarDirectory, "node.exe");
  await cp(process.execPath, sidecarExecutable);
  await assertPeArchitecture(sidecarExecutable, "x64");

  const appDirectory = path.join(packageDirectory, "resources", "app");
  for (const requiredFile of [
    path.join(
      appDirectory,
      "node_modules",
      "ffmpeg-static",
      "ffmpeg.exe",
    ),
    path.join(
      appDirectory,
      "node_modules",
      "sherpa-onnx-win-x64",
      "sherpa-onnx.node",
    ),
  ]) {
    try {
      await access(requiredFile);
    } catch {
      throw new Error(
        `The ARM64 x64 service sidecar is missing ${requiredFile}.`,
      );
    }
  }
}

async function addStoreManifest(packageDirectory, architecture) {
  const manifestTemplate = await readFile(
    path.join(storeDirectory, "Package.appxmanifest.template"),
    "utf8",
  );
  const manifest = renderStoreManifest(manifestTemplate, {
    architecture: architecture.name,
    identityName:
      process.env.MS_STORE_IDENTITY_NAME ||
      "ReleasedGroup.Prompter.Dev",
    minimumWindowsVersion: architecture.minimumWindowsVersion,
    publisher:
      process.env.MS_STORE_PUBLISHER ||
      "CN=Released Group Development",
    publisherDisplayName:
      process.env.MS_STORE_PUBLISHER_DISPLAY_NAME ||
      "Released Pty Ltd",
    version: process.env.MS_STORE_VERSION || packageJson.version,
  });
  await writeFile(
    path.join(packageDirectory, "Package.appxmanifest"),
    manifest,
    "utf8",
  );
}

async function assertPeArchitecture(executablePath, architecture) {
  const executable = await readFile(executablePath);
  if (executable.toString("ascii", 0, 2) !== "MZ") {
    throw new Error(`${executablePath} is not a Windows executable.`);
  }

  const peOffset = executable.readUInt32LE(0x3c);
  const machine = executable.readUInt16LE(peOffset + 4);
  const expectedMachine = {
    x64: 0x8664,
    arm64: 0xaa64,
  }[architecture];
  if (machine !== expectedMachine) {
    throw new Error(
      `${executablePath} is not a native ${architecture} executable.`,
    );
  }
}

function toSafeVersion(value) {
  return value.replaceAll(/[^0-9A-Za-z.-]/g, "-");
}
