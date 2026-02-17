import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  createDeclarativeAgent,
  RoutingError,
  type AgentContext,
  type ModelAdapter,
  type ModelRequest
} from "../src/index.js";

interface State {
  phase: "start" | "done";
  notes: string[];
  retries: number;
  answer?: string | undefined;
}

interface Input {
  query: string;
}

function createContext(model?: ModelAdapter): AgentContext<State, Input> {
  const base: AgentContext<State, Input> = {
    teamId: "team-1",
    agentId: "agent-1",
    step: 1,
    input: { query: "how to design agent teams?" },
    state: {
      phase: "start",
      notes: [],
      retries: 0
    },
    routeTrace: []
  };

  if (!model) {
    return base;
  }

  return {
    ...base,
    model
  };
}

describe("createDeclarativeAgent", () => {
  it("프롬프트/툴/메타데이터를 선언형으로 구성하고 상태/출력을 만든다", async () => {
    const modelInvoke = vi.fn(async (request: ModelRequest) => {
      void request;
      return {
        text: JSON.stringify({ summary: "팩토리 + supervisor", next: "__end__" })
      };
    });

    const agent = createDeclarativeAgent<State, Input, string, { summary: string; next: string }>({
      id: "researcher",
      prompt: {
        system: "너는 리서처다.",
        developer: "응답은 JSON으로 반환한다.",
        context: (ctx) => `현재 노트 수: ${ctx.state.notes.length}`,
        user: (ctx) => `질문: ${ctx.input.query}`
      },
      tools: [
        {
          name: "memory",
          execute: async () => "최근 대화 요약"
        }
      ],
      metadata: {
        source: "unit-test"
      },
      responseSchema: z.object({
        summary: z.string(),
        next: z.string()
      }),
      stateResolver: ({ ctx, parsed }) => ({
        ...ctx.state,
        phase: "done",
        notes: [...ctx.state.notes, parsed?.summary ?? "none"],
        answer: parsed?.summary
      }),
      outputResolver: ({ parsed }) => parsed?.summary,
      decisionResolver: ({ parsed }) => ({
        next: parsed?.next === "__end__" ? "__end__" : parsed?.next ?? "__end__"
      })
    });

    const result = await agent.run(
      createContext({
        invoke: modelInvoke
      })
    );

    expect(modelInvoke).toHaveBeenCalledTimes(1);
    const firstCall = modelInvoke.mock.calls.at(0);
    expect(firstCall).toBeDefined();
    if (!firstCall || !firstCall[0]) {
      throw new Error("model invoke request is missing");
    }
    const firstCallRequest = firstCall[0] as ModelRequest;
    expect(firstCallRequest.prompt).toContain("SYSTEM:");
    expect(firstCallRequest.prompt).toContain("DEVELOPER:");
    expect(firstCallRequest.prompt).toContain("TOOLS:");
    expect(firstCallRequest.prompt).toContain("USER:");
    expect(firstCallRequest.metadata).toBeDefined();
    expect((firstCallRequest.metadata as Record<string, unknown>).source).toBe("unit-test");
    expect((firstCallRequest.metadata as Record<string, unknown>).tools).toEqual(["memory"]);

    expect(result.state.phase).toBe("done");
    expect(result.state.notes[0]).toBe("팩토리 + supervisor");
    expect(result.output).toBe("팩토리 + supervisor");
    expect(result.decision?.next).toBe("__end__");
  });

  it("retry 설정으로 실패 후 재시도한다", async () => {
    const modelInvoke = vi.fn();
    modelInvoke.mockRejectedValueOnce(new Error("first-fail"));
    modelInvoke.mockResolvedValueOnce({ text: "ok" });

    const onAttemptError = vi.fn();

    const agent = createDeclarativeAgent<State, Input, string>({
      id: "retry-agent",
      prompt: {
        user: (ctx) => ctx.input.query
      },
      retry: {
        attempts: 2,
        backoffMs: 0
      },
      onAttemptError,
      stateResolver: (envelope) => ({
        ...envelope.ctx.state,
        retries: envelope.ctx.state.retries + 1,
        answer: envelope.text
      }),
      outputResolver: (envelope) => envelope.text
    });

    const result = await agent.run(
      createContext({
        invoke: modelInvoke
      })
    );

    expect(modelInvoke).toHaveBeenCalledTimes(2);
    expect(onAttemptError).toHaveBeenCalledTimes(1);
    expect(result.output).toBe("ok");
  });

  it("timeoutMs 초과 시 RoutingError를 던진다", async () => {
    const modelInvoke = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return { text: "late" };
    });

    const agent = createDeclarativeAgent<State, Input, string>({
      id: "timeout-agent",
      prompt: {
        user: "timeout test"
      },
      timeoutMs: 10,
      stateResolver: (envelope) => ({
        ...envelope.ctx.state,
        answer: envelope.text
      })
    });

    await expect(
      agent.run(
        createContext({
          invoke: modelInvoke
        })
      )
    ).rejects.toBeInstanceOf(RoutingError);
  });

  it("modelAdapter 없이 fallbackResponseText로 동작한다", async () => {
    const agent = createDeclarativeAgent<State, Input, string>({
      id: "fallback-agent",
      prompt: {
        user: "no model"
      },
      fallbackResponseText: "fallback-answer",
      stateResolver: (envelope) => ({
        ...envelope.ctx.state,
        phase: "done",
        answer: envelope.text
      }),
      outputResolver: (envelope) => envelope.text
    });

    const result = await agent.run(createContext());

    expect(result.state.answer).toBe("fallback-answer");
    expect(result.output).toBe("fallback-answer");
  });

  it("modelAdapter/fallback 모두 없으면 RoutingError를 던진다", async () => {
    const agent = createDeclarativeAgent<State, Input, string>({
      id: "missing-model-agent",
      prompt: {
        user: "need model"
      },
      stateResolver: (envelope) => envelope.ctx.state
    });

    await expect(agent.run(createContext())).rejects.toBeInstanceOf(RoutingError);
  });

  it("responseSchema 파싱 실패 시 RoutingError를 던진다", async () => {
    const modelInvoke = vi.fn(async () => ({ text: "not-json" }));

    const agent = createDeclarativeAgent<State, Input, string, { answer: string }>({
      id: "parse-fail-agent",
      prompt: {
        user: "parse me"
      },
      responseSchema: z.object({
        answer: z.string()
      }),
      stateResolver: (envelope) => envelope.ctx.state
    });

    await expect(
      agent.run(
        createContext({
          invoke: modelInvoke
        })
      )
    ).rejects.toBeInstanceOf(RoutingError);
  });
});
