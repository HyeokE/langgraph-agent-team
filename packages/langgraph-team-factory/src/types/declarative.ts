import type { ZodType } from "zod";
import type { AgentContext, AgentResult, TeamAgent } from "./agent.js";
import type { RouteDecision } from "./common.js";
import type { ModelRequest, ModelResponse } from "./model.js";

export type DeclarativeTextTemplate<TState, TInput> =
  | string
  | ((ctx: AgentContext<TState, TInput>) => string | Promise<string>);

export type DeclarativeMetadataTemplate<TState, TInput> =
  | Record<string, unknown>
  | ((ctx: AgentContext<TState, TInput>) => Record<string, unknown> | Promise<Record<string, unknown>>);

export interface DeclarativeAgentTool<TState, TInput> {
  name: string;
  description?: string;
  enabled?: boolean | ((ctx: AgentContext<TState, TInput>) => boolean | Promise<boolean>);
  execute(ctx: AgentContext<TState, TInput>): string | Promise<string>;
}

export interface DeclarativeRetryPolicy {
  attempts?: number;
  backoffMs?: number;
}

export interface DeclarativePromptConfig<TState, TInput> {
  system?: DeclarativeTextTemplate<TState, TInput>;
  developer?: DeclarativeTextTemplate<TState, TInput>;
  context?: DeclarativeTextTemplate<TState, TInput>;
  user: DeclarativeTextTemplate<TState, TInput>;
}

export interface DeclarativeToolResult {
  name: string;
  output: string;
}

export interface DeclarativeAgentEnvelope<TState, TInput, TParsed> {
  ctx: AgentContext<TState, TInput>;
  prompt: string;
  request: ModelRequest;
  response: ModelResponse;
  text: string;
  parsed: TParsed | undefined;
  toolResults: DeclarativeToolResult[];
}

export interface DeclarativeBuildRequestParams<TState, TInput> {
  ctx: AgentContext<TState, TInput>;
  prompt: string;
  metadata?: Record<string, unknown>;
  toolResults: DeclarativeToolResult[];
}

export interface DeclarativeAgentConfig<TState, TInput, TOutput, TParsed = unknown> {
  id: string;
  description?: string;
  prompt: DeclarativePromptConfig<TState, TInput>;
  metadata?: DeclarativeMetadataTemplate<TState, TInput>;
  tools?: DeclarativeAgentTool<TState, TInput>[];
  toolErrorMode?: "throw" | "continue";
  retry?: DeclarativeRetryPolicy;
  timeoutMs?: number;
  responseSchema?: ZodType<TParsed>;
  parseResponse?: (text: string) => TParsed | Promise<TParsed>;
  fallbackResponseText?: DeclarativeTextTemplate<TState, TInput>;
  buildRequest?: (
    params: DeclarativeBuildRequestParams<TState, TInput>
  ) => ModelRequest | Promise<ModelRequest>;
  stateResolver?: (
    envelope: DeclarativeAgentEnvelope<TState, TInput, TParsed>
  ) => TState | Promise<TState>;
  outputResolver?: (
    envelope: DeclarativeAgentEnvelope<TState, TInput, TParsed>
  ) => TOutput | undefined | Promise<TOutput | undefined>;
  decisionResolver?: (
    envelope: DeclarativeAgentEnvelope<TState, TInput, TParsed>
  ) => RouteDecision | undefined | Promise<RouteDecision | undefined>;
  onAttemptError?: (params: {
    error: unknown;
    attempt: number;
    maxAttempts: number;
    ctx: AgentContext<TState, TInput>;
  }) => void | Promise<void>;
}

export type DeclarativeTeamAgent<TState, TInput, TOutput> = TeamAgent<TState, TInput, TOutput>;

export type DeclarativeAgentResult<TState, TOutput> = AgentResult<TState, TOutput>;
