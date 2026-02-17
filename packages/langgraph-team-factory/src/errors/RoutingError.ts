import { TeamRuntimeError, type TeamRuntimeErrorMetadata } from "./TeamRuntimeError.js";

export class RoutingError extends TeamRuntimeError {
  constructor(message: string, metadata: TeamRuntimeErrorMetadata = {}) {
    super(message, metadata);
    this.name = "RoutingError";
  }
}
