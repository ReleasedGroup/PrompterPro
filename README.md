# Prompter

Prompter is a Windows-first, installable teleprompter MVP. It records raw
camera and microphone media while an on-screen script follows the speaker.
If the speaker leaves the script, the prompt pauses; when matching speech is
heard again, it resumes. The prompt overlay is never burned into the recording.

## MVP features

- Create, edit, duplicate, search, and delete scripts stored on this device.
- Generate a first draft from a topic, audience, tone, duration, and key points.
- Preview camera and microphone before recording.
- Record raw video and audio with the browser's `MediaRecorder`.
- Follow spoken words with browser speech recognition in Edge or Chrome.
- Pause prompt movement when speech leaves the script without pausing recording.
- Review and save every finished take as an MP4 with H.264 video and AAC audio.
- Install the app as a PWA on Windows.

## Run locally

Requirements: Node.js 20+ and current Microsoft Edge or Google Chrome.

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:5173`. Allow camera and microphone access when prompted.
The local API reads `OPENAI_API_KEY` from `.env.local`.

For a production-like local run:

```powershell
npm.cmd run build
npm.cmd start
```

Then open `http://localhost:8787`.

## Validation

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

## Browser support

The complete MVP is targeted at current Edge and Chrome on Windows. The app
records native MP4 when available; otherwise the local API converts the
browser's WebM take to MP4 with its bundled FFmpeg binary. Speech-following
requires the browser speech-recognition API; if it is unavailable, recording
still works and the prompt can be moved with the on-screen controls or arrow
keys.

## Product documentation

- [Product and UX](docs/PRODUCT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Delivery plan and roadmap](docs/PLAN.md)

## Privacy

Scripts are stored locally in browser storage. Camera and microphone media stay
on this computer. A WebM take may pass through the local API at
`127.0.0.1` solely for MP4 conversion and is removed from its temporary folder
after export. Only the AI generation form is sent to OpenAI; camera, microphone,
recordings, transcripts, and the script library are not.
