import type { RouteDecision } from "./common.js";
import type { ModelAdapter } from "./model.js";
import type { RouteTraceEntry } from "./runtime.js";

export interface AgentContext<TState, TInput> {
  teamId: string;
  agentId: string;
  step: number;
  input: TInput;
  state: TState;
  routeTrace: RouteTraceEntry<TState>[];
  model?: ModelAdapter;
  signal?: AbortSignal;
  compiledGraph?: unknown;
}

export interface AgentResult<TState, TOutput> {
  state: TState;
  decision?: RouteDecision;
  output?: TOutput;
}

export interface TeamAgent<TState, TInput, TOutput> {
  id: string;
  description?: string;
  run(ctx: AgentContext<TState, TInput>): Promise<AgentResult<TState, TOutput>>;
}
