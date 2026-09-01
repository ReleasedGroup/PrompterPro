# Security Policy

Security and privacy are core requirements for **PrompterPro**.

PrompterPro handles camera video, microphone audio, locally stored scripts, speech recognition, video processing and optional AI-generated content. Vulnerabilities affecting any of these areas may have significant privacy or security implications.

We appreciate responsible disclosure from security researchers, developers and users.

## Supported Versions

PrompterPro is currently under active development.

Security fixes are normally applied to the latest supported release.

| Version                        | Supported   |
| ------------------------------ | ----------- |
| Latest release                 | ✅           |
| Previous releases              | ❌           |
| Development builds from `main` | Best effort |

Users should update to the latest available version before reporting an issue that may already have been addressed.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions or pull requests.**

If Private Vulnerability Reporting is enabled for this repository, use:

**GitHub → Security → Report a vulnerability**

This allows the issue to be discussed privately with the maintainers.

If Private Vulnerability Reporting is not available, contact Released Group privately through an established company contact channel and clearly mark the message:

```text
SECURITY VULNERABILITY - PROMPTERPRO
```

Do not publish details of the vulnerability until the maintainers have had a reasonable opportunity to investigate and remediate it.

## What to Include

A useful security report should contain enough information to reproduce and assess the issue.

Where possible, include:

* a description of the vulnerability
* affected PrompterPro version or commit
* affected platform and architecture
* Windows version
* x64 or ARM64
* Electron, browser or packaged application environment
* steps to reproduce
* expected behaviour
* actual behaviour
* potential security or privacy impact
* proof-of-concept code where appropriate
* relevant logs or screenshots
* any suggested mitigation

Please remove personal information, recordings, API keys, tokens and other sensitive data before sending logs or screenshots.

## Areas of Particular Interest

PrompterPro has several security-sensitive components.

We particularly want to hear about vulnerabilities involving:

### Camera and Microphone Access

Issues that could:

* activate media devices without appropriate user consent
* continue recording unexpectedly
* expose camera or microphone streams
* allow another process or origin to access media
* bypass recording-state protections
* leak audio or video outside the device

### Local Speech Recognition

Speech following is designed to operate locally using sherpa-onnx.

Security reports are particularly relevant if an attacker can:

* access microphone PCM from another machine
* expose speech transcripts remotely
* manipulate the speech WebSocket
* cause arbitrary code execution through speech input
* make the speech service listen on a non-loopback network interface
* bypass origin or connection restrictions

The intended architecture is that speech recognition traffic remains entirely on the local computer.

### Loopback API

PrompterPro operates a local Node API used by the browser and Electron application.

We consider the local API a security boundary.

Relevant vulnerabilities include:

* remote network access to loopback services
* cross-origin request abuse
* cross-site WebSocket hijacking
* unauthorised invocation of privileged operations
* command injection
* arbitrary file reads or writes
* path traversal
* unsafe temporary file handling
* denial-of-service through unbounded requests
* malformed payloads causing unexpected privileged behaviour

A service being bound to localhost does not make input automatically trusted.

### Electron

Electron security issues are high priority.

Examples include:

* renderer-to-main privilege escalation
* arbitrary IPC invocation
* Node.js access from untrusted renderer content
* context isolation bypasses
* unsafe preload APIs
* navigation to untrusted remote content
* arbitrary external protocol execution
* shell command injection
* unsafe permission handling
* loading unsigned or attacker-controlled resources

Changes that weaken Electron isolation or expose unrestricted native functionality should be considered security-sensitive.

### Video and Audio Processing

PrompterPro uses FFmpeg for local media conversion and subtitle rendering.

Relevant vulnerabilities include:

* command injection
* arbitrary option injection
* path traversal
* malicious filename handling
* unexpected network access
* processing attacker-controlled files outside intended boundaries
* temporary file exposure
* failure to remove sensitive temporary media
* arbitrary overwrite of user files
* unsafe subtitle or font processing

Media files should always be treated as untrusted input.

