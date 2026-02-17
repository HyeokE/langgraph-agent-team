import { z } from "zod";
import { createTeamFactory } from "@agent-team/langgraph-team-factory";

const stateSchema = z.object({
  stage: z.enum(["triage", "research", "respond", "done"]),
  task: z.string(),
  researchNotes: z.array(z.string()),
  finalAnswer: z.string().optional()
});

const supervisor = {
  id: "supervisor",
  description: "Routes work based on stage",
  run: async (ctx) => {
    switch (ctx.state.stage) {
      case "triage":
        return {
          state: { ...ctx.state, stage: "research" },
          decision: { next: "researcher" }
        };
      case "research":
        return {
          state: { ...ctx.state, stage: "respond" },
          decision: { next: "responder" }
        };
      case "respond":
        return {
          state: { ...ctx.state, stage: "done" },
          decision: { next: "__end__" }
        };
      default:
        return {
          state: ctx.state,
          decision: { next: "__end__" }
        };
    }
  }
};

const researcher = {
  id: "researcher",
  run: async (ctx) => ({
    state: {
      ...ctx.state,
      researchNotes: [...ctx.state.researchNotes, "LangGraph + Factory pattern keeps orchestration modular."]
    }
  })
};

const responder = {
  id: "responder",
  run: async (ctx) => {
    const finalAnswer = `Task: ${ctx.state.task}\nSummary: ${ctx.state.researchNotes.join(" ")}`;

    return {
      state: {
        ...ctx.state,
        finalAnswer
      },
      output: finalAnswer
    };
  }
};

async function main() {
  const factory = createTeamFactory({
    stateSchema,
    hooks: {
      onRoute: (event) => {
        console.log(`[route] step=${event.step} ${event.from} -> ${event.to}`);
      }
    }
  });

  const team = factory.createTeam({
    teamId: "supervisor-routing-example",
    supervisor,
    agents: [researcher, responder],
    termination: {
      maxSteps: 8,
      isDone: (state) => state.stage === "done"
    }
  });

  const result = await team.run({
    stage: "triage",
    task: "Explain why factory pattern is useful for agent teams.",
    researchNotes: []
  });

  console.log("\nResult:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
