import type { TeamDefinition } from '../types/teamDefinition.js'

const supervisorsPrompt = `당신은 암호화폐 트레이딩 팀의 감독자입니다.
현재 상태를 보고 다음 에이전트를 선택하세요.
필수 규칙:
- 입력 심볼(symbol)과 분석 기간(analysisWindow)에 따라 현재 컨텍스트를 우선 처리한다.
- 시장 분석이 먼저 끝나지 않았다면 market-researcher로 보낸다.
- 리스크 평가가 끝나지 않았거나 값이 없으면 risk-manager로 보낸다.
- 거래 전략이 아직 없으면 strategy-planner로 보낸다.
- 실제 실행 제안이 준비되었으면 execution-planner로 보내 최종 의사결정을 얻는다.
- 최종 판단이 완료되면 "__end__"를 반환한다.
반환은 다음 JSON 형식만 허용합니다: {"reasoning": "...", "next": "..."}`

const marketResearchPrompt = `당신은 암호화폐 시장 데이터를 해석하는 연구 에이전트입니다.
symbol와 analysisWindow를 기반으로 최근 변동성, 모멘텀 방향, 주요 이벤트 리스크를 텍스트로 정리하세요.`

const riskManagerPrompt = `당신은 리스크 매니저입니다.
거래 심벌의 변동성, 유동성, 추세 반전 가능성, 극단적 변동 구간 위험을 반영해
보수적 관점으로 리스크 등급을 판단하고 구체적 근거를 작성하세요.`

const strategyPlannerPrompt = `당신은 전략 기획 에이전트입니다.
시장 인사이트와 리스크 분석을 바탕으로 진입/청산 조건, 포지션 크기, 트리거 신호를 포함한
실행 가능한 트레이딩 플랜을 작성하세요.`

const executionPlannerPrompt = `당신은 실행 기획 에이전트입니다.
전략 계획을 토대로 주문 타입, 목표가/손절가, 모니터링 규칙, 비상 대응 절차를 정리해 실행 제안안을 작성하세요.`

export function buildCryptoTradingTeamSeed():
  Omit<TeamDefinition, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: '암호화폐 트레이딩 팀',
    description: '심볼 기반으로 시장 분석 → 리스크 평가 → 전략 수립 → 실행 제안 순으로 진행하는 트레이딩 팀입니다.',
    category: '암호화폐',
    supervisor: {
      id: 'supervisor',
      systemPrompt: supervisorsPrompt
    },
    agents: [
      {
        id: 'market-researcher',
        name: 'Market Researcher',
        role: '시장 분석 에이전트',
        systemPrompt: marketResearchPrompt,
        outputField: 'marketInsight'
      },
      {
        id: 'risk-manager',
        name: 'Risk Manager',
        role: '리스크 평가 에이전트',
        systemPrompt: riskManagerPrompt,
        outputField: 'riskAssessment'
      },
      {
        id: 'strategy-planner',
        name: 'Strategy Planner',
        role: '전략 기획 에이전트',
        systemPrompt: strategyPlannerPrompt,
        outputField: 'tradePlan'
      },
      {
        id: 'execution-planner',
        name: 'Execution Planner',
        role: '실행 제안 에이전트',
        systemPrompt: executionPlannerPrompt,
        outputField: 'executionDecision'
      }
    ],
    stateFields: [
      {
        name: 'symbol',
        type: 'string',
        optional: false,
        description: '분석할 거래 심볼'
      },
      {
        name: 'analysisWindow',
        type: 'string',
        optional: false,
        default: '1h',
        description: '분석 캔들 간격'
      },
      {
        name: 'marketInsight',
        type: 'string',
        optional: true,
        description: '시장 분석 결과'
      },
      {
        name: 'riskAssessment',
        type: 'string',
        optional: true,
        description: '리스크 평가 결과'
      },
      {
        name: 'tradePlan',
        type: 'string',
        optional: true,
        description: '거래 전략'
      },
      {
        name: 'executionDecision',
        type: 'string',
        optional: true,
        description: '실행 제안'
      }
    ],
    maxSteps: 30
  }
}
