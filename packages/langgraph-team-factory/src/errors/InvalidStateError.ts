import { TeamRuntimeError, type TeamRuntimeErrorMetadata } from "./TeamRuntimeError.js";

export interface InvalidStateErrorMetadata extends TeamRuntimeErrorMetadata {
  issues?: string[];
}

export class InvalidStateError extends TeamRuntimeError {
  constructor(message: string, metadata: InvalidStateErrorMetadata = {}) {
    super(message, metadata);
    this.name = "InvalidStateError";
  }
}
