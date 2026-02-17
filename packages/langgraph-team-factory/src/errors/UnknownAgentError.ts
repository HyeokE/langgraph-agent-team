import { TeamRuntimeError, type TeamRuntimeErrorMetadata } from "./TeamRuntimeError.js";

export interface UnknownAgentErrorMetadata extends TeamRuntimeErrorMetadata {
  unknownAgentId: string;
}

export class UnknownAgentError extends TeamRuntimeError {
  readonly unknownAgentId: string;

  constructor(metadata: UnknownAgentErrorMetadata) {
    super(`Agent "${metadata.unknownAgentId}" is not registered in this team.`, metadata);
    this.name = "UnknownAgentError";
    this.unknownAgentId = metadata.unknownAgentId;
  }
}
