import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  access,
  cp,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
const outputDirectory = path.join(rootDirectory, "out");
const packageJson = JSON.parse(
  await readFile(path.join(rootDirectory, "package.json"), "utf8"),
);

if (process.platform !== "win32") {
  throw new Error("The Windows MSIX package must be built on Windows.");
}

try {
  await access(path.join(modelDirectory, "tokens.txt"));
} catch {
  throw new Error(
    "The offline speech model is missing. Run npm run speech:model first.",
  );
}

console.log("Packaging the Electron desktop application...");
const packagePaths = await packager({
  dir: rootDirectory,
  name: "Prompter",
  executableName: "Prompter",
  platform: "win32",
  arch: "x64",
  out: outputDirectory,
  overwrite: true,
  prune: true,
  asar: {
    unpack: "**/*.{node,dll,exe}",
  },
  icon: path.join(storeDirectory, "assets", "AppIcon.ico"),
  extraResource: [modelDirectory],
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
  ignore: (file) => {
    const relative = path
      .relative(rootDirectory, file)
      .replaceAll(path.sep, "/");
    if (!relative || relative.startsWith("../")) return false;
    const topLevel = relative.split("/", 1)[0];
    return !new Set([
      "desktop",
      "dist",
      "dist-server",
      "node_modules",
      "package-lock.json",
      "package.json",
    ]).has(topLevel);
  },
});

if (packagePaths.length !== 1) {
  throw new Error(`Expected one Windows package directory, got ${packagePaths.length}.`);
}

const packageDirectory = packagePaths[0];
await cp(
  path.join(storeDirectory, "assets"),
  path.join(packageDirectory, "Assets"),
  { recursive: true },
);

const manifestTemplate = await readFile(
  path.join(storeDirectory, "Package.appxmanifest.template"),
  "utf8",
);
const manifest = renderStoreManifest(manifestTemplate, {
  identityName:
    process.env.MS_STORE_IDENTITY_NAME || "ReleasedGroup.Prompter.Dev",
  publisher:
    process.env.MS_STORE_PUBLISHER || "CN=Released Group Development",
  publisherDisplayName:
    process.env.MS_STORE_PUBLISHER_DISPLAY_NAME || "Released Group",
  version: process.env.MS_STORE_VERSION || packageJson.version,
});
const manifestPath = path.join(packageDirectory, "Package.appxmanifest");
await writeFile(manifestPath, manifest, "utf8");

const msixOutputDirectory = path.join(outputDirectory, "store");
await mkdir(msixOutputDirectory, { recursive: true });
const msixPath = path.join(
  msixOutputDirectory,
  `Prompter_${toSafeVersion(process.env.MS_STORE_VERSION || packageJson.version)}_x64.msix`,
);
const winAppCli = path.join(
  rootDirectory,
  "node_modules",
  "@microsoft",
  "winappcli",
  "dist",
  "cli.js",
);

console.log("Creating the unsigned MSIX package...");
const winApp = spawn(
  process.execPath,
  [
    winAppCli,
    "package",
    packageDirectory,
    "--output",
    msixPath,
    "--manifest",
    manifestPath,
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

console.log(`Windows Store package created at ${msixPath}`);

function toSafeVersion(version) {
  return version.replaceAll(/[^0-9A-Za-z.-]/g, "-");
}
