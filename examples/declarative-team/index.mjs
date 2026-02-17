import { z } from "zod";
import {
  createDeclarativeAgent,
  createTeamFactory
} from "@agent-team/langgraph-team-factory";

const stateSchema = z.object({
  stage: z.enum(["plan", "research", "done"]),
  query: z.string(),
  notes: z.array(z.string()),
  answer: z.string().optional()
});

const supervisor = {
  id: "supervisor",
  run: async (ctx) => {
    if (ctx.state.stage === "plan") {
      return {
        state: { ...ctx.state, stage: "research" },
        decision: { next: "researcher" }
      };
    }

    return {
      state: { ...ctx.state, stage: "done" },
      decision: { next: "__end__" }
    };
  }
};

const researcher = createDeclarativeAgent({
  id: "researcher",
  prompt: {
    system: "너는 리서치 에이전트다. 핵심만 간결히 답해라.",
    context: (ctx) => `현재 노트 수: ${ctx.state.notes.length}`,
    user: (ctx) => `질문: ${ctx.input.query}`
  },
  tools: [
    {
      name: "knowledge-base",
      execute: async () => "내부 KB: factory 패턴은 역할 분리와 테스트 용이성을 높인다."
    }
  ],
  retry: {
    attempts: 2,
    backoffMs: 50
  },
  responseSchema: z.object({
    summary: z.string()
  }),
  stateResolver: ({ ctx, parsed }) => ({
    ...ctx.state,
    notes: [...ctx.state.notes, parsed?.summary ?? "summary 없음"],
    answer: parsed?.summary
  }),
  outputResolver: ({ parsed }) => parsed?.summary
});

async function main() {
  const factory = createTeamFactory({
    stateSchema,
    modelAdapter: {
      invoke: async (request) => {
        const summary = `Mock summary: ${request.prompt.slice(0, 70)}`;
        return {
          text: JSON.stringify({ summary })
        };
      }
    },
    hooks: {
      onRoute: (event) => console.log(`[route] ${event.from} -> ${event.to}`)
    }
  });

  const team = factory.createTeam({
    teamId: "declarative-team-example",
    supervisor,
    agents: [researcher],
    termination: {
      maxSteps: 6,
      isDone: (state) => state.stage === "done"
    }
  });

  const result = await team.run({
    stage: "plan",
    query: "왜 선언형 에이전트 설정이 유지보수에 유리한가?",
    notes: []
  });

  console.log("\nResult:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