### File and Path Handling

Please report any issue allowing:

* reading arbitrary local files
* overwriting arbitrary local files
* deleting arbitrary local files
* escaping intended temporary directories
* directory traversal
* unsafe symbolic link handling
* manipulation of export destinations
* access to other users' data

### Local Script Storage

Scripts may contain commercially sensitive or personal material.

Relevant issues include:

* unintended disclosure of scripts
* access by another origin
* insecure desktop persistence
* unintended synchronisation
* script data being transmitted externally
* script deletion or corruption caused by malformed input

### OpenAI Integration

AI script generation is optional.

The OpenAI API key is intended to remain server-side and must never be exposed to the browser or Electron renderer.

Please report:

* API key disclosure
* API keys appearing in logs
* secrets bundled into frontend assets
* arbitrary use of the configured OpenAI account
* prompt or parameter injection that crosses a meaningful security boundary
* unintended transmission of recordings, microphone audio or transcripts
* unintended transmission of locally stored scripts

Normal prompt injection that only changes the text generated for the requesting user is generally not considered a security vulnerability unless it crosses an application security or privacy boundary.

### Secrets and Credentials

Please report exposure of:

* OpenAI API keys
* GitHub tokens
* signing certificates
* Microsoft Store credentials
* CI/CD secrets
* cloud credentials
* authentication tokens
* private keys

If you discover a live credential in the repository, report it privately and do not test it beyond what is necessary to establish that exposure exists.

### Windows Packaging and Updates

PrompterPro is distributed as a Windows desktop application.

Relevant issues include:

* package tampering
* executable replacement
* unsigned content being treated as trusted
* insecure package extraction
* DLL search-order hijacking
* insecure sidecar execution
* ARM64/x64 compatibility mechanisms allowing code execution
* update or release artefact substitution
* package identity problems that undermine trust

### Dependency and Supply-Chain Security

PrompterPro depends on npm packages and native components.

We welcome reports involving:

* compromised dependencies
* dependency confusion
* malicious installation scripts
* vulnerable native modules
* unsafe package download behaviour
* insecure speech model downloads
* release artefact tampering

A report consisting only of an automated scanner result with no demonstrated applicability to PrompterPro may be closed without further investigation.

## Security Design Principles

Contributions to PrompterPro should preserve the following principles.

### Local by Default

Camera video, microphone audio, recordings and speech transcripts should remain on the user's computer during normal operation.

### Least Privilege

Every component should receive only the permissions it requires.

In particular:

* renderer code should not have unrestricted Node.js access
* local APIs should expose a minimal attack surface
* filesystem access should be constrained
* subprocess execution should be tightly controlled

### Validate Trust Boundaries

All data crossing a boundary should be treated as potentially hostile.

This includes:

* HTTP input
* WebSocket input
* IPC input
* filenames
* file paths
* media files
* subtitle content
* AI responses
* stored scripts
* environment variables

### No Shell Construction from User Input

User-controlled data must not be concatenated into shell commands.

Where external processes are required, arguments should be passed using structured process APIs rather than command strings.

### Secrets Stay Out of Client Code

Credentials must never be bundled into:

* React assets
* browser JavaScript
* Electron renderer bundles
* public configuration
* source control

### Temporary Data Must Be Temporary

Temporary recordings, generated subtitles and conversion files should:

* use controlled temporary locations
* have unpredictable names where appropriate
* not overwrite arbitrary existing files
* be removed after use
* be removed after failures where practical

## Out of Scope

The following are generally not considered security vulnerabilities unless they can be demonstrated to create meaningful security impact:

* cosmetic UI problems
* missing security headers on a purely local development endpoint with no realistic exploit
* dependency version reports with no relevant vulnerable code path
* denial-of-service requiring the user to intentionally process an extremely large local file
* social engineering
* attacks requiring prior full administrative control of the user's Windows computer
* attacks requiring modification of PrompterPro's installed executable by an already privileged attacker
* AI hallucinations or poor generated script quality
* ordinary prompt injection confined to the user's own AI-generated script
* inability to protect data from another process already running with equivalent or greater user privileges
* theoretical attacks without a plausible exploitation path

