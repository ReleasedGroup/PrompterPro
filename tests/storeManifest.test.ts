import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_STORE_IDENTITY,
  escapeXml,
  renderStoreManifest,
  toWindowsVersion,
} from "../scripts/store-manifest.mjs";

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
      }),
    ).toThrow(/x64 or arm64/);
  });
});
