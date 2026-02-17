import { TeamRuntimeError, type TeamRuntimeErrorMetadata } from "./TeamRuntimeError.js";

export interface MaxStepsExceededErrorMetadata extends TeamRuntimeErrorMetadata {
  maxSteps: number;
}

export class MaxStepsExceededError extends TeamRuntimeError {
  readonly maxSteps: number;

  constructor(metadata: MaxStepsExceededErrorMetadata) {
    super(`Maximum step limit exceeded (${metadata.maxSteps}).`, metadata);
    this.name = "MaxStepsExceededError";
    this.maxSteps = metadata.maxSteps;
  }
}
