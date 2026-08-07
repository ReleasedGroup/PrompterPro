const WINDOWS_VERSION_PATTERN = /^\d+(?:\.\d+){0,3}$/;
const WINDOWS_ARCHITECTURES = new Set(["x64", "arm64"]);

import { PRODUCT_VARIANTS } from "./product-variants.mjs";

export const DEFAULT_STORE_IDENTITY = PRODUCT_VARIANTS.prompterpro.store;

export function toWindowsVersion(version) {
  const numericVersion = version.split("-", 1)[0];
  if (!WINDOWS_VERSION_PATTERN.test(numericVersion)) {
    throw new Error(
      `Store version "${version}" must contain one to four numeric parts.`,
    );
  }

  const parts = numericVersion.split(".").map(Number);
  if (parts.some((part) => part < 0 || part > 65_535)) {
    throw new Error("Each Store version part must be between 0 and 65535.");
  }

  return [...parts, 0, 0, 0].slice(0, 4).join(".");
}

export function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function renderStoreManifest(template, values) {
  if (!WINDOWS_ARCHITECTURES.has(values.architecture)) {
    throw new Error(
      `Store architecture "${values.architecture}" must be x64 or arm64.`,
    );
  }

  const replacements = {
    "__IDENTITY_NAME__": values.identityName,
    "__PUBLISHER__": values.publisher,
    "__PUBLISHER_DISPLAY_NAME__": values.publisherDisplayName,
    "__VERSION__": toWindowsVersion(values.version),
    "__PROCESSOR_ARCHITECTURE__": values.architecture,
    "__MIN_WINDOWS_VERSION__": values.minimumWindowsVersion,
    "__DISPLAY_NAME__": values.displayName,
    "__EXECUTABLE_NAME__": values.executableName,
    "__APPLICATION_ID__": values.applicationId,
    "__DESCRIPTION__": values.description,
    "__BACKGROUND_COLOR__": values.backgroundColor,
  };

  let manifest = template;
  for (const [token, value] of Object.entries(replacements)) {
    manifest = manifest.replaceAll(token, escapeXml(value));
  }
  if (/__[A-Z_]+__/.test(manifest)) {
    throw new Error("The Store manifest contains an unresolved token.");
  }
  return manifest;
}
