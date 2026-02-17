# @agent-team/langgraph-team-factory

TypeScript에서 `LangGraph` 기반 에이전트 팀을 팩토리 패턴으로 조립/실행하기 위한 패키지입니다.

## 설치

```bash
pnpm add @agent-team/langgraph-team-factory zod @langchain/langgraph
```

## 핵심 API

```ts
import { createTeamFactory, createDeclarativeAgent } from "@agent-team/langgraph-team-factory";
```

- `createTeamFactory(options)`
- `factory.createTeam(config)`
- `team.run(input, runOptions?)`
- `createDeclarativeAgent(config)`

## 선언형 에이전트 예시

```ts
import { createDeclarativeAgent } from "@agent-team/langgraph-team-factory";
import { z } from "zod";

const writer = createDeclarativeAgent({
  id: "writer",
  prompt: {
    system: "너는 답변 작성 담당이다.",
    user: (ctx) => `요청: ${ctx.input.query}`
  },
  retry: { attempts: 2, backoffMs: 200 },
  timeoutMs: 8_000,
  responseSchema: z.object({
    answer: z.string()
  }),
  stateResolver: ({ ctx, parsed }) => ({
    ...ctx.state,
    draft: parsed?.answer
  }),
  outputResolver: ({ parsed }) => parsed?.answer
});
```

## 특징

- Supervisor 라우팅 기반 팀 오케스트레이션
- Generic + Zod 런타임 상태 검증
- 훅: `onStep`, `onRoute`, `onError`
- 종료 정책: `maxSteps` + `isDone`
- timeout 및 route trace 지원
- 선언형 에이전트 빌더 지원
  - 프롬프트 템플릿
  - 툴 실행
  - 리트라이/타임아웃
  - 응답 파싱 및 상태 반영

## 문서

- 루트 문서: `/Users/junhyeok/code/agent-team/README.md`
- 아키텍처: `/Users/junhyeok/code/agent-team/ARCHITECTURE.md`
