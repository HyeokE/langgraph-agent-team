export type RouteDecision = { next: string } | { next: "__end__" };

export type ValidationMode = "strict" | "input-only";

export type TeamCompletionReason = "done" | "route_end";
