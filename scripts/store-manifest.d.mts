export interface StoreManifestValues {
  architecture: "x64" | "arm64";
  identityName: string;
  minimumWindowsVersion: string;
  publisher: string;
  publisherDisplayName: string;
  version: string;
}

export const DEFAULT_STORE_IDENTITY: Readonly<{
  identityName: "ReleasedPtyLtd.PrompterPro";
  publisher: "CN=E3BDC624-0B0A-4256-85B0-5AE714EA8897";
  publisherDisplayName: "Released Pty Ltd";
}>;

export function toWindowsVersion(version: string): string;
export function escapeXml(value: string): string;
export function renderStoreManifest(
  template: string,
  values: StoreManifestValues,
): string;
