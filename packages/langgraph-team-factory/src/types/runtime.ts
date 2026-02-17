import type { TeamHooks } from "./hooks.js";
import type { TeamCompletionReason } from "./common.js";

export interface RouteTraceEntry<TState> {
  step: number;
  from: string;
  to: string;
  timestamp: string;
  stateSnapshot?: TState;
}

export interface RunOptions<TState, TInput, TOutput> {
  hooks?: Partial<TeamHooks<TState, TInput, TOutput>>;
  failOnHookError?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
  initialState?: TState;
}

export interface TeamRunResult<TState, TOutput> {
  teamId: string;
  state: TState;
  output?: TOutput;
  steps: number;
  routeTrace: RouteTraceEntry<TState>[];
  completed: true;
  reason: TeamCompletionReason;
  startedAt: string;
  finishedAt: string;
}
