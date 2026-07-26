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
- Follow spoken words with local, streaming sherpa-onnx recognition.
- Pause prompt movement when speech leaves the script without pausing recording.
- Review and save every finished take as an MP4 with H.264 video and AAC audio.
- Install the app as a PWA or packaged Microsoft Store desktop app on Windows.

## Run locally

Requirements: Node.js 22.12+ and current Microsoft Edge or Google Chrome.

```powershell
npm.cmd install
npm.cmd run speech:model
npm.cmd run dev
```

Open `http://localhost:5173`. Allow camera and microphone access when prompted.
The one-time model command downloads the 122 MB English Zipformer model into
the ignored `.models` directory. Recognition then runs without internet access.
The local API reads the optional `OPENAI_API_KEY` from `.env.local`.

For a production-like local run:

```powershell
npm.cmd run build
npm.cmd start
```

Then open `http://localhost:8787`.

For the packaged desktop app:

```powershell
npm.cmd run desktop
```

To create an unsigned x64 MSIX on Windows:

```powershell
npm.cmd run package:windows
```

See the [Microsoft Store release guide](store/README.md) for Partner Center
identity settings, automated releases, listing copy and submission checks.

## Validation

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run speech:smoke
npm.cmd run build
npm.cmd run build:desktop
```

The speech smoke test uses the downloaded model and its bundled reference audio
to exercise the same loopback WebSocket used by Studio.

## Browser support

The complete MVP is targeted at the packaged Windows desktop app and current
Edge or Chrome on Windows. The app records native MP4 when available; otherwise
the local API converts the browser's WebM take to MP4 with its bundled FFmpeg
binary. Speech-following streams PCM only to the Prompter API at `127.0.0.1`,
where sherpa-onnx performs recognition. If the local model is not installed,
recording still works and the prompt can be moved with the on-screen controls
or arrow keys.

Set `SHERPA_ONNX_MODEL_DIR` to use the same model from another location, or
`SHERPA_ONNX_THREADS` to choose 1–4 CPU inference threads.

## Product documentation

- [Product and UX](docs/PRODUCT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Delivery plan and roadmap](docs/PLAN.md)
- [Microsoft Store release guide and listing](store/README.md)
- [Privacy policy](store/PRIVACY.md)

## Privacy

Scripts are stored locally in browser storage. Camera and microphone media stay
on this computer. Microphone samples and transcripts used for prompt following
travel only over the loopback interface to the local sherpa-onnx engine. A WebM
take may pass through the same local API for MP4 conversion and is removed from
its temporary folder after export. Only the optional AI generation form is sent
to OpenAI; camera, microphone, recordings, transcripts, and the script library
are not.
