import { MaxStepsExceededError } from "../errors/MaxStepsExceededError.js";
import { RoutingError } from "../errors/RoutingError.js";
import { UnknownAgentError } from "../errors/UnknownAgentError.js";
import { mergeHooks } from "../hooks/mergeHooks.js";
import { safeCallHook } from "../hooks/safeCallHook.js";
import type {
  AgentContext,
  AgentResult,
  TeamAgent
} from "../types/agent.js";
import type { TeamCompletionReason } from "../types/common.js";
import type { TeamFactoryOptions, TeamConfig } from "../types/team.js";
import type {
  RunOptions,
  RouteTraceEntry,
  TeamRunResult
} from "../types/runtime.js";
import type { TeamErrorEvent } from "../types/hooks.js";
import type { ChatMessage } from "../types/chat.js";
import { extractMentions } from "../types/chat.js";
import { validateState } from "./validateState.js";
import type { CompiledTeamGraph } from "./compileGraph.js";

/**
 * mention 목록에서 실제로 라우팅할 에이전트 ID를 결정합니다.
 *
 * TODO: 아래 로직을 원하는 방식으로 구현하세요.
 *
 * 고려할 트레이드오프:
 * - 자기 자신(@self)을 mention하면 어떻게 처리할 것인가?
 * - Supervisor를 mention하면 "Supervisor에게 복귀"로 해석할 것인가, 아니면 무시할 것인가?
 * - mention 목록에 유효한 에이전트가 없을 경우 undefined 반환 → 일반 Supervisor 라우팅으로 fallback
 *
 * @param mentions     content에서 추출된 @agentId 목록
 * @param workers      worker 에이전트 맵 (agentId → TeamAgent)
 * @param supervisorId Supervisor 에이전트 ID
 * @returns 라우팅할 에이전트 ID, 없으면 undefined
 */
function resolveMentionTarget<TState, TInput, TOutput>(
  mentions: string[],
  workers: Map<string, TeamAgent<TState, TInput, TOutput>>,
  supervisorId: string
): string | undefined {
  // TODO: 여기서 mention 우선순위를 구현하세요 (5~10줄)
  //
  // 힌트:
  //   workers.has(id)  → worker 에이전트 존재 여부 확인
  //   id === supervisorId → Supervisor 여부 확인
  //
  // 가장 단순한 구현 예시:
  //   첫 번째로 등장하는 "유효한 worker 에이전트" ID를 반환
  //   (Supervisor mention과 알 수 없는 에이전트는 건너뜀)
  for (const id of mentions) {
    if (workers.has(id)) {
      return id;
    }
  }

  return undefined;
}

interface RunTeamParams<TState, TInput, TOutput> {
  config: TeamConfig<TState, TInput, TOutput>;
  factoryOptions: TeamFactoryOptions<TState, TInput, TOutput>;
  runOptions: RunOptions<TState, TInput, TOutput> | undefined;
  input: TInput;
  compiledGraph: CompiledTeamGraph;
}

function getNowIso(): string {
  return new Date().toISOString();
}

function cloneSnapshot<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return value;
}

async function runAgentWithDeadline<TState, TInput, TOutput>(
  agent: TeamAgent<TState, TInput, TOutput>,
  context: AgentContext<TState, TInput>,
  deadlineMs: number | undefined,
  teamId: string
): Promise<AgentResult<TState, TOutput>> {
  if (deadlineMs === undefined) {
    return agent.run(context);
  }

  const remainingMs = deadlineMs - Date.now();

  if (remainingMs <= 0) {
    throw new RoutingError("Execution timed out before running the next step.", {
      teamId,
      agentId: context.agentId,
      step: context.step,
      details: { timeoutMs: 0 }
    });
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      agent.run(context),
      new Promise<AgentResult<TState, TOutput>>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(
            new RoutingError("Execution timed out while waiting for an agent result.", {
              teamId,
              agentId: context.agentId,
              step: context.step,
              details: { timeoutMs: remainingMs }
            })
          );
        }, remainingMs);
      })
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function resolveInitialState<TState, TInput, TOutput>(
  config: TeamConfig<TState, TInput, TOutput>,
  input: TInput,
  initialStateOverride?: TState
): Promise<TState> {
  if (initialStateOverride !== undefined) {
    return initialStateOverride;
  }

  if (config.inputToState) {
    const mapped = await config.inputToState(input);
    return mapped as TState;
  }

  return input as unknown as TState;
}

