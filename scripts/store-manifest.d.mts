export interface StoreManifestValues {
  architecture: "x64" | "arm64";
  identityName: string;
  minimumWindowsVersion: string;
  publisher: string;
  publisherDisplayName: string;
  version: string;
}

export function toWindowsVersion(version: string): string;
export function escapeXml(value: string): string;
export function renderStoreManifest(
  template: string,
  values: StoreManifestValues,
): string;
