# Delivery plan and roadmap

## Phase 0 — Product and technical framing

Completed in this MVP:

- Define the core journey and privacy contract.
- Separate the prompt overlay from the raw recording stream.
- Choose portable boundaries for recording, speech, storage, and AI.
- Document states, recovery paths, and acceptance criteria.

## Phase 1 — Windows-first MVP

Included:

- Local script library and editor.
- AI draft generator through a server-side OpenAI call.
- Selectable camera/microphone preview and raw recording.
- Speech-following prompt with off-script pause/resume.
- Offline streaming sherpa-onnx recognition over a loopback-only audio path.
- Manual prompt controls, font sizing, and mirroring.
- Local MP4 finalization, review, and save.
- Installable PWA configuration.
- Microsoft Store-ready x64/ARM64 Electron shells, MSIX bundle packaging and
  listing assets.
- CI validation plus tagged Store update automation.
- Unit tests for speech alignment plus build/type validation.

Release gate:

- Verify the full flow manually in current Edge on a Windows machine with a real
  camera and microphone.
- Verify the signed Store package on a clean supported Windows computer.
- Make a 10-minute recording and check audio/video sync, memory, download, and
  playback.
- Test scripted detours, filler words, repeated lines, and resumption.

## Phase 2 — Desktop beta

- Stream chunks to the File System Access API to support long recordings.
- Input levels, resolution, frame rate, and microphone monitoring.
- Recording history and safe recovery after a crash.
- Import/export scripts and keyboard/remote control.
- Additional downloadable speech models and language selection.
- Add telemetry only with consent and never capture script/media contents.

## Phase 3 — Mobile and macOS

- Wrap the shared UI with Capacitor for iOS and Android.
- Implement native recording, file, permission, and speech adapters.
- Add orientation-safe layouts, safe-area handling, and Bluetooth remote input.
- Test interruptions: calls, lock screen, app backgrounding, route changes, and
  low storage.
- Package macOS with Tauri or a signed PWA wrapper based on distribution needs.

## Phase 4 — Production service

- Accounts, encrypted cloud sync, versions, folders, and team sharing.
- Hosted authenticated AI endpoint with per-user quotas and abuse controls.
- Optional cloud recording backup with explicit consent and retention policy.
- Cross-device script and recording metadata.
- Accessibility audit, localization, privacy review, and store compliance.

## Product decisions to validate with users

- Whether presenters prefer current-word highlighting, sentence highlighting,
  or a fixed reading band.
- How aggressively the prompt should jump forward after an improvised section.
- Whether script generation should optimize for spoken cadence, brand voice,
  platform format, or all three through templates.
- Whether the primary output is a downloaded raw take or an in-app project with
  editing and captions.
- Whether professional users require offline-only speech recognition.

## Test strategy

- Unit: normalization, fuzzy alignment, cursor bounds, resumption, repeated text.
- Component: script CRUD, generation errors, studio state transitions.
- Browser: device denial, missing local model, speech-engine disconnect,
  record/stop/download.
- Hardware: multiple cameras/mics, Bluetooth devices, 720p/1080p, long takes.
- Platform: Edge/Chrome Windows first; Safari/iOS and Android only after native
  adapter decisions.
