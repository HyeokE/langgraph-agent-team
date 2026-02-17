import { RoutingError } from "../errors/RoutingError.js";
import type { AgentContext, AgentResult, TeamAgent } from "../types/agent.js";
import type { ModelRequest, ModelResponse } from "../types/model.js";
import type {
  DeclarativeAgentConfig,
  DeclarativeAgentEnvelope,
  DeclarativeToolResult,
  DeclarativeTextTemplate,
  DeclarativeMetadataTemplate
} from "../types/declarative.js";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
}

function ensurePositiveInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RoutingError(`${fieldName} must be a positive integer.`);
  }

  return value;
}

function maybeParseJson(text: string): unknown {
  const trimmed = text.trim();

  const looksJsonObject = trimmed.startsWith("{") && trimmed.endsWith("}");
  const looksJsonArray = trimmed.startsWith("[") && trimmed.endsWith("]");

  if (!looksJsonObject && !looksJsonArray) {
    return text;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return text;
  }
}

async function resolveTextTemplate<TState, TInput>(
  template: DeclarativeTextTemplate<TState, TInput> | undefined,
  ctx: AgentContext<TState, TInput>
): Promise<string | undefined> {
  if (template === undefined) {
    return undefined;
  }

  if (typeof template === "string") {
    return template;
  }

  return template(ctx);
}

async function resolveMetadataTemplate<TState, TInput>(
  template: DeclarativeMetadataTemplate<TState, TInput> | undefined,
  ctx: AgentContext<TState, TInput>
): Promise<Record<string, unknown> | undefined> {
  if (template === undefined) {
    return undefined;
  }

  if (typeof template === "function") {
    return template(ctx);
  }

  return template;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutError: Error): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(timeoutError), timeoutMs);
      })
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function executeTools<TState, TInput, TOutput, TParsed>(
  config: DeclarativeAgentConfig<TState, TInput, TOutput, TParsed>,
  ctx: AgentContext<TState, TInput>
): Promise<DeclarativeToolResult[]> {
  if (!config.tools || config.tools.length === 0) {
    return [];
  }

  const mode = config.toolErrorMode ?? "throw";
  const results: DeclarativeToolResult[] = [];

  for (const tool of config.tools) {
    const enabled =
      typeof tool.enabled === "function"
        ? await tool.enabled(ctx)
        : (tool.enabled ?? true);

    if (!enabled) {
      continue;
    }

    try {
      const output = await tool.execute(ctx);
      results.push({
        name: tool.name,
        output
      });
    } catch (error) {
      if (mode === "continue") {
        results.push({
          name: tool.name,
          output: `[tool-error] ${getErrorMessage(error)}`
        });
        continue;
      }

      throw new RoutingError(
        `Declarative tool "${tool.name}" failed: ${getErrorMessage(error)}.`,
        {
          teamId: ctx.teamId,
          agentId: config.id,
          step: ctx.step,
          cause: error
        }
      );
    }
  }

  return results;
}

async function buildPromptText<TState, TInput, TOutput, TParsed>(
  config: DeclarativeAgentConfig<TState, TInput, TOutput, TParsed>,
  ctx: AgentContext<TState, TInput>,
  toolResults: DeclarativeToolResult[]
): Promise<string> {
  const sections: string[] = [];

  const system = await resolveTextTemplate(config.prompt.system, ctx);
  const developer = await resolveTextTemplate(config.prompt.developer, ctx);
  const context = await resolveTextTemplate(config.prompt.context, ctx);
  const user = await resolveTextTemplate(config.prompt.user, ctx);

  if (system && system.trim().length > 0) {
    sections.push(`SYSTEM:\n${system}`);
  }

  if (developer && developer.trim().length > 0) {
    sections.push(`DEVELOPER:\n${developer}`);
  }

  if (context && context.trim().length > 0) {
    sections.push(`CONTEXT:\n${context}`);
  }

  if (toolResults.length > 0) {
    const toolText = toolResults
      .map((toolResult) => `- ${toolResult.name}: ${toolResult.output}`)
      .join("\n");
    sections.push(`TOOLS:\n${toolText}`);
  }

  if (!user || user.trim().length === 0) {
    throw new RoutingError("Declarative prompt.user must resolve to a non-empty string.", {
      teamId: ctx.teamId,
      agentId: config.id,
      step: ctx.step
    });
  }

  sections.push(`USER:\n${user}`);

  return sections.join("\n\n");
}

async function buildRequest<TState, TInput, TOutput, TParsed>(
  config: DeclarativeAgentConfig<TState, TInput, TOutput, TParsed>,
  ctx: AgentContext<TState, TInput>,
  prompt: string,
  toolResults: DeclarativeToolResult[]
): Promise<ModelRequest> {
  const resolvedMetadata = await resolveMetadataTemplate(config.metadata, ctx);
  const defaultMetadata: Record<string, unknown> = {
    teamId: ctx.teamId,
    agentId: config.id,
    step: ctx.step,
    tools: toolResults.map((result) => result.name)
  };

  const metadata = {
    ...defaultMetadata,
    ...(resolvedMetadata ?? {})
  };

  if (config.buildRequest) {
    return config.buildRequest({
      ctx,
      prompt,
      metadata,
      toolResults
    });
  }

  return {
    prompt,
    metadata
  };
}