That does not mean these issues will never be fixed. They may simply be treated as normal bugs rather than security vulnerabilities.

## Testing Guidelines

Security research must be conducted responsibly.

Please:

* test only on systems and accounts you own or have permission to use
* minimise access to personal information
* stop testing if you encounter data belonging to another person
* do not intentionally damage data
* do not disrupt services used by others
* do not attempt to access unrelated Released Group systems
* do not retain captured audio, video, credentials or personal information
* do not publicly disclose an unresolved vulnerability

Do not use a vulnerability in PrompterPro as a basis for attacking OpenAI, GitHub, Microsoft, npm or other third-party services.

Those vulnerabilities should be reported to the affected provider.

## Coordinated Disclosure

We ask researchers to give maintainers reasonable time to investigate and fix a vulnerability before publishing technical details.

Where appropriate, we will work with the reporter on a coordinated disclosure date.

Please avoid publishing:

* working exploits
* detailed reproduction instructions
* affected implementation details
* screenshots containing sensitive information

until a fix is available or disclosure has otherwise been agreed.

## What You Can Expect

After receiving a valid vulnerability report, maintainers will aim to:

1. acknowledge the report
2. assess whether the issue is reproducible
3. determine severity and affected versions
4. develop and test a remediation
5. release the fix where required
6. coordinate disclosure with the reporter where appropriate

Response and remediation times vary depending on severity, complexity and release requirements.

Critical vulnerabilities affecting user recordings, microphone access, arbitrary code execution, credential disclosure or release integrity will receive priority.

## Severity

PrompterPro generally considers the potential impact and exploitability of a vulnerability.

Examples of **critical or high-severity** findings may include:

* arbitrary code execution
* arbitrary command execution
* remote access to camera or microphone
* unauthorised access to recordings
* extraction of API keys or signing credentials
* remote arbitrary file read or write
* Electron sandbox or privilege-boundary bypass
* compromise of signed release artefacts

Examples of **medium-severity** findings may include:

* meaningful local information disclosure
* exploitable path traversal with constrained impact
* persistent manipulation of application data
* cross-origin access to sensitive loopback functionality

Examples of **low-severity** findings may include:

* minor information disclosure
* limited denial-of-service
* defence-in-depth weaknesses with no current exploitation path

Actual severity will depend on the circumstances of each vulnerability.

## Security Fixes

Security fixes should normally include:

* the remediation
* regression tests where practical
* dependency updates where relevant
* documentation changes if behaviour or assumptions change
* consideration of whether previous releases require action
* consideration of whether credentials or signing material need rotation

Security-related changes may initially be developed privately to avoid exposing the vulnerability before a fix is available.

## Security and Pull Requests

Do not open a public pull request containing an exploitable security fix before discussing the vulnerability privately with maintainers.

A public fix can reveal the vulnerability even if the original issue was never disclosed.

Routine security hardening that does not expose an existing exploitable vulnerability may be submitted through the normal contribution process.

## No Bug Bounty

Unless explicitly announced otherwise, PrompterPro and Released Group do not currently operate a public bug bounty programme and cannot guarantee payment or rewards for vulnerability reports.

Responsible security research and disclosure are nevertheless appreciated.

## Safe Harbour

Released Group supports good-faith security research conducted in accordance with this policy.

We will not seek action against researchers who:

* act in good faith
* stay within the scope of PrompterPro
* avoid privacy violations and unnecessary data access
* do not cause intentional harm
* report vulnerabilities privately
* provide reasonable time for remediation
* comply with applicable law

This safe-harbour statement does not authorise testing of third-party systems and cannot grant exemptions from laws or contractual obligations that Released Group does not control.

## Thank You

Security researchers help make PrompterPro safer for everyone.

If you believe you have found a vulnerability, please report it privately rather than attempting to prove its impact beyond what is necessary.
