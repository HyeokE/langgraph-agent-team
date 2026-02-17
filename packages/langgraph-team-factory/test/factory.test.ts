import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createTeamFactory,
  InvalidStateError,
  RoutingError
} from "../src/index.js";

interface BasicState {
  status: "start" | "done";
}

const stateSchema = z.object({
  status: z.enum(["start", "done"])
});

describe("createTeamFactory", () => {
  it("stateSchema 누락 시 예외를 던진다", () => {
    expect(() => createTeamFactory({} as never)).toThrow(RoutingError);
  });

  it("지원하지 않는 validationMode 시 예외를 던진다", () => {
    expect(() =>
      createTeamFactory({
        stateSchema,
        validationMode: "invalid-mode" as "strict"
      })
    ).toThrow(RoutingError);
  });

  it("중복 agent id 시 createTeam 단계에서 예외를 던진다", () => {
    const factory = createTeamFactory<BasicState, BasicState, string>({
      stateSchema
    });

    expect(() =>
      factory.createTeam({
        teamId: "dup-id-team",
        supervisor: {
          id: "supervisor",
          run: async (ctx) => ({
            state: ctx.state,
            decision: { next: "__end__" }
          })
        },
        agents: [
          {
            id: "worker",
            run: async (ctx) => ({ state: ctx.state })
          },
          {
            id: "worker",
            run: async (ctx) => ({ state: ctx.state })
          }
        ],
        termination: {
          maxSteps: 3,
          isDone: () => false
        }
      })
    ).toThrow(RoutingError);
  });

  it("maxSteps가 0 이하면 createTeam 단계에서 예외를 던진다", () => {
    const factory = createTeamFactory<BasicState, BasicState, string>({
      stateSchema
    });

    expect(() =>
      factory.createTeam({
        teamId: "bad-max-steps",
        supervisor: {
          id: "supervisor",
          run: async (ctx) => ({
            state: ctx.state,
            decision: { next: "__end__" }
          })
        },
        agents: [],
        termination: {
          maxSteps: 0,
          isDone: () => false
        }
      })
    ).toThrow(RoutingError);
  });

  it("초기 상태가 스키마에 맞지 않으면 InvalidStateError를 던진다", async () => {
    const factory = createTeamFactory<BasicState, unknown, string>({
      stateSchema
    });

    const team = factory.createTeam({
      teamId: "invalid-initial-state",
      supervisor: {
        id: "supervisor",
        run: async (ctx) => ({
          state: ctx.state,
          decision: { next: "__end__" }
        })
      },
      agents: [],
      termination: {
        maxSteps: 1,
        isDone: () => false
      }
    });

    await expect(team.run({ bad: true })).rejects.toBeInstanceOf(InvalidStateError);
  });
});
