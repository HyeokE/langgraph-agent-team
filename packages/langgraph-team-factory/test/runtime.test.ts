import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  createTeamFactory,
  InvalidStateError,
  MaxStepsExceededError,
  RoutingError,
  UnknownAgentError
} from "../src/index.js";

interface TeamState {
  phase: "triage" | "work" | "done";
  noteCount: number;
  response?: string | undefined;
}

const teamStateSchema = z.object({
  phase: z.enum(["triage", "work", "done"]),
  noteCount: z.number(),
  response: z.string().optional()
});

function createHappyPathTeam() {
  const factory = createTeamFactory<TeamState, TeamState, string>({
    stateSchema: teamStateSchema
  });

  return factory.createTeam({
    teamId: "happy-path-team",
    supervisor: {
      id: "supervisor",
      run: async (ctx) => {
        if (ctx.state.phase === "triage") {
          return {
            state: { ...ctx.state, phase: "work" },
            decision: { next: "worker" }
          };
        }

        return {
          state: { ...ctx.state, phase: "done", response: "done" },
          decision: { next: "__end__" },
          output: "done"
        };
      }
    },
    agents: [
      {
        id: "worker",
        run: async (ctx) => ({
          state: {
            ...ctx.state,
            noteCount: ctx.state.noteCount + 1,
            response: `worked-${ctx.state.noteCount + 1}`
          },
          output: `worked-${ctx.state.noteCount + 1}`
        })
      }
    ],
    termination: {
      maxSteps: 6,
      isDone: (state) => state.phase === "done"
    }
  });
}

