import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureWindowsX64SpeechRuntime } from "./ensure-windows-x64-speech-runtime.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, "..");
const nodeExecutable = await ensureWindowsX64SpeechRuntime();
const usesX64Sidecar = nodeExecutable !== process.execPath;
let childArguments;
if (usesX64Sidecar) {
  const { build } = await import("esbuild");
  const bundledSmokeTest = path.join(
    rootDirectory,
    ".tmp",
    "windows-x64-speech",
    "smoke-speech.mjs",
  );
  await build({
    absWorkingDir: rootDirectory,
    entryPoints: ["scripts/smoke-speech.ts"],
    outfile: bundledSmokeTest,
    bundle: true,
    external: ["sherpa-onnx-node"],
    format: "esm",
    platform: "node",
    target: "node22",
    banner: {
      js:
        'import { createRequire as __nodeCreateRequire } from "node:module";' +
        "const require = __nodeCreateRequire(import.meta.url);",
    },
  });
  childArguments = [bundledSmokeTest];
} else {
  childArguments = [
    path.join(rootDirectory, "node_modules", "tsx", "dist", "cli.mjs"),
    path.join(scriptDirectory, "smoke-speech.ts"),
  ];
}
const smokeTest = spawn(
  nodeExecutable,
  childArguments,
  {
    cwd: rootDirectory,
    env: {
      ...process.env,
      PROMPTER_ROOT_DIR: rootDirectory,
    },
    stdio: "inherit",
    windowsHide: true,
  },
);

const [exitCode] = await once(smokeTest, "exit");
process.exitCode = exitCode ?? 1;
