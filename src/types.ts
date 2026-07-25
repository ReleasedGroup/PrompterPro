export type ScriptSource = "manual" | "ai";

export interface PrompterScript {
  id: string;
  title: string;
  body: string;
  source: ScriptSource;
  createdAt: string;
  updatedAt: string;
}

export type WorkspaceView = "scripts" | "studio";

export interface GenerateScriptInput {
  topic: string;
  audience: string;
  tone: string;
  durationMinutes: number;
  keyPoints: string;
}
