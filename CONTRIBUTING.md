# Contributing to PrompterPro

Thanks for your interest in contributing to **PrompterPro**.

PrompterPro is a Windows-first teleprompter application built around a simple principle: help presenters record polished video while keeping the recording, speech recognition and script experience as local and private as practical.

Contributions are welcome, including bug fixes, performance improvements, accessibility improvements, documentation, tests and well-scoped new features.

This document explains how we expect contributions to be developed, tested and submitted.

## Before You Start

For anything more substantial than a small bug fix or documentation change, please **open a GitHub issue first**.

Describe:

* the problem you are trying to solve
* the proposed behaviour
* why the change is useful
* any user experience implications
* any architectural or privacy implications
* alternatives you have considered

This gives maintainers a chance to discuss the approach before significant development effort is spent.

Please do not submit a large feature as an unexpected pull request.

## Development Environment

PrompterPro currently targets Windows and requires:

* Windows 11 recommended
* Node.js 22.12 or later
* npm
* Current Microsoft Edge or Google Chrome
* Git

Clone the repository and install the dependencies:

```powershell
git clone https://github.com/ReleasedGroup/PrompterPro.git
cd PrompterPro
npm.cmd install
```

Install the local speech recognition model:

```powershell
npm.cmd run speech:model
```

Then start the development environment:

```powershell
npm.cmd run dev
```

Open:

```text
http://localhost:5173
```

Allow camera and microphone permissions when prompted.

The speech model is downloaded into the ignored `.models` directory and does not need to be committed.

## Optional OpenAI Configuration

AI-assisted script generation is optional.

If you need to work on that functionality, create:

```text
.env.local
```

and add:

```text
OPENAI_API_KEY=your-key-here
```

Never commit API keys, credentials, tokens or other secrets.

The OpenAI API key must remain server-side. Do not expose it through Vite environment variables, browser JavaScript, React components or Electron renderer code.

## Project Architecture

PrompterPro is deliberately split into several responsibilities.

The main areas are:

```text
src/        React application and browser-side product logic
server/     Local Node API, speech recognition and media processing
desktop/    Electron desktop shell
scripts/    Build, packaging and development utilities
tests/      Automated tests
docs/       Product, architecture and planning documentation
store/      Microsoft Store packaging and release material
site/       Public website
```

Before changing an architectural boundary, read:

```text
docs/ARCHITECTURE.md
```

In particular, contributors should preserve the separation between product/domain logic and platform-specific adapters wherever practical.

### Important Components

Some of the more important areas of the application include:

* `src/lib/alignment.ts` for script tokenisation and speech alignment
* `src/hooks/useSpeechFollower.ts` for speech transport and following state
* `src/hooks/useLocalScripts.ts` for script persistence
* `src/components/Studio.tsx` for media and recording behaviour
* `src/components/TeleprompterOverlay.tsx` for prompt display and scrolling
* `src/lib/videoExport.ts` for export preparation
* `server/localSpeech.ts` for local sherpa-onnx recognition
* `server/subtitleExport.ts` for subtitle generation
* `server/index.ts` for the local API
* `desktop/main.mjs` for the Electron application
* `scripts/package-windows.mjs` for Windows packaging

Try to make changes in the layer that actually owns the behaviour rather than adding workarounds higher in the stack.

## Core Engineering Principles

### Keep Recording Clean

The teleprompter must never accidentally become part of the recorded camera output.

The preview and teleprompter are separate UI layers. Recording should continue to use the original camera and microphone streams rather than a rendered composition of the UI.

A change to media handling must preserve this property.

### Keep Speech Recognition Local

The normal speech-following path is intentionally local.

Microphone PCM is sent only to the PrompterPro API on the loopback interface and processed using sherpa-onnx.

Do not introduce cloud speech recognition, analytics, telemetry or third-party audio processing without prior architectural discussion.

### Protect User Media

Camera video, microphone audio, recordings and speech transcripts should not leave the user's machine as part of normal PrompterPro operation.

Any contribution that changes this behaviour requires explicit maintainer approval and corresponding privacy documentation.

### Preserve Offline Operation

Core teleprompter, recording and local speech-following functionality should continue to work without an internet connection once required application assets and the speech model are installed.

Features that genuinely require the internet should degrade gracefully when it is unavailable.