describe("runtime", () => {
  it("supervisor -> worker -> supervisor 흐름으로 종료한다", async () => {
    const team = createHappyPathTeam();
    const result = await team.run({ phase: "triage", noteCount: 0 });

    expect(result.completed).toBe(true);
    expect(result.reason).toBe("done");
    expect(result.steps).toBe(3);
    expect(result.state.phase).toBe("done");
    expect(result.routeTrace).toHaveLength(2);
    expect(result.routeTrace[0]?.from).toBe("supervisor");
    expect(result.routeTrace[0]?.to).toBe("worker");
    expect(result.routeTrace[1]?.from).toBe("worker");
    expect(result.routeTrace[1]?.to).toBe("supervisor");
  });

  it("supervisor가 알 수 없는 agent를 라우팅하면 UnknownAgentError를 던진다", async () => {
    const factory = createTeamFactory<TeamState, TeamState, string>({
      stateSchema: teamStateSchema
    });

    const team = factory.createTeam({
      teamId: "unknown-agent-route",
      supervisor: {
        id: "supervisor",
        run: async (ctx) => ({
          state: ctx.state,
          decision: { next: "not-exists" }
        })
      },
      agents: [],
      termination: {
        maxSteps: 2,
        isDone: () => false
      }
    });

    await expect(team.run({ phase: "triage", noteCount: 0 })).rejects.toBeInstanceOf(UnknownAgentError);
  });

  it("maxSteps를 초과하면 MaxStepsExceededError를 던진다", async () => {
    const factory = createTeamFactory<TeamState, TeamState, string>({
      stateSchema: teamStateSchema
    });

    const team = factory.createTeam({
      teamId: "max-steps",
      supervisor: {
        id: "supervisor",
        run: async (ctx) => ({
          state: ctx.state,
          decision: { next: "worker" }
        })
      },
      agents: [
        {
          id: "worker",
          run: async (ctx) => ({ state: ctx.state })
        }
      ],
      termination: {
        maxSteps: 2,
        isDone: () => false
      }
    });

    await expect(team.run({ phase: "triage", noteCount: 0 })).rejects.toBeInstanceOf(MaxStepsExceededError);
  });

  it("strict 모드에서는 단계별 상태 검증 실패 시 InvalidStateError를 던진다", async () => {
    const factory = createTeamFactory<TeamState, TeamState, string>({
      stateSchema: teamStateSchema,
      validationMode: "strict"
    });

    const team = factory.createTeam({
      teamId: "strict-state-check",
      supervisor: {
        id: "supervisor",
        run: async (ctx) => ({
          state: {
            ...ctx.state,
            noteCount: "broken" as unknown as number
          },
          decision: { next: "__end__" }
        })
      },
      agents: [],
      termination: {
        maxSteps: 2,
        isDone: () => false
      }
    });

    await expect(team.run({ phase: "triage", noteCount: 0 })).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("input-only 모드에서는 단계별 상태 검증을 생략한다", async () => {
    const factory = createTeamFactory<TeamState, TeamState, string>({
      stateSchema: teamStateSchema,
      validationMode: "input-only"
    });

    const team = factory.createTeam({
      teamId: "input-only-mode",
      supervisor: {
        id: "supervisor",
        run: async (ctx) => ({
          state: {
            ...ctx.state,
            noteCount: "invalid" as unknown as number
          },
          decision: { next: "__end__" }
        })
      },
      agents: [],
      termination: {
        maxSteps: 1,
        isDone: () => false
      }
    });

    const result = await team.run({ phase: "triage", noteCount: 0 });
    expect(result.reason).toBe("route_end");
    expect(result.steps).toBe(1);
    expect(result.state.noteCount).toBe("invalid");
  });

  it("훅 실행 순서와 payload를 전달한다", async () => {
    const onStep = vi.fn();
    const onRoute = vi.fn();
    const onError = vi.fn();

    const factory = createTeamFactory<TeamState, TeamState, string>({
      stateSchema: teamStateSchema,
      hooks: {
        onStep,
        onRoute,
        onError
      }
    });

    const team = factory.createTeam({
      teamId: "hook-order",
      supervisor: {
        id: "supervisor",
        run: async (ctx) => ({
          state: {
            ...ctx.state,
            phase: "done"
          },
          decision: { next: "__end__" },
          output: "ok"
        })
      },
      agents: [],
      termination: {
        maxSteps: 2,
        isDone: (state) => state.phase === "done"
      }
    });

    const result = await team.run({ phase: "triage", noteCount: 0 });

    expect(result.reason).toBe("done");
    expect(onStep).toHaveBeenCalledTimes(1);
    expect(onRoute).toHaveBeenCalledTimes(0);
    expect(onError).toHaveBeenCalledTimes(0);

    const firstStep = onStep.mock.calls[0]?.[0];
    expect(firstStep.teamId).toBe("hook-order");
    expect(firstStep.agentId).toBe("supervisor");
    expect(firstStep.step).toBe(1);
  });

  it("기본값에서는 훅 오류가 런타임을 중단하지 않고 onError로 보고된다", async () => {
    const onError = vi.fn();

    const factory = createTeamFactory<TeamState, TeamState, string>({
      stateSchema: teamStateSchema,
      hooks: {
        onStep: async () => {
          throw new Error("onStep-failed");
        },
        onError
      }
    });

    const team = factory.createTeam({
      teamId: "hook-error-default",
      supervisor: {
        id: "supervisor",
        run: async (ctx) => ({
          state: {
            ...ctx.state,
            phase: "done"
          },
          decision: { next: "__end__" }
        })
      },
      agents: [],
      termination: {
        maxSteps: 1,
        isDone: (state) => state.phase === "done"
      }
    });

    const result = await team.run({ phase: "triage", noteCount: 0 });

    expect(result.reason).toBe("done");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]?.source).toBe("hook");
  });

  it("failOnHookError=true 면 훅 오류를 전파한다", async () => {
    const factory = createTeamFactory<TeamState, TeamState, string>({
      stateSchema: teamStateSchema,
      hooks: {
        onStep: async () => {
          throw new Error("hook-break");
        }
      }
    });

    const team = factory.createTeam({
      teamId: "hook-fail-mode",
      supervisor: {
        id: "supervisor",
        run: async (ctx) => ({
          state: {
            ...ctx.state,
            phase: "done"
          },
          decision: { next: "__end__" }
        })
      },
      agents: [],
      termination: {
        maxSteps: 2,
        isDone: () => false
      }
    });

    await expect(
      team.run(
        { phase: "triage", noteCount: 0 },
        {
          failOnHookError: true
        }
      )
    ).rejects.toThrowError("hook-break");
  });

  it("timeoutMs를 초과하면 RoutingError를 던진다", async () => {
    const factory = createTeamFactory<TeamState, TeamState, string>({
      stateSchema: teamStateSchema
    });

    const team = factory.createTeam({
      teamId: "timeout-team",
      supervisor: {
        id: "supervisor",
        run: async (ctx) => ({
          state: ctx.state,
          decision: { next: "worker" }
        })
      },
      agents: [
        {
          id: "worker",
          run: async (ctx) => {
            await new Promise((resolve) => setTimeout(resolve, 30));
            return {
              state: {
                ...ctx.state,
                noteCount: ctx.state.noteCount + 1
              }
            };
          }
        }
      ],
      termination: {
        maxSteps: 4,
        isDone: () => false
      }
    });

    await expect(
      team.run(
        { phase: "triage", noteCount: 0 },
        {
          timeoutMs: 10
        }
      )
    ).rejects.toBeInstanceOf(RoutingError);
  });

  it("modelAdapter를 AgentContext로 전달한다", async () => {
    const modelInvoke = vi.fn(async () => ({ text: "model-ok" }));

    const factory = createTeamFactory<TeamState, TeamState, string>({
      stateSchema: teamStateSchema,
      modelAdapter: {
        invoke: modelInvoke
      }
    });

    const team = factory.createTeam({
      teamId: "model-adapter-team",
      supervisor: {
        id: "supervisor",
        run: async (ctx) => {
          const modelText = ctx.model ? (await ctx.model.invoke({ prompt: "hello" })).text : "none";

          return {
            state: {
              ...ctx.state,
              phase: "done",
              response: modelText
            },
            decision: { next: "__end__" },
            output: modelText
          };
        }
      },
      agents: [],
      termination: {
        maxSteps: 2,
        isDone: (state) => state.phase === "done"
      }
    });

    const result = await team.run({ phase: "triage", noteCount: 0 });

    expect(modelInvoke).toHaveBeenCalledTimes(1);
    expect(result.output).toBe("model-ok");
  });
});
