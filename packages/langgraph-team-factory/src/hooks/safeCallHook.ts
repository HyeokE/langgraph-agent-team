import type { TeamErrorEvent, TeamHooks } from "../types/hooks.js";

interface SafeCallHookParams<TState, TInput, TOutput, TPayload> {
  hooks: TeamHooks<TState, TInput, TOutput> | undefined;
  hookName: "onStep" | "onRoute" | "onError" | "onMessage";
  payload: TPayload;
  failOnHookError: boolean;
  onHookErrorEvent?: Omit<TeamErrorEvent<TState, TInput>, "source" | "error">;
}

export async function safeCallHook<TState, TInput, TOutput, TPayload>(
  params: SafeCallHookParams<TState, TInput, TOutput, TPayload>
): Promise<void> {
  const hook = params.hooks?.[params.hookName];

  if (!hook) {
    return;
  }

  try {
    await (hook as (payload: TPayload) => void | Promise<void>)(params.payload);
  } catch (error) {
    if (params.hookName !== "onError" && params.hooks?.onError && params.onHookErrorEvent) {
      try {
        await params.hooks.onError({
          ...params.onHookErrorEvent,
          source: "hook",
          error
        });
      } catch (onErrorFailure) {
        if (params.failOnHookError) {
          throw onErrorFailure;
        }
      }
    }

    if (params.failOnHookError) {
      throw error;
    }
  }
}
