import type { TeamHooks } from "../types/hooks.js";

export function mergeHooks<TState, TInput, TOutput>(
  base?: TeamHooks<TState, TInput, TOutput>,
  overrides?: Partial<TeamHooks<TState, TInput, TOutput>>
): TeamHooks<TState, TInput, TOutput> | undefined {
  if (!base && !overrides) {
    return undefined;
  }

  const merged: TeamHooks<TState, TInput, TOutput> = {};
  const onStep = overrides?.onStep ?? base?.onStep;
  const onRoute = overrides?.onRoute ?? base?.onRoute;
  const onError = overrides?.onError ?? base?.onError;

  if (onStep !== undefined) {
    merged.onStep = onStep;
  }

  if (onRoute !== undefined) {
    merged.onRoute = onRoute;
  }

  if (onError !== undefined) {
    merged.onError = onError;
  }

  return merged;
}
