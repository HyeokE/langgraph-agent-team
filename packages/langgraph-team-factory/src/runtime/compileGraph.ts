import * as LangGraph from "@langchain/langgraph";
import { RoutingError } from "../errors/RoutingError.js";
import type { TeamConfig } from "../types/team.js";

export interface CompiledTeamGraph {
  framework: "langgraph";
  graph: unknown;
  topology: {
    startNode: string;
    supervisorNode: string;
    workerNodes: string[];
    endToken: "__end__";
  };
  langGraphVersion?: string;
}

function instantiateStateGraph(moduleRef: Record<string, unknown>): unknown {
  const StateGraphCtor = moduleRef.StateGraph as
    | (new (...args: unknown[]) => Record<string, unknown>)
    | undefined;

  if (!StateGraphCtor) {
    throw new RoutingError("@langchain/langgraph.StateGraph is not available.");
  }

  const candidates: unknown[] = [];
  const annotationRef = moduleRef.Annotation as Record<string, unknown> | undefined;

  if (annotationRef && typeof annotationRef.Root === "function") {
    try {
      const AnnotationAsAny = annotationRef as {
        Root: (schema: Record<string, unknown>) => unknown;
      };
      const root = AnnotationAsAny.Root({});
      candidates.push(new StateGraphCtor(root));
    } catch {
      // Ignore and continue with constructor fallbacks.
    }
  }

  try {
    candidates.push(new StateGraphCtor({}));
  } catch {
    // Ignore and try no-arg constructor.
  }

  try {
    candidates.push(new StateGraphCtor());
  } catch {
    // Ignore.
  }

  if (candidates.length === 0) {
    throw new RoutingError("Unable to instantiate LangGraph StateGraph.");
  }

  return candidates[0];
}

function safelyAttachTopology(
  graph: Record<string, unknown>,
  config: TeamConfig<unknown, unknown, unknown>,
  moduleRef: Record<string, unknown>
): void {
  const maybeStart = typeof moduleRef.START === "string" ? moduleRef.START : "__start__";
  const maybeEnd = typeof moduleRef.END === "string" ? moduleRef.END : "__end__";

  if (typeof graph.addNode === "function") {
    graph.addNode(config.supervisor.id, (state: unknown) => state);
    for (const agent of config.agents) {
      graph.addNode(agent.id, (state: unknown) => state);
    }
  }

  if (typeof graph.addEdge === "function") {
    graph.addEdge(maybeStart, config.supervisor.id);
    for (const agent of config.agents) {
      graph.addEdge(agent.id, config.supervisor.id);
    }
  }

  if (typeof graph.addConditionalEdges === "function") {
    graph.addConditionalEdges(config.supervisor.id, (state: { __next?: string }) => state.__next ?? maybeEnd);
  }
}

export function compileGraph<TState, TInput, TOutput>(
  config: TeamConfig<TState, TInput, TOutput>
): CompiledTeamGraph {
  const moduleRef = LangGraph as unknown as Record<string, unknown>;
  const baseGraph = instantiateStateGraph(moduleRef);

  let graph = baseGraph;

  if (graph && typeof graph === "object") {
    try {
      safelyAttachTopology(
        graph as Record<string, unknown>,
        config as TeamConfig<unknown, unknown, unknown>,
        moduleRef
      );

      if (typeof (graph as Record<string, unknown>).compile === "function") {
        graph = (graph as { compile: () => unknown }).compile();
      }
    } catch {
      // Topology attachment is best-effort, runtime loop remains source of truth.
    }
  }

  const langGraphVersion =
    typeof moduleRef.VERSION === "string"
      ? moduleRef.VERSION
      : typeof moduleRef.version === "string"
        ? moduleRef.version
        : undefined;

  const compiledGraph: CompiledTeamGraph = {
    framework: "langgraph",
    graph,
    topology: {
      startNode: config.supervisor.id,
      supervisorNode: config.supervisor.id,
      workerNodes: config.agents.map((agent) => agent.id),
      endToken: "__end__"
    }
  };

  if (langGraphVersion !== undefined) {
    compiledGraph.langGraphVersion = langGraphVersion;
  }

  return compiledGraph;
}
