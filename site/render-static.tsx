import { writeFile } from "node:fs/promises";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const { default: App } = await import("./src/App");
const markup = renderToStaticMarkup(<App />);
const outputPath = path.join(import.meta.dirname, "index.html");

const document = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0a0c0d" />
    <meta
      name="description"
      content="SimplePrompt is the private teleprompter that follows your voice and helps every take feel natural."
    />
    <link rel="icon" href="./simpleprompt-mark.svg" />
    <link rel="stylesheet" href="./src/styles.css" />
    <title>SimplePrompt — Your words. Your pace.</title>
  </head>
  <body>
    ${markup}
    <script type="module" src="./site.js"></script>
  </body>
</html>
`;

await writeFile(outputPath, document, "utf8");