### Prefer Deterministic Behaviour

Speech alignment, caption timing, export preparation and other core product logic should be deterministic wherever practical.

Avoid unnecessarily pushing logic into AI models when conventional code can reliably perform the task.

## Working on a Change

Create a branch from the latest `main`:

```powershell
git checkout main
git pull
git checkout -b feature/short-description
```

For fixes:

```text
fix/short-description
```

For documentation:

```text
docs/short-description
```

Keep each branch focused on one logical change.

Avoid mixing unrelated refactoring, formatting or dependency updates into a feature pull request.

## Coding Guidelines

PrompterPro uses TypeScript extensively. New application and server code should normally be written in TypeScript unless the surrounding implementation has a reason to use JavaScript.

### General Expectations

Code should be:

* readable
* strongly typed
* reasonably small and composable
* explicit about failure conditions
* testable
* consistent with surrounding code
* free from unnecessary dependencies

Prefer straightforward code over clever code.

Avoid `any` unless integration with an untyped boundary genuinely requires it.

Avoid silently swallowing exceptions.

Validate data entering trust boundaries, particularly:

* HTTP requests
* WebSocket messages
* IPC messages
* file operations
* generated subtitle/export data
* user-controlled configuration

### React

Keep business logic out of presentation components where practical.

Reusable or stateful behaviour should generally live in:

* hooks
* domain/library modules
* platform adapters

Components should focus primarily on rendering and user interaction.

Do not introduce global state management libraries without discussing the architectural need first.

### Electron

Treat Electron renderer content as untrusted.

Do not weaken:

* context isolation
* permission handling
* renderer isolation
* IPC validation
* local API restrictions

Do not enable arbitrary Node.js access from renderer code for convenience.

### Server

The local server should expose only the functionality required by PrompterPro.

Endpoints should:

* validate input
* limit payload size where appropriate
* return useful errors
* avoid leaking secrets
* clean up temporary resources
* remain safe when receiving malformed input

Localhost is not a substitute for input validation.

## Tests

Changes to product behaviour should include tests where reasonably possible.

Tests are particularly important for:

* speech alignment
* tokenisation
* state transitions
* timing calculations
* caption generation
* input validation
* regression fixes

A bug fix should ideally include a test that fails before the fix and passes afterwards.

Run the test suite with:

```powershell
npm.cmd test
```

For development:

```powershell
npm.cmd run test:watch
```

## Required Validation

