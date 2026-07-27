# Microsoft Store release guide

Prompter is packaged as native x64 and ARM64 Electron desktop applications and
then combined into an unsigned MSIX bundle. Microsoft Store signs the accepted
bundle during submission.

The ARM64 shell uses a bundled x64 Node sidecar through Windows 11's
compatibility layer because the offline sherpa runtime and FFmpeg do not publish
Windows ARM64 binaries. Camera UI and rendering remain native ARM64, while
voice-following and MP4 fallback preserve the same local behaviour as x64.
The Store bundle therefore targets Windows 11 for both architecture slices.

## One-time Partner Center setup

1. Reserve the product name in Partner Center.
2. Copy the product's Package/Identity/Name, Publisher and Publisher display
   name into the repository variables listed below.
3. Build the first package and complete its listing using
   [`listing/en-AU.md`](listing/en-AU.md), the images in `assets/`, the product
   screenshot in `listing/screenshots/`, and [`PRIVACY.md`](PRIVACY.md).
4. Submit the first release manually. Store CLI publishing is used only after
   the product is live.

## GitHub configuration

Repository variables:

- `MS_STORE_PRODUCT_ID`
- `MS_STORE_IDENTITY_NAME`
- `MS_STORE_PUBLISHER`
- `MS_STORE_PUBLISHER_DISPLAY_NAME`

Repository secrets for a Microsoft Entra application authorised in Partner
Center:

- `AZURE_AD_APPLICATION_CLIENT_ID`
- `AZURE_AD_APPLICATION_SECRET`
- `AZURE_AD_TENANT_ID`
- `SELLER_ID`

Protect the secrets with the repository's release controls. Automated Store
updates are intended for a free product; paid-product submissions require the
Partner Center workflow.

## Build locally

Use Node.js 22.12 or later on Windows:

```powershell
npm.cmd ci
npm.cmd run speech:model
npm.cmd run package:windows
npm.cmd run speech:smoke:arm64
```

For a Partner Center package, set the reserved identity first:

```powershell
$env:MS_STORE_IDENTITY_NAME = "YourReservedIdentityName"
$env:MS_STORE_PUBLISHER = "CN=YourPublisherIdentity"
$env:MS_STORE_PUBLISHER_DISPLAY_NAME = "Your Publisher Name"
$env:MS_STORE_VERSION = "1.0.0"
npm.cmd run package:windows
```

The `Prompter_<version>_x64_arm64.msixbundle` file is written to `out/store/`.
The unsigned local-development identity is useful for validation but must not
be submitted to Partner Center.

The server build bundles ordinary JavaScript dependencies. Packaging retains
only the FFmpeg executable and sherpa-onnx loader/native files outside that
bundle, avoiding thousands of development and transitive dependency artifacts
in the ARM64 application payload.

To write a verification package somewhere other than `out`, set a path relative
to the repository (or an absolute path) for both packaging and the sidecar smoke
test:

```powershell
$env:PROMPTER_PACKAGE_OUTPUT_DIR = "out\verification"
npm.cmd run package:windows
npm.cmd run speech:smoke:arm64
```

## Automated releases

The Store release workflow validates and uploads an MSIX bundle artifact for a
`vMAJOR.MINOR.PATCH` tag or a manual run. Publishing is attempted for a tag, or
when **Publish to Microsoft Store** is selected manually. Store identity
variables enable the publish steps; missing authentication secrets then fail
the workflow with an explicit configuration error.

Before a production release:

- Update the listing and privacy policy if product behaviour changed.
- Verify camera, microphone, offline following, recording and MP4 export on a
  clean supported Windows computer.
- Confirm that the tag's version is greater than the last Store submission.
- Download and inspect both architectures in the workflow's MSIX bundle.
