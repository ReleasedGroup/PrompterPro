# Product and UX

## Product promise

PrompterPro helps one person deliver a prepared script naturally while recording
clean source video and audio. The presenter can look toward the camera instead
of down at notes, and the prompt reacts to their speech rather than imposing a
fixed scroll speed.

## MVP user journey

1. Open the script library.
2. Create, edit, or generate a script.
3. Select a script and enter Studio.
4. Allow camera and microphone access and confirm the preview.
5. Start recording after a three-second countdown.
6. Speak while the current phrase stays near the camera line.
7. If speech does not match nearby script words, prompt movement pauses and the
   recording continues.
8. Resume from nearby script text and prompt movement catches up.
9. Stop, review, and save the finished MP4.

## Information architecture

The MVP uses two primary workspaces:

- **Scripts** is the preparation space. It contains the library, search,
  editor, and AI generator.
- **Studio** is the performance space. It contains device preview, video,
  prompt overlay, speech-follow status, recording controls, and the result.

Keeping preparation and performance separate reduces accidental edits while
recording and lets Studio devote most of the screen to eye-line and readability.

## Studio states

| State | What the user sees | Available action |
| --- | --- | --- |
| Setup | Device placeholder and selected script | Enable camera and microphone |
| Ready | Live muted preview and prompt | Start recording |
| Countdown | Large 3–2–1 cue | Cancel or wait |
| Recording / following | Green status and moving current phrase | Stop, move prompt manually |
| Recording / off script | Amber status; prompt stays put | Keep speaking or return to nearby text |
| Processing | Recording finalization | Wait briefly |
| Review | MP4 playback, save, new take | Save MP4 or record again |
| Error | Specific recovery message | Retry devices or use manual prompt |

## Voice-following behavior

- Matching is local and bounded around the current prompt position.
- Streaming recognition runs in sherpa-onnx on the same computer; microphone
  samples and transcripts never leave the device.
- Punctuation, capitalization, and minor filler words do not matter.
- A short fuzzy match advances the cursor.
- Large forward jumps require two consistent recognition results.
- Only finalized unmatched phrases count toward off-script status, preventing
  interim recognition guesses from pausing the prompt.
- A match slightly behind or ahead of the cursor resumes following.
- Recording is never paused by alignment status.
- Arrow keys and visible controls provide a manual recovery path.

## Accessibility and operating assumptions

- High-contrast prompt text, status communicated with words as well as color.
- Large controls with visible keyboard focus.
- `Space` starts/stops recording outside editable fields.
- Arrow keys move the prompt in Studio.
- Prompt font size and mirror mode are adjustable.
- Reduced-motion preferences disable smooth scrolling and decorative animation.
- The presenter must explicitly grant camera and microphone permissions.

## Privacy contract

- Script library: local browser storage.
- Video/audio: local browser memory plus a short-lived local temporary file when
  MP4 conversion is required.
- Speech following: microphone PCM travels only over loopback to the local
  sherpa-onnx engine; transcripts remain in memory on this computer.
- AI input: topic, audience, tone, duration, and key points only.
- Never sent to AI: camera, microphone, transcript, recording, or library.
- Recording overlay: UI-only and absent from the saved raw media stream.

## MVP acceptance criteria

- A user can complete the full journey without a developer tool.
- A saved MP4 contains synchronized H.264 video and AAC microphone audio.
- Prompt movement responds to matching speech and stops for unmatched speech.
- Recording duration continues to increase while prompt status is off-script.
- Script CRUD persists after a refresh.
- AI generation produces an editable script or a recoverable error.
- The app builds, type-checks, and its alignment tests pass.