Before submitting a pull request, run:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run speech:smoke
npm.cmd run build
npm.cmd run build:desktop
```

For changes affecting ARM64 packaging or the speech sidecar, also run:

```powershell
npm.cmd run speech:smoke:arm64
```

If your change affects Windows packaging, test:

```powershell
npm.cmd run package:windows
```

Pull requests are validated through GitHub Actions.

CI currently checks:

* dependency vulnerabilities
* automated tests
* TypeScript compilation
* offline speech recognition
* web build
* desktop server build

A pull request should not be considered ready for review while known CI failures remain.

## Dependency Changes

Avoid adding packages unless they provide a clear benefit that is difficult to achieve with the existing stack.

When introducing a dependency, consider:

* maintenance activity
* licence compatibility
* package size
* transitive dependencies
* known vulnerabilities
* Electron compatibility
* Windows x64 compatibility
* Windows ARM64 compatibility
* offline operation

Changes to `package.json` should include the corresponding `package-lock.json` changes.

Do not manually edit the lock file.

Run:

```powershell
npm install
```

or an appropriate npm command instead.

## Security

Security issues should not be disclosed publicly through an ordinary GitHub issue if doing so would expose users to a meaningful vulnerability.

For normal contributions:

* never commit credentials
* never log API keys
* never send user recordings to external services
* never introduce hidden telemetry
* never execute user-controlled shell commands
* validate filenames and paths
* treat uploaded/generated media as untrusted
* clean up temporary files
* minimise Electron privileges

If a design requires relaxing an existing security boundary, explain the requirement clearly in the pull request.

## Privacy

Privacy is a product requirement, not an optional enhancement.

Current design expectations include:

* scripts remain locally stored
* recordings remain local
* microphone samples remain local
* transcripts remain local
* speech recognition remains local
* media conversion occurs locally
* temporary conversion files are removed
* only explicitly requested AI script-generation content is sent to OpenAI

Any contribution affecting these assumptions must update the relevant documentation and receive explicit maintainer review.

## User Experience

PrompterPro is used while someone is actively presenting to a camera, so unnecessary friction is particularly noticeable.

Changes to Studio should consider:

* readability at a distance
* predictable scrolling
* keyboard operation
* reduced-motion preferences
* accidental navigation during recording
* clear recording state
* camera and microphone failure states
* recovery when speech recognition is unavailable

Do not sacrifice reliability for visual novelty.

## Performance

Recording, speech recognition and video conversion can all be resource intensive.

Take care with:

* unnecessary React renders
* large object allocations
* media blobs
* audio buffers
* retained object URLs
* temporary files
* repeated speech processing
* long-running recordings

Object URLs, streams, sockets, timers and temporary files should be explicitly cleaned up when they are no longer required.

## Documentation

Update documentation when a contribution changes:

* user-visible behaviour
* installation
* architecture
* configuration
* privacy
* packaging
* release procedures

Relevant documentation lives under `docs/` and `store/`.

Code and documentation should land together where practical.

## Commit Messages

Write concise commit messages that explain what changed.

Good:

```text
Fix speech cursor jump after long pause
Add validation for subtitle timing data
Improve ARM64 sidecar startup handling
Document local model configuration
```

Avoid:

```text
fix
changes
updates
stuff
wip
```

Intermediate commits can be messy while developing, but the resulting pull request should tell a coherent story.

## Pull Requests

Pull requests should have a clear title and description.

Include:

### What changed

Explain the implementation.

### Why

Explain the problem being solved.

### How it was tested

List the validation you performed.

For example:

```text
- npm test
- npm run typecheck
- npm run speech:smoke
- npm run build:desktop
- manually tested recording in Edge on Windows 11
```

### Screenshots or recordings

Include these for meaningful UI changes.

### Related issue

Use GitHub's issue syntax where applicable:

```text
Fixes #123
```

### Risks

Call out changes involving:

* recording
* microphone handling
* speech recognition
* video conversion
* Electron security
* local storage
* privacy
* packaging
* ARM64 support

Do not hide known limitations from reviewers.

## Pull Request Size

Smaller, focused pull requests are easier to review and safer to merge.

Prefer:

```text
one problem → one logical change → one pull request
```

Large changes should normally be broken into a sequence of independently reviewable changes.

If a change is inherently large, discuss the implementation approach in an issue before beginning.

## AI-Assisted Contributions

AI-assisted development is welcome.

The contributor remains responsible for every line submitted.

Before submitting AI-generated or AI-assisted code:

* understand what the code does
* remove unnecessary generated complexity
* verify APIs actually exist
* check security implications
* check privacy implications
* run the complete validation suite
* add or update tests
* remove generated comments that provide no useful information
* ensure the implementation matches PrompterPro's architecture

"AI generated it" is not an acceptable explanation for broken, insecure or unmaintainable code.

## Review

Maintainers may request changes for:

* correctness
* architecture
* maintainability
* user experience
* security
* privacy
* test coverage
* platform compatibility
* unnecessary complexity

Review comments are about improving the contribution, not the contributor.

Please respond to review comments and resolve threads once the underlying concern has been addressed.

Approval is not guaranteed simply because CI passes.

## Definition of Done

A contribution is generally ready to merge when:

* the change solves the stated problem
* the implementation fits the architecture
* relevant tests exist
* existing tests pass
* TypeScript passes type checking
* speech smoke testing passes where applicable
* web and desktop builds pass
* security and privacy requirements are preserved
* documentation is current
* the pull request explains what changed and why
* review feedback has been addressed

## Licence and Contribution Rights

By submitting a contribution, you confirm that you have the right to submit the work and that doing so does not knowingly introduce third-party intellectual property that the project is not entitled to use.

Do not copy code, media, fonts, models or other assets from another project unless its licence clearly permits use in PrompterPro.

If third-party material is required, identify its source and licence in the pull request.

## Questions

If you are unsure how a feature should be implemented, open an issue before writing substantial code.

Good contributions do not just add code. They make PrompterPro simpler, safer, more reliable or more useful.

Thanks for contributing.
