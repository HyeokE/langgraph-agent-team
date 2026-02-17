export interface TeamRuntimeErrorMetadata {
  teamId?: string;
  agentId?: string;
  step?: number;
  cause?: unknown;
  details?: Record<string, unknown>;
}

export class TeamRuntimeError extends Error {
  readonly metadata: TeamRuntimeErrorMetadata;

  constructor(message: string, metadata: TeamRuntimeErrorMetadata = {}) {
    super(message);
    this.name = "TeamRuntimeError";
    this.metadata = metadata;
  }
}
