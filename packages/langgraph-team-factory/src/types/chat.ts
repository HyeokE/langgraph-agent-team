export interface ChatMessage {
  id: string;
  agentId: string;
  agentName?: string;
  content: string;
  /** content에서 추출된 @agentId 목록 */
  mentions: string[];
  /** 어떤 메시지에 대한 답변/반박인지 */
  replyTo?: string;
  step: number;
  timestamp: string;
}

/**
 * content에서 @agentId 패턴을 추출합니다.
 * 예: "안녕 @researcher 어떻게 생각해?" → ["researcher"]
 */
export function extractMentions(content: string): string[] {
  const pattern = /@([a-zA-Z0-9_-]+)/g;
  const mentions: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    const captured = match[1];
    if (captured !== undefined) {
      mentions.push(captured);
    }
  }

  return [...new Set(mentions)];
}
