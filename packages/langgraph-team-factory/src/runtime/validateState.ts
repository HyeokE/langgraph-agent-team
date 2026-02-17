import type { ZodType } from "zod";
import { InvalidStateError } from "../errors/InvalidStateError.js";
import type { InvalidStateErrorMetadata } from "../errors/InvalidStateError.js";

interface ValidateStateParams<TState> {
  stateSchema: ZodType<TState>;
  state: unknown;
  teamId: string;
  agentId?: string;
  step?: number;
}

export function validateState<TState>(params: ValidateStateParams<TState>): TState {
  const parsed = params.stateSchema.safeParse(params.state);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => {
      const path = issue.path.join(".") || "<root>";
      return `${path}: ${issue.message}`;
    });

    const metadata: InvalidStateErrorMetadata = {
      teamId: params.teamId,
      issues
    };

    if (params.agentId !== undefined) {
      metadata.agentId = params.agentId;
    }

    if (params.step !== undefined) {
      metadata.step = params.step;
    }

    throw new InvalidStateError("State validation failed.", metadata);
  }

  return parsed.data;
}
