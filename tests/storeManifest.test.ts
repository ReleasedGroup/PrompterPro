import { describe, expect, it } from "vitest";
import {
  escapeXml,
  renderStoreManifest,
  toWindowsVersion,
} from "../scripts/store-manifest.mjs";

describe("Windows Store manifest", () => {
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
        '<Identity Name="__IDENTITY_NAME__" Publisher="__PUBLISHER__" Version="__VERSION__"/><Name>__PUBLISHER_DISPLAY_NAME__</Name>',
        {
          identityName: "ReleasedGroup.Prompter",
          publisher: "CN=Released Group",
          publisherDisplayName: "Released Group",
          version: "1.2.3",
        },
      ),
    ).toBe(
      '<Identity Name="ReleasedGroup.Prompter" Publisher="CN=Released Group" Version="1.2.3.0"/><Name>Released Group</Name>',
    );
  });
});
