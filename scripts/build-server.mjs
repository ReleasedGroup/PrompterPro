import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, "..");

await build({
  absWorkingDir: rootDirectory,
  entryPoints: ["server/index.ts"],
  outfile: "dist-server/index.mjs",
  bundle: true,
  external: ["ffmpeg-static", "sherpa-onnx-node"],
  format: "esm",
  platform: "node",
  target: "node22",
  banner: {
    js:
      'import { createRequire as __nodeCreateRequire } from "node:module";' +
      "const require = __nodeCreateRequire(import.meta.url);",
  },
});