export async function runTeam<TState, TInput, TOutput>(
  params: RunTeamParams<TState, TInput, TOutput>
): Promise<TeamRunResult<TState, TOutput>> {
  const { config, factoryOptions, runOptions, input, compiledGraph } = params;
  const hooks = mergeHooks(factoryOptions.hooks, runOptions?.hooks);
  const failOnHookError = runOptions?.failOnHookError ?? false;
  const validationMode = factoryOptions.validationMode ?? "strict";
  const deadlineMs = runOptions?.timeoutMs ? Date.now() + runOptions.timeoutMs : undefined;
  const routeTrace: RouteTraceEntry<TState>[] = [];
  const chatHistory: ChatMessage[] = [];
  const workers = new Map(config.agents.map((agent) => [agent.id, agent]));
  const startedAt = getNowIso();
  let steps = 0;
  let currentAgentId = config.supervisor.id;
  let lastOutput: TOutput | undefined;

  let state = (await resolveInitialState(config, input, runOptions?.initialState)) as TState;
  state = validateState({
    teamId: config.teamId,
    stateSchema: factoryOptions.stateSchema,
    state
  }) as TState;

  const emitRuntimeError = async (
    error: unknown,
    source: "runtime" | "agent" | "hook",
    step?: number,
    agentId?: string
  ): Promise<void> => {
    const payload: TeamErrorEvent<TState, TInput> = {
      teamId: config.teamId,
      source,
      error,
      input,
      state
    };

    if (step !== undefined) {
      payload.step = step;
    }

    if (agentId !== undefined) {
      payload.agentId = agentId;
    }

    await safeCallHook({
      hooks,
      hookName: "onError",
      payload,
      failOnHookError
    });
  };

  const finalize = async (reason: TeamCompletionReason): Promise<TeamRunResult<TState, TOutput>> => {
    let output = lastOutput;

    if (output === undefined && config.outputSelector) {
      try {
        output = config.outputSelector(state);
      } catch (error) {
        await emitRuntimeError(error, "runtime", steps, currentAgentId);
        throw error;
      }
    }

    const baseResult = {
      teamId: config.teamId,
      state,
      steps,
      routeTrace,
      chatHistory,
      completed: true as const,
      reason,
      startedAt,
      finishedAt: getNowIso()
    };

    if (output === undefined) {
      return baseResult;
    }

    return {
      ...baseResult,
      output
    };
  };

  while (true) {
    if (runOptions?.signal?.aborted) {
      const error = new RoutingError("Execution aborted by AbortSignal.", {
        teamId: config.teamId,
        step: steps,
        agentId: currentAgentId
      });
      await emitRuntimeError(error, "runtime", steps, currentAgentId);
      throw error;
    }

    if (deadlineMs !== undefined && Date.now() > deadlineMs) {
      const error = new RoutingError("Execution timed out.", {
        teamId: config.teamId,
        step: steps,
        agentId: currentAgentId
      });
      await emitRuntimeError(error, "runtime", steps, currentAgentId);
      throw error;
    }

    if (steps >= config.termination.maxSteps) {
      const error = new MaxStepsExceededError({
        maxSteps: config.termination.maxSteps,
        teamId: config.teamId,
        step: steps,
        agentId: currentAgentId
      });
      await emitRuntimeError(error, "runtime", steps, currentAgentId);
      throw error;
    }

    const agent =
      currentAgentId === config.supervisor.id ? config.supervisor : workers.get(currentAgentId);

    if (!agent) {
      const error = new UnknownAgentError({
        unknownAgentId: currentAgentId,
        teamId: config.teamId,
        step: steps,
        agentId: config.supervisor.id
      });
      await emitRuntimeError(error, "runtime", steps, config.supervisor.id);
      throw error;
    }

    const step = steps + 1;
    const context: AgentContext<TState, TInput> = {
      teamId: config.teamId,
      agentId: agent.id,
      step,
      input,
      state,
      routeTrace,
      chatHistory,
      compiledGraph: compiledGraph.graph,
      ...(factoryOptions.modelAdapter !== undefined ? { model: factoryOptions.modelAdapter } : {}),
      ...(runOptions?.signal !== undefined ? { signal: runOptions.signal } : {})
    };

    let result: AgentResult<TState, TOutput>;

    try {
      result = await runAgentWithDeadline(agent, context, deadlineMs, config.teamId);
    } catch (error) {
      await emitRuntimeError(error, "agent", step, agent.id);
      throw error;
    }

    steps = step;
    state = result.state as TState;

    // 에이전트가 채팅 메시지를 게시한 경우 처리
    let mentionTarget: string | undefined;

    if (result.message !== undefined) {
      const rawMessage = result.message;
      const mentions = rawMessage.mentions.length > 0
        ? rawMessage.mentions
        : extractMentions(rawMessage.content);

      const chatMessage: ChatMessage = {
        id: `${config.teamId}-${step}-${agent.id}`,
        step,
        timestamp: getNowIso(),
        agentId: rawMessage.agentId,
        agentName: rawMessage.agentName,
        content: rawMessage.content,
        mentions,
        replyTo: rawMessage.replyTo
      };

      chatHistory.push(chatMessage);

      await safeCallHook({
        hooks,
        hookName: "onMessage",
        payload: {
          teamId: config.teamId,
          step,
          message: chatMessage,
          input,
          state
        },
        failOnHookError,
        onHookErrorEvent: {
          teamId: config.teamId,
          step,
          agentId: agent.id,
          input,
          state
        }
      });

      // Hard 라우팅: 첫 번째 유효한 @mention 대상으로 직접 라우팅
      mentionTarget = resolveMentionTarget(mentions, workers, config.supervisor.id);
    }

    if (validationMode === "strict") {
      try {
        state = validateState({
          teamId: config.teamId,
          stateSchema: factoryOptions.stateSchema,
          state,
          step,
          agentId: agent.id
        }) as TState;
      } catch (error) {
        await emitRuntimeError(error, "runtime", step, agent.id);
        throw error;
      }
    }

    if (result.output !== undefined) {
      lastOutput = result.output;
    }

    await safeCallHook({
      hooks,
      hookName: "onStep",
      payload: {
        teamId: config.teamId,
        step,
        agentId: agent.id,
        input,
        state,
        result
      },
      failOnHookError,
      onHookErrorEvent: {
        teamId: config.teamId,
        step,
        agentId: agent.id,
        input,
        state
      }
    });

    let done = false;

    try {
      done = config.termination.isDone(state);
    } catch (error) {
      await emitRuntimeError(error, "runtime", step, agent.id);
      throw error;
    }

    if (done) {
      return finalize("done");
    }

    // @mention Hard 라우팅: Supervisor를 우회하고 직접 라우팅
    if (mentionTarget !== undefined) {
      routeTrace.push({
        step,
        from: agent.id,
        to: mentionTarget,
        timestamp: getNowIso(),
        stateSnapshot: cloneSnapshot(state)
      });

      await safeCallHook({
        hooks,
        hookName: "onRoute",
        payload: {
          teamId: config.teamId,
          step,
          from: agent.id,
          to: mentionTarget,
          input,
          state
        },
        failOnHookError,
        onHookErrorEvent: {
          teamId: config.teamId,
          step,
          agentId: agent.id,
          input,
          state
        }
      });

      currentAgentId = mentionTarget;
      continue;
    }

    if (agent.id === config.supervisor.id) {
      if (!result.decision) {
        const error = new RoutingError("Supervisor must return a route decision.", {
          teamId: config.teamId,
          step,
          agentId: agent.id
        });
        await emitRuntimeError(error, "runtime", step, agent.id);
        throw error;
      }

      if (result.decision.next === "__end__") {
        return finalize("route_end");
      }

      const nextAgentId = result.decision.next;
      const nextAgent = workers.get(nextAgentId);

      if (!nextAgent) {
        const error = new UnknownAgentError({
          unknownAgentId: nextAgentId,
          teamId: config.teamId,
          step,
          agentId: agent.id
        });
        await emitRuntimeError(error, "runtime", step, agent.id);
        throw error;
      }

      routeTrace.push({
        step,
        from: agent.id,
        to: nextAgent.id,
        timestamp: getNowIso(),
        stateSnapshot: cloneSnapshot(state)
      });

      await safeCallHook({
        hooks,
        hookName: "onRoute",
        payload: {
          teamId: config.teamId,
          step,
          from: agent.id,
          to: nextAgent.id,
          input,
          state,
          decision: result.decision
        },
        failOnHookError,
        onHookErrorEvent: {
          teamId: config.teamId,
          step,
          agentId: agent.id,
          input,
          state
        }
      });

      currentAgentId = nextAgent.id;
      continue;
    }

    routeTrace.push({
      step,
      from: agent.id,
      to: config.supervisor.id,
      timestamp: getNowIso(),
      stateSnapshot: cloneSnapshot(state)
    });

    await safeCallHook({
      hooks,
      hookName: "onRoute",
      payload: {
        teamId: config.teamId,
        step,
        from: agent.id,
        to: config.supervisor.id,
        input,
        state
      },
      failOnHookError,
      onHookErrorEvent: {
        teamId: config.teamId,
        step,
        agentId: agent.id,
        input,
        state
      }
    });

    currentAgentId = config.supervisor.id;
  }
}
