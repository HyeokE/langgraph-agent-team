import { RoutingError } from "../errors/RoutingError.js";
import type { TeamConfig } from "../types/team.js";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateTeamConfig<TState, TInput, TOutput>(
  config: TeamConfig<TState, TInput, TOutput>
): void {
  if (!isNonEmptyString(config.teamId)) {
    throw new RoutingError("teamId must be a non-empty string.");
  }

  if (!isNonEmptyString(config.supervisor.id)) {
    throw new RoutingError("Supervisor agent id must be a non-empty string.", {
      teamId: config.teamId
    });
  }

  if (!Array.isArray(config.agents)) {
    throw new RoutingError("agents must be an array.", {
      teamId: config.teamId
    });
  }

  if (!Number.isInteger(config.termination.maxSteps) || config.termination.maxSteps <= 0) {
    throw new RoutingError("termination.maxSteps must be a positive integer.", {
      teamId: config.teamId
    });
  }

  if (typeof config.termination.isDone !== "function") {
    throw new RoutingError("termination.isDone must be a function.", {
      teamId: config.teamId
    });
  }

  const ids = new Set<string>([config.supervisor.id]);

  for (const agent of config.agents) {
    if (!isNonEmptyString(agent.id)) {
      throw new RoutingError("Each agent id must be a non-empty string.", {
        teamId: config.teamId
      });
    }

    if (agent.id === "__end__") {
      throw new RoutingError('Agent id "__end__" is reserved.', {
        teamId: config.teamId,
        agentId: agent.id
      });
    }

    if (ids.has(agent.id)) {
      throw new RoutingError(`Duplicate agent id detected: ${agent.id}.`, {
        teamId: config.teamId,
        agentId: agent.id
      });
    }

    ids.add(agent.id);
  }
}
