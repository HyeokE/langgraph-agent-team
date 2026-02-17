import { RoutingError } from "../errors/RoutingError.js";
import type { TeamFactoryOptions, TeamFactory } from "../types/team.js";
import { compileGraph } from "../runtime/compileGraph.js";
import { runTeam } from "../runtime/runTeam.js";
import { validateTeamConfig } from "../runtime/validateTeamConfig.js";

function assertFactoryOptions<TState, TInput, TOutput>(
  options: TeamFactoryOptions<TState, TInput, TOutput>
): void {
  if (!options || !options.stateSchema) {
    throw new RoutingError("TeamFactoryOptions.stateSchema is required.");
  }

  if (
    options.validationMode !== undefined &&
    options.validationMode !== "strict" &&
    options.validationMode !== "input-only"
  ) {
    throw new RoutingError(
      "TeamFactoryOptions.validationMode must be either \"strict\" or \"input-only\"."
    );
  }
}

export function createTeamFactory<TState, TInput, TOutput>(
  options: TeamFactoryOptions<TState, TInput, TOutput>
): TeamFactory<TState, TInput, TOutput> {
  assertFactoryOptions(options);

  return {
    createTeam(config) {
      validateTeamConfig(config);
      const compiledGraph = compileGraph(config);

      return {
        run(input, runOptions) {
          return runTeam({
            config,
            factoryOptions: options,
            runOptions,
            input,
            compiledGraph
          });
        }
      };
    }
  };
}
