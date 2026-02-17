import type { AgentResult } from "./agent.js";
import type { RouteDecision } from "./common.js";

export interface TeamStepEvent<TState, TInput, TOutput> {
  teamId: string;
  step: number;
  agentId: string;
  input: TInput;
  state: TState;
  result: AgentResult<TState, TOutput>;
}

export interface TeamRouteEvent<TState, TInput> {
  teamId: string;
  step: number;
  from: string;
  to: string;
  input: TInput;
  state: TState;
  decision?: RouteDecision;
}

export interface TeamErrorEvent<TState, TInput> {
  teamId: string;
  step?: number;
  agentId?: string;
  input?: TInput;
  state?: TState;
  error: unknown;
  source: "runtime" | "agent" | "hook";
}

export interface TeamHooks<TState, TInput, TOutput> {
  onStep?(event: TeamStepEvent<TState, TInput, TOutput>): void | Promise<void>;
  onRoute?(event: TeamRouteEvent<TState, TInput>): void | Promise<void>;
  onError?(event: TeamErrorEvent<TState, TInput>): void | Promise<void>;
}
