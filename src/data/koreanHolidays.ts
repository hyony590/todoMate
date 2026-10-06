export type HolidayMap = Record<string, string[]>
export const holidaySource = 'https://github.com/hyunbinseo/holidays-kr'
const inFlight = new Map<number, Promise<{ holidays: HolidayMap; stale: boolean }>>()

export function validateHolidayData(data: unknown, year: number): HolidayMap {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('공휴일 데이터 형식 오류')
  const entries = Object.entries(data)
  if (!entries.length || entries.some(([date, names]) => !new RegExp(`^${year}-\\d{2}-\\d{2}$`).test(date) || !Array.isArray(names) || !names.length || names.some(name => typeof name !== 'string' || !name.trim()))) throw new Error('공휴일 데이터 형식 오류')
  return Object.fromEntries(entries) as HolidayMap
}

export async function loadKoreanHolidays(year: number): Promise<{ holidays: HolidayMap; stale: boolean }> {
  const existing = inFlight.get(year)
  if (existing) return existing
  const request = (async () => {
    const cacheKey = `haru.krHolidays.v1.${year}`
    let cached: { holidays: HolidayMap; fetchedAt: number } | undefined
    try {
      const stored = JSON.parse(localStorage.getItem(cacheKey) ?? 'null')
      if (stored) cached = { holidays: validateHolidayData(stored.holidays, year), fetchedAt: stored.fetchedAt }
    } catch { /* Public cache corruption must not affect user data. */ }
    if (cached && Date.now() - cached.fetchedAt < 6 * 60 * 60 * 1000) return { holidays: cached.holidays, stale: false }
    try {
      const response = await fetch(`https://raw.githubusercontent.com/hyunbinseo/holidays-kr/main/public/${year}.json`, { signal: AbortSignal.timeout(10000) })
      if (!response.ok) throw new Error('공휴일 데이터가 제공되지 않는 연도입니다.')
      const holidays = validateHolidayData(await response.json(), year)
      try { localStorage.setItem(cacheKey, JSON.stringify({ holidays, fetchedAt: Date.now() })) } catch { /* Cache is optional. */ }
      return { holidays, stale: false }
    } catch {
      if (cached) return { holidays: cached.holidays, stale: true }
      throw new Error(`${year}년 대한민국 공휴일 정보를 확인하지 못했어요. 공휴일 제외 습관은 확인될 때까지 표시를 보류합니다.`)
    }
  })()
  inFlight.set(year, request)
  try { return await request } finally { inFlight.delete(year) }
}
