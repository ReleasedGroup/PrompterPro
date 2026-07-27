# Architecture

## Decision summary

The MVP is a React/TypeScript progressive web app served with a small Node API.
It targets current Edge and Chrome on Windows and is wrapped by an Electron
desktop shell for Microsoft Store distribution. Product logic is isolated
behind browser-facing adapters so other native shells can be added without
rewriting the script library, alignment algorithm, or studio state model.

## Runtime shape

```mermaid
flowchart LR
  U["Presenter"] --> UI["React PWA"]
  WIN["Electron / MSIX"] --> UI
  WIN --> API
  UI --> LS["Local script store"]
  UI --> CAM["getUserMedia"]
  CAM --> PREVIEW["Muted preview"]
  CAM --> REC["MediaRecorder"]
  REC --> MP4{"Native MP4?"}
  MP4 -->|"Yes"| FILE["MP4 with video/audio"]
  MP4 -->|"No"| FFMPEG["Local FFmpeg conversion"]
  FFMPEG --> FILE
  U --> PCM["AudioWorklet PCM"]
  PCM -->|"Loopback WebSocket"| STT["Local sherpa-onnx"]
  STT --> ALIGN["Bounded fuzzy alignment"]
  ALIGN --> OVERLAY["Prompt overlay"]
  UI --> API["Local Node API"]
  API --> OAI["OpenAI Responses API"]
  OAI --> API
  API --> UI
```

The preview and overlay are sibling UI layers. `MediaRecorder` receives the
original `MediaStream`, not a canvas composition, so the overlay is not recorded.

## Modules

- `src/lib/alignment.ts`: pure normalization, tokenization, and bounded fuzzy
  matching. The prompt renderer uses the same token stream so display and
  alignment indices cannot drift on hyphenated or punctuated words.
- `server/localSpeech.ts`: loopback WebSocket and streaming sherpa-onnx
  recognizer lifecycle.
- `src/hooks/useSpeechFollower.ts`: microphone PCM transport and prompt
  follow/off-script state.
- `src/hooks/useLocalScripts.ts`: local persistence and CRUD.
- `src/components/Studio.tsx`: media device and recorder state machine.
- `src/components/TeleprompterOverlay.tsx`: prompt rendering, eye-line, and
  current-word scrolling.
- `server/index.ts`: input validation, local MP4 conversion, and server-side
  OpenAI call.
- `scripts/build-server.mjs`: bundles the local API's JavaScript dependencies
  while leaving only FFmpeg and the native speech loader external.
- `desktop/main.mjs`: hardened Electron window, media permissions and lifecycle
  for the loopback Node service. The ARM64 shell starts a bundled x64 Node
  sidecar under Windows 11 compatibility so the existing offline speech and
  FFmpeg binaries remain available.
- `scripts/package-windows.mjs`: Electron packaging, offline model inclusion and
  unsigned x64/ARM64 MSIX bundle creation.

## Recording and MP4 export

Studio requires one live video track and one live audio track before recording.
It requests a high-resolution stream, reads the selected camera's reported
capabilities, and applies the maximum available width and height. Recorder
bitrate scales with the negotiated resolution and frame rate, with a
browser-selected bitrate fallback for encoders that reject an explicit rate.
Studio prefers a browser-native MP4 MediaRecorder profile. Where that is not
available, it records a WebM/Opus take and posts it only to the loopback API.
The API converts it to H.264/AAC MP4 with the bundled FFmpeg executable, returns
the file for review/save, and removes its temporary working directory.

## Alignment approach

The browser uses an `AudioWorklet` to copy mono PCM from the recording's
existing microphone track. It sends those frames only to `/api/speech` on the
loopback PrompterPro server. sherpa-onnx resamples to 16 kHz, decodes incrementally,
and returns partial and endpoint-finalized text over the same WebSocket. The
small English Zipformer model is installed once with `npm run speech:model` and
is ignored by Git.

For each recognition update:

1. Normalize words to lowercase alphanumeric tokens.
2. Take the most recent 12-word phrase window.
3. Compare it with candidate windows from a small range behind and ahead of the
   current script cursor.
4. Score candidates with ordered token similarity (LCS), exact phrase bonus,
   and proximity preference.
5. Advance only above a confidence threshold.
6. Require two consistent recognition results before a large forward jump.
7. Use partial text for responsive advancement, but count only finalized
   unmatched phrases toward off-script status.
8. Resume immediately when nearby script text matches again; silence alone does
   not move the cursor or stop recording.

Alignment is deterministic and local. Prompt movement uses smooth scrolling,
with reduced-motion preferences respected.

## AI generation

The browser calls `POST /api/scripts/generate`. The server validates and limits
the form, constructs an outcome-first prompt, then calls the OpenAI Responses
API. `OPENAI_API_KEY` remains server-side. The model can be overridden with
`OPENAI_MODEL`; the default is `gpt-5.6-sol`.

The request asks for plain script text only, with a target word count derived
from duration. Generated text is returned to the editor and is never
automatically saved over another script.

## Portability path

| Capability | MVP adapter | Future adapter |
| --- | --- | --- |
| UI/domain | React PWA | Shared React UI |
| Windows shell | Electron/MSIX bundle or installed Edge PWA | Shared Store release automation |
| iOS/Android shell | Browser/PWA exploration | Capacitor |
| Recording | `MediaRecorder` | Capacitor/native recorder |
| Speech recognition | Local sherpa-onnx through loopback | Native sherpa-onnx adapter |
| Script storage | `localStorage` | SQLite with migration |
| Files | Browser download | Native file picker/media library |
| AI | Local Node API | Hosted authenticated API |

The production mobile phase should choose native speech and recording adapters
before promising equivalent background behavior or codec support.

## Security and reliability

- API key only in ignored `.env.local`, never bundled into client code.
- API body limit and field-length validation.
- Media requires an explicit user gesture and browser permission.
- No microphone sample, transcript, or recording leaves the device in the MVP.
  Speech recognition and MP4 conversion use only the loopback API; conversion
  uses a short-lived local temporary directory.
- Object URLs are revoked when replaced to prevent memory leaks.
- Every route out of Studio uses the same recording-aware confirmation guard,
  preventing navigation from silently discarding an active take.
- Long recordings currently remain in memory; chunked file writing is a
  post-MVP reliability requirement.

## Known MVP constraints

- The bundled setup model recognizes English only and adds about 130 MB to a
  local installation.
- Recognition speed and quality depend on the Windows computer's CPU and
  microphone.
- Long recordings consume memory until stopped and downloaded.
- MP4 fallback conversion briefly uses additional local disk, CPU, and memory.
- Scripts do not yet sync across devices or users.
- There is no account, cloud library, or server-side recording store.
