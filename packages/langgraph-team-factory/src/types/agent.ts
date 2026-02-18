import type { RouteDecision } from "./common.js";
import type { ModelAdapter } from "./model.js";
import type { RouteTraceEntry } from "./runtime.js";
import type { ChatMessage } from "./chat.js";

export interface AgentContext<TState, TInput> {
  teamId: string;
  agentId: string;
  step: number;
  input: TInput;
  state: TState;
  routeTrace: RouteTraceEntry<TState>[];
  /** 지금까지 쌓인 채팅 히스토리 (읽기 전용) */
  chatHistory: readonly ChatMessage[];
  model?: ModelAdapter;
  signal?: AbortSignal;
  compiledGraph?: unknown;
}

export interface AgentResult<TState, TOutput> {
  state: TState;
  decision?: RouteDecision;
  output?: TOutput;
  /** 채팅방에 게시할 메시지. mentions가 있으면 해당 에이전트로 직접 라우팅됩니다. */
  message?: Omit<ChatMessage, "id" | "step" | "timestamp">;
}

export interface TeamAgent<TState, TInput, TOutput> {
  id: string;
  description?: string;
  run(ctx: AgentContext<TState, TInput>): Promise<AgentResult<TState, TOutput>>;
}
