# Microsoft Store release guide

Prompter is packaged as an x64 Electron desktop application and then converted
to an unsigned MSIX. Microsoft Store signs the accepted package during
submission.

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
```

For a Partner Center package, set the reserved identity first:

```powershell
$env:MS_STORE_IDENTITY_NAME = "YourReservedIdentityName"
$env:MS_STORE_PUBLISHER = "CN=YourPublisherIdentity"
$env:MS_STORE_PUBLISHER_DISPLAY_NAME = "Your Publisher Name"
$env:MS_STORE_VERSION = "1.0.0"
npm.cmd run package:windows
```

The package is written to `out/store/`. The unsigned local-development identity
is useful for validation but must not be submitted to Partner Center.

## Automated releases

The Store release workflow validates and uploads an MSIX artifact for a
`vMAJOR.MINOR.PATCH` tag or a manual run. Publishing is attempted for a tag, or
when **Publish to Microsoft Store** is selected manually. Store identity
variables enable the publish steps; missing authentication secrets then fail
the workflow with an explicit configuration error.

Before a production release:

- Update the listing and privacy policy if product behaviour changed.
- Verify camera, microphone, offline following, recording and MP4 export on a
  clean supported Windows computer.
- Confirm that the tag's version is greater than the last Store submission.
- Download and inspect the workflow's MSIX artifact.
