/**
 * 날짜 문자열을 사람이 읽기 쉬운 형식으로 변환합니다.
 */
export function formatDate(isoString: string): string {
  const date = new Date(isoString)
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

/**
 * 두 날짜 사이의 경과 시간을 사람이 읽기 쉬운 형식으로 반환합니다.
 */
export function formatDuration(startIso: string, endIso: string): string {
  const startMs = new Date(startIso).getTime()
  const endMs = new Date(endIso).getTime()
  const diffMs = endMs - startMs

  if (diffMs < 1000) return `${diffMs}ms`

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return `${seconds}초`

  const minutes = Math.floor(seconds / 60)
  const remainSeconds = seconds % 60
  if (minutes < 60) return `${minutes}분 ${remainSeconds}초`

  const hours = Math.floor(minutes / 60)
  const remainMinutes = minutes % 60
  return `${hours}시간 ${remainMinutes}분`
}

/**
 * 상대적 시간 표현 반환 (예: "방금 전", "3분 전")
 */
export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)

  if (diffSeconds < 60) return '방금 전'

  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}분 전`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}시간 전`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}일 전`

  return formatDate(isoString)
}
