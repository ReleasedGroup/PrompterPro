export function loadScriptStore(userDataDirectory: string): Promise<unknown>;
export function saveScriptStore(
  userDataDirectory: string,
  scripts: unknown,
): Promise<void>;