async function invokeModelWithRetry<TState, TInput, TOutput, TParsed>(
  config: DeclarativeAgentConfig<TState, TInput, TOutput, TParsed>,
  ctx: AgentContext<TState, TInput>,
  request: ModelRequest
): Promise<ModelResponse> {
  if (!ctx.model) {
    const fallbackText = await resolveTextTemplate(config.fallbackResponseText, ctx);

    if (fallbackText !== undefined) {
      return {
        text: fallbackText,
        raw: {
          fallback: true
        }
      };
    }

    throw new RoutingError(
      `Declarative agent "${config.id}" requires modelAdapter or fallbackResponseText.`,
      {
        teamId: ctx.teamId,
        agentId: config.id,
        step: ctx.step
      }
    );
  }

  const attempts = ensurePositiveInteger(config.retry?.attempts ?? 1, "retry.attempts");
  const backoffMs = config.retry?.backoffMs ?? 0;

  if (backoffMs < 0) {
    throw new RoutingError("retry.backoffMs must be zero or positive.", {
      teamId: ctx.teamId,
      agentId: config.id,
      step: ctx.step
    });
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (ctx.signal?.aborted) {
      throw new RoutingError("Declarative agent execution aborted by AbortSignal.", {
        teamId: ctx.teamId,
        agentId: config.id,
        step: ctx.step
      });
    }

    try {
      const invokePromise = ctx.model.invoke(request);

      if (config.timeoutMs !== undefined) {
        const timeoutMs = config.timeoutMs;

        if (timeoutMs <= 0) {
          throw new RoutingError("timeoutMs must be greater than 0.", {
            teamId: ctx.teamId,
            agentId: config.id,
            step: ctx.step
          });
        }

        return await runWithTimeout(
          invokePromise,
          timeoutMs,
          new RoutingError(`Declarative agent "${config.id}" timed out after ${timeoutMs}ms.`, {
            teamId: ctx.teamId,
            agentId: config.id,
            step: ctx.step
          })
        );
      }

      return await invokePromise;
    } catch (error) {
      lastError = error;

      if (config.onAttemptError) {
        await config.onAttemptError({
          error,
          attempt,
          maxAttempts: attempts,
          ctx
        });
      }

      if (attempt < attempts && backoffMs > 0) {
        await sleep(backoffMs);
      }
    }
  }

  throw new RoutingError(
    `Declarative agent "${config.id}" failed after ${attempts} attempts: ${getErrorMessage(lastError)}.`,
    {
      teamId: ctx.teamId,
      agentId: config.id,
      step: ctx.step,
      cause: lastError
    }
  );
}

async function resolveParsedResponse<TState, TInput, TOutput, TParsed>(
  config: DeclarativeAgentConfig<TState, TInput, TOutput, TParsed>,
  responseText: string,
  ctx: AgentContext<TState, TInput>
): Promise<TParsed | undefined> {
  if (config.parseResponse) {
    return config.parseResponse(responseText);
  }

  if (!config.responseSchema) {
    return undefined;
  }

  const candidate = maybeParseJson(responseText);
  const parsed = config.responseSchema.safeParse(candidate);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join(", ");

    throw new RoutingError(
      `Declarative response parsing failed for agent "${config.id}": ${issues}.`,
      {
        teamId: ctx.teamId,
        agentId: config.id,
        step: ctx.step,
        details: {
          responseText
        }
      }
    );
  }

  return parsed.data;
}

function assertConfig<TState, TInput, TOutput, TParsed>(
  config: DeclarativeAgentConfig<TState, TInput, TOutput, TParsed>
): void {
  if (!config.id || config.id.trim().length === 0) {
    throw new RoutingError("Declarative agent id must be a non-empty string.");
  }

  if (!config.prompt || !config.prompt.user) {
    throw new RoutingError("Declarative prompt.user is required.", {
      agentId: config.id
    });
  }
}

export function createDeclarativeAgent<TState, TInput, TOutput, TParsed = unknown>(
  config: DeclarativeAgentConfig<TState, TInput, TOutput, TParsed>
): TeamAgent<TState, TInput, TOutput> {
  assertConfig(config);

  const agent: TeamAgent<TState, TInput, TOutput> = {
    id: config.id,
    async run(ctx: AgentContext<TState, TInput>): Promise<AgentResult<TState, TOutput>> {
      const toolResults = await executeTools(config, ctx);
      const prompt = await buildPromptText(config, ctx, toolResults);
      const request = await buildRequest(config, ctx, prompt, toolResults);
      const response = await invokeModelWithRetry(config, ctx, request);
      const text = response.text;
      const parsed = await resolveParsedResponse(config, text, ctx);

      const envelope: DeclarativeAgentEnvelope<TState, TInput, TParsed> = {
        ctx,
        prompt,
        request,
        response,
        text,
        parsed,
        toolResults
      };

      const state = config.stateResolver ? await config.stateResolver(envelope) : ctx.state;
      const output = config.outputResolver ? await config.outputResolver(envelope) : undefined;
      const decision = config.decisionResolver ? await config.decisionResolver(envelope) : undefined;

      return {
        state,
        ...(output !== undefined ? { output } : {}),
        ...(decision !== undefined ? { decision } : {})
      };
    }
  };

  if (config.description !== undefined) {
    agent.description = config.description;
  }

  return agent;
}
