import type { ScriptToolConfig } from '../../../main/types/toolDefinition'

interface ScriptToolConfigEditorProps {
  config: ScriptToolConfig
  availableEnvKeys: string[]
  onChange: (config: ScriptToolConfig) => void
}

const SCRIPT_EXAMPLE = `// 사용 가능한 변수:
// state - 현재 에이전트 상태 (예: state.symbol)
// input - 에이전트 입력
// env   - 환경 변수 (예: env.API_KEY)

const price = state.price ?? 0
const symbol = state.symbol ?? 'BTC'
return \`\${symbol} 현재 가격: \${price}\``

export function ScriptToolConfigEditor({
  config,
  availableEnvKeys,
  onChange
}: ScriptToolConfigEditorProps) {
  const envHint =
    availableEnvKeys.length > 0
      ? availableEnvKeys.map((k) => `env.${k}`).join(', ')
      : '(등록된 ENV 없음)'

  return (
    <div className="space-y-4">
      {/* 샌드박스 안내 */}
      <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
        <strong>샌드박스 환경:</strong> Node.js 20에서 실행됩니다.
        <br />
        접근 가능: <code className="font-mono">state</code>, <code className="font-mono">input</code>, <code className="font-mono">env</code> ({envHint})
        <br />
        접근 불가: <code className="font-mono">require</code>, <code className="font-mono">fs</code>, <code className="font-mono">process</code> 등 Node.js API
      </div>

      {/* 코드 에디터 */}
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600">JavaScript 코드</label>
        <textarea
          value={config.code}
          onChange={(e) => onChange({ ...config, code: e.target.value })}
          placeholder={SCRIPT_EXAMPLE}
          rows={12}
          spellCheck={false}
          className="w-full rounded-md border border-zinc-200 px-3 py-2 text-xs font-mono text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none resize-y"
          style={{ userSelect: 'text' }}
        />
      </div>
    </div>
  )
}
