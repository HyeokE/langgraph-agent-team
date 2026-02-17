import type { ZodType } from "zod";
import type { TeamAgent } from "./agent.js";
import type { TeamHooks } from "./hooks.js";
import type { ModelAdapter } from "./model.js";
import type { RunOptions, TeamRunResult } from "./runtime.js";
import type { ValidationMode } from "./common.js";

export interface TeamTermination<TState> {
  maxSteps: number;
  isDone(state: TState): boolean;
}

export interface TeamConfig<TState, TInput, TOutput> {
  teamId: string;
  supervisor: TeamAgent<TState, TInput, TOutput>;
  agents: TeamAgent<TState, TInput, TOutput>[];
  termination: TeamTermination<TState>;
  inputToState?(input: TInput): TState | Promise<TState>;
  outputSelector?(state: TState): TOutput;
}

export interface TeamFactoryOptions<TState, TInput, TOutput> {
  stateSchema: ZodType<TState>;
  modelAdapter?: ModelAdapter;
  hooks?: TeamHooks<TState, TInput, TOutput>;
  validationMode?: ValidationMode;
}

export interface AgentTeam<TState, TInput, TOutput> {
  run(input: TInput, opts?: RunOptions<TState, TInput, TOutput>): Promise<TeamRunResult<TState, TOutput>>;
}

export interface TeamFactory<TState, TInput, TOutput> {
  createTeam(config: TeamConfig<TState, TInput, TOutput>): AgentTeam<TState, TInput, TOutput>;
}
