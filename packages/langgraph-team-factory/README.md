# @agent-team/langgraph-team-factory

TypeScript에서 `LangGraph` 기반 에이전트 팀을 팩토리 패턴으로 조립/실행하기 위한 패키지입니다.

## 설치
```bash
pnpm add @agent-team/langgraph-team-factory zod @langchain/langgraph
```

## 핵심 API
```ts
import { createTeamFactory } from "@agent-team/langgraph-team-factory";
```

- `createTeamFactory(options)`
- `factory.createTeam(config)`
- `team.run(input, runOptions)`

## 특징
- Supervisor 라우팅 기반 팀 오케스트레이션
- Generic + Zod 런타임 상태 검증
- 훅: `onStep`, `onRoute`, `onError`
- 종료 정책: `maxSteps` + `isDone`
- timeout 및 route trace 지원

## 문서
모노레포 루트 README의 Quick Start/예제를 참고하세요.
