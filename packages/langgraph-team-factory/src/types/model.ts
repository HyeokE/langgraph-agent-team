export interface ModelRequest {
  prompt: string;
  messages?: unknown[];
  metadata?: Record<string, unknown>;
}

export interface ModelUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface ModelResponse {
  text: string;
  raw?: unknown;
  usage?: ModelUsage;
}

export interface ModelAdapter {
  invoke(request: ModelRequest): Promise<ModelResponse>;
}
