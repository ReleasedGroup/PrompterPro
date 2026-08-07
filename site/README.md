# SimplePrompt website

This folder contains the standalone SimplePrompt marketing website. Its entry
point uses plain HTML, CSS, and JavaScript, so it works directly with VS Code
Live Server. The React source remains available for typed component development,
and the site builds separately from the desktop application.

From the repository root:

```powershell
npm.cmd run site:dev
npm.cmd run site:build
```

The production site is written to `site/dist/`.

`site:dev` and `site:build` regenerate the Live Server-compatible `index.html`
from `src/App.tsx` before starting or building, keeping the static entry point
and typed source in sync.
