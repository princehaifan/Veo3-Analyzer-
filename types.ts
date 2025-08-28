
export interface DialogueLine {
  speaker: string;
  line: string;
}

export interface Scene {
  scene_id: number;
  timestamp_start_seconds: number;
  timestamp_end_seconds: number;
  description: string;
  objects: string[];
  actions: string[];
  dialogue?: DialogueLine[];
}

export interface VideoAnalysis {
  title: string;
  summary: string;
  scenes: Scene[];
}

export interface ShotPrompt {
  id: number;
  timestamp: string;
  prompt: string;
  scene: Scene;
}
