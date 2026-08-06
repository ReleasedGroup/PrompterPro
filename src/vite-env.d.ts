/// <reference types="vite/client" />

interface PrompterDesktopApi {
  loadScripts(): Promise<unknown>;
  saveScripts(scripts: import("./types").PrompterScript[]): Promise<void>;
}

interface Window {
  prompterDesktop?: PrompterDesktopApi;
}
