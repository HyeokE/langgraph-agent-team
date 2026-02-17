import { z } from "zod";
import { createTeamFactory } from "@agent-team/langgraph-team-factory";

const stateSchema = z.object({
  stage: z.enum(["plan", "tool", "final", "done"]),
  question: z.string(),
  toolResult: z.string().optional(),
  answer: z.string().optional()
});

const tools = {
  lookup: (query) => `Tool lookup result for: ${query}`
};

const supervisor = {
  id: "supervisor",
  run: async (ctx) => {
    if (ctx.state.stage === "plan") {
      return {
        state: { ...ctx.state, stage: "tool" },
        decision: { next: "tool-agent" }
      };
    }

    if (ctx.state.stage === "tool") {
      return {
        state: { ...ctx.state, stage: "final" },
        decision: { next: "answer-agent" }
      };
    }

    return {
      state: { ...ctx.state, stage: "done" },
      decision: { next: "__end__" }
    };
  }
};

const toolAgent = {
  id: "tool-agent",
  run: async (ctx) => {
    const toolResult = tools.lookup(ctx.state.question);

    return {
      state: {
        ...ctx.state,
        toolResult
      }
    };
  }
};

const answerAgent = {
  id: "answer-agent",
  run: async (ctx) => {
    const modelText = ctx.model
      ? (await ctx.model.invoke({
          prompt: `Question: ${ctx.state.question}\nTool: ${ctx.state.toolResult ?? "none"}`
        })).text
      : "No model configured";

    const answer = `Answer: ${modelText}`;

    return {
      state: {
        ...ctx.state,
        answer
      },
      output: answer
    };
  }
};

async function main() {
  const factory = createTeamFactory({
    stateSchema,
    modelAdapter: {
      invoke: async (request) => ({
        text: `MockModel => ${request.prompt.slice(0, 60)}`
      })
    },
    hooks: {
      onStep: (event) => {
        console.log(`[step] #${event.step} agent=${event.agentId}`);
      }
    }
  });

  const team = factory.createTeam({
    teamId: "tool-enabled-example",
    supervisor,
    agents: [toolAgent, answerAgent],
    termination: {
      maxSteps: 10,
      isDone: (state) => state.stage === "done"
    }
  });

  const result = await team.run({
    stage: "plan",
    question: "What is the latest status of our internal migration?"
  });

  console.log("\nResult:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
