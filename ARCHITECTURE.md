# LangGraph Agent Team Factory 아키텍처

이 문서는 `@agent-team/langgraph-team-factory` 패키지의 핵심 구조와 런타임 동작 원리를 설명합니다.

## 목표

- LangGraph 기반 에이전트 팀을 팩토리 패턴으로 조립
- Supervisor 라우팅 중심 팀 실행
- TypeScript 타입 안정성과 Zod 런타임 검증 동시 제공
- 표준 훅(`onStep`, `onRoute`, `onError`) 기반 관측성 제공

## 패키지 구조

```text
packages/langgraph-team-factory/
  src/
    index.ts                    # 공개 API export
    factory/
      createTeamFactory.ts      # 단일 진입점 팩토리
    declarative/
      createDeclarativeAgent.ts # 선언형 에이전트 빌더
    runtime/
      compileGraph.ts           # LangGraph StateGraph 컴파일 (best-effort)
      runTeam.ts                # 실제 실행 루프(source of truth)
      validateTeamConfig.ts     # 팀 구성 정적 검증
      validateState.ts          # Zod 상태 검증
    hooks/
      mergeHooks.ts             # 팩토리 훅 + 실행시 override 훅 병합
      safeCallHook.ts           # 훅 안전 호출/오류 승격 제어
    errors/
      *Error.ts                 # 런타임 오류 모델
    types/
      *.ts                      # Team/Agent/Run/Hook/Model 타입
```

## 핵심 인터페이스

- `createTeamFactory(options)`
  - `stateSchema: ZodType<TState>` 필수
  - `modelAdapter?`, `hooks?`, `validationMode?` 설정
- `factory.createTeam(config)`
  - `teamId`, `supervisor`, `agents`, `termination` 정의
- `team.run(input, runOptions?)`
  - 팀 실행, 최종 상태/출력/trace 반환
- `createDeclarativeAgent(config)`
  - 선언형 프롬프트/툴/리트라이/타임아웃/응답파싱/상태반영 구성

## 선언형 에이전트 빌더

`createDeclarativeAgent`는 `TeamAgent.run`을 직접 작성하지 않아도, 설정 객체만으로 에이전트를 만들 수 있게 해줍니다.

- 프롬프트 템플릿
  - `prompt.system`, `prompt.developer`, `prompt.context`, `prompt.user`
- 툴
  - `tools[]` 선언 후 실행 결과를 프롬프트에 자동 주입
  - `toolErrorMode: "throw" | "continue"`
- 모델 호출 제어
  - `retry.attempts`, `retry.backoffMs`, `timeoutMs`
  - `fallbackResponseText`(모델 없을 때 fallback)
- 응답 처리
  - `responseSchema`(Zod) 또는 `parseResponse`
  - `stateResolver`, `outputResolver`, `decisionResolver`

## 실행 흐름

1. 팩토리 생성
   - `createTeamFactory`에서 공통 의존성 고정
2. 팀 생성
   - `validateTeamConfig`로 구성 검증
   - `compileGraph`로 LangGraph 그래프 준비
3. 실행 시작
   - 초기 상태 생성
   - 초기 상태 Zod 검증
4. 루프 실행
   - `abort/timeout/maxSteps` 검사
   - 현재 에이전트 실행
   - `strict` 모드면 step 단위 상태 검증
   - `onStep` 호출
   - 종료 조건(`isDone`) 검사
   - 라우팅
     - Supervisor: `decision.next`로 다음 Worker 결정
     - Worker: Supervisor로 자동 복귀
   - `onRoute` 호출 및 `routeTrace` 기록
5. 종료
   - `done` 또는 `route_end`로 종료
   - `TeamRunResult` 반환

## 라우팅 모델

- Supervisor가 반드시 `decision`을 반환해야 함
- `decision.next === "__end__"`이면 즉시 종료
- 미등록 에이전트로 라우팅 시 `UnknownAgentError`
- Worker 실행 후에는 항상 Supervisor로 되돌아감

## 상태 검증 모델

- 기본값 `validationMode: "strict"`
  - 초기 상태 + 각 스텝 이후 상태를 Zod 검증
- `validationMode: "input-only"`
  - 초기 상태만 검증하고 스텝 후 검증은 생략
- 검증 실패 시 `InvalidStateError` 발생

## 종료/안전 정책

- `termination.maxSteps` 필수
- `termination.isDone(state)`로 비즈니스 종료 제어
- `runOptions.timeoutMs`로 실행 시간 제한
- `runOptions.signal`로 취소 지원

## 훅 처리 정책

- 지원 훅
  - `onStep(event)`
  - `onRoute(event)`
  - `onError(event)`
- 기본 동작
  - `onStep`/`onRoute`에서 오류가 나도 실행은 계속
  - 해당 오류는 `onError`로 보고
- `failOnHookError: true`
  - 훅 오류를 런타임 실패로 승격

## 오류 모델

- `TeamRuntimeError` (기반 오류)
- `InvalidStateError` (상태 검증 실패)
- `UnknownAgentError` (미등록 에이전트 라우팅)
- `MaxStepsExceededError` (`maxSteps` 초과)
- `RoutingError` (Supervisor decision 누락, timeout, abort 등)

## LangGraph 통합 방식

- `compileGraph.ts`에서 `@langchain/langgraph`의 `StateGraph` 인스턴스를 구성 시도
- 환경/버전에 따라 토폴로지 연결을 best-effort로 적용
- 실제 제어 흐름의 source of truth는 `runTeam.ts`의 실행 루프
- 즉, LangGraph 객체는 팀 구조의 일관된 표기와 확장 지점 역할

## 결과 객체

`TeamRunResult<TState, TOutput>`

- `teamId`
- `state` (최종 상태)
- `output?`
- `steps`
- `routeTrace[]`
- `completed: true`
- `reason: "done" | "route_end"`
- `startedAt`, `finishedAt`

## 예제 위치

- `examples/supervisor-routing/index.mjs`
- `examples/tool-enabled-agent/index.mjs`

## 품질 기준

- 타입 검사: `pnpm typecheck`
- 린트: `pnpm lint`
- 테스트: `pnpm test`
- 커버리지 게이트: `pnpm test:c8` (라인 80% 이상)
