import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureWindowsX64SpeechRuntime } from "./ensure-windows-x64-speech-runtime.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, "..");
const nodeExecutable = await ensureWindowsX64SpeechRuntime();
const usesX64Sidecar = nodeExecutable !== process.execPath;
if (usesX64Sidecar) {
  await import(`./build-server.mjs?dev=${Date.now()}`);
}
const childArguments = usesX64Sidecar
  ? [path.join(rootDirectory, "dist-server", "index.mjs")]
  : [
      path.join(rootDirectory, "node_modules", "tsx", "dist", "cli.mjs"),
      "watch",
      "server/index.ts",
    ];
const child = spawn(
  nodeExecutable,
  childArguments,
  {
    cwd: rootDirectory,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!child.killed) child.kill();
  });
}

const [exitCode] = await once(child, "exit");
process.exitCode = exitCode ?? 1;
