import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_STORE_IDENTITY,
  escapeXml,
  renderStoreManifest,
  toWindowsVersion,
} from "../scripts/store-manifest.mjs";
import { PRODUCT_VARIANTS } from "../scripts/product-variants.mjs";

const prompterProManifestValues = {
  displayName: PRODUCT_VARIANTS.prompterpro.productName,
  executableName: PRODUCT_VARIANTS.prompterpro.productName,
  applicationId: PRODUCT_VARIANTS.prompterpro.applicationId,
  description: PRODUCT_VARIANTS.prompterpro.description,
  backgroundColor: PRODUCT_VARIANTS.prompterpro.backgroundColor,
};

describe("Windows Store manifest", () => {
  it("uses the Partner Center identity and PrompterPro product metadata", () => {
    const template = readFileSync(
      new URL("../store/Package.appxmanifest.template", import.meta.url),
      "utf8",
    );
    const manifest = renderStoreManifest(template, {
      architecture: "x64",
      ...DEFAULT_STORE_IDENTITY,
      minimumWindowsVersion: "10.0.22000.0",
      version: "1.2.3",
      ...prompterProManifestValues,
    });

    expect(manifest).toContain('Name="ReleasedPtyLtd.PrompterPro"');
    expect(manifest).toContain(
      'Publisher="CN=E3BDC624-0B0A-4256-85B0-5AE714EA8897"',
    );
    expect(manifest).toContain("<DisplayName>PrompterPro</DisplayName>");
    expect(manifest).toContain(
      "<PublisherDisplayName>Released Pty Ltd</PublisherDisplayName>",
    );
    expect(manifest).toContain('Executable="PrompterPro.exe"');
    expect(manifest).toContain('DisplayName="PrompterPro"');
    expect(manifest).toContain('ShortName="PrompterPro"');
  });

  it("renders the SimplePrompt Store identity and product metadata", () => {
    const template = readFileSync(
      new URL("../store/Package.appxmanifest.template", import.meta.url),
      "utf8",
    );
    const simplePrompt = PRODUCT_VARIANTS.simpleprompt;
    const manifest = renderStoreManifest(template, {
      architecture: "arm64",
      identityName: simplePrompt.store.identityName,
      publisher: simplePrompt.store.publisher,
      publisherDisplayName: simplePrompt.store.publisherDisplayName,
      minimumWindowsVersion: "10.0.22000.0",
      version: "1.2.3",
      displayName: simplePrompt.productName,
      executableName: simplePrompt.productName,
      applicationId: simplePrompt.applicationId,
      description: simplePrompt.description,
      backgroundColor: simplePrompt.backgroundColor,
    });

    expect(manifest).toContain('Name="ReleasedPtyLtd.SimplePrompt"');
    expect(manifest).toContain('<DisplayName>SimplePrompt</DisplayName>');
    expect(manifest).toContain('Executable="SimplePrompt.exe"');
    expect(manifest).toContain('Id="SimplePrompt"');
    expect(simplePrompt.store.productId).toBe("9MT1X5BNTHQS");
    expect(simplePrompt.assetDirectory).toBe("simpleprompt/assets");
    expect(simplePrompt.store.packageFamilyName).toBe(
      "ReleasedPtyLtd.SimplePrompt_q0b077qanz1d8",
    );
    expect(simplePrompt.store.packageSid).toBe(
      "S-1-15-2-2676728462-2596204801-2700890954-455437082-720273692-286854053-1939976512",
    );
  });

  it("converts semantic versions to four-part MSIX versions", () => {
    expect(toWindowsVersion("2.7.3")).toBe("2.7.3.0");
    expect(toWindowsVersion("2.7.3-beta.1")).toBe("2.7.3.0");
  });

  it("rejects invalid or overflowing version parts", () => {
    expect(() => toWindowsVersion("1.next.0")).toThrow(/numeric parts/);
    expect(() => toWindowsVersion("1.70000")).toThrow(/between 0 and 65535/);
  });

  it("escapes Partner Center identity values for XML", () => {
    expect(escapeXml('CN=Released & "Group"')).toBe(
      "CN=Released &amp; &quot;Group&quot;",
    );
  });

  it("renders every manifest token", () => {
    expect(
      renderStoreManifest(
        '<Identity Name="__IDENTITY_NAME__" Publisher="__PUBLISHER__" Version="__VERSION__" ProcessorArchitecture="__PROCESSOR_ARCHITECTURE__"/><Target MinVersion="__MIN_WINDOWS_VERSION__"/><Name>__PUBLISHER_DISPLAY_NAME__</Name>',
        {
          architecture: "arm64",
          identityName: "ReleasedGroup.Prompter",
          minimumWindowsVersion: "10.0.22000.0",
          publisher: "CN=Released Group",
          publisherDisplayName: "Released Pty Ltd",
          version: "1.2.3",
          ...prompterProManifestValues,
        },
      ),
    ).toBe(
      '<Identity Name="ReleasedGroup.Prompter" Publisher="CN=Released Group" Version="1.2.3.0" ProcessorArchitecture="arm64"/><Target MinVersion="10.0.22000.0"/><Name>Released Pty Ltd</Name>',
    );
  });

  it("rejects unsupported package architectures", () => {
    expect(() =>
      renderStoreManifest("__PROCESSOR_ARCHITECTURE__", {
        architecture: "ia32" as "x64",
        identityName: "ReleasedGroup.Prompter",
        minimumWindowsVersion: "10.0.17763.0",
        publisher: "CN=Released Group",
        publisherDisplayName: "Released Pty Ltd",
        version: "1.2.3",
        ...prompterProManifestValues,
      }),
    ).toThrow(/x64 or arm64/);
  });
});
