import type { WorkerProfile } from "./WorkerProfile.js";

export interface WorkerHandoff {
  id: string;
  profile: WorkerProfile;
  prompt: string;
  cwd?: string;
}
