import { useEffect, useState } from 'react'
import { loadKoreanHolidays, type HolidayMap } from './data/koreanHolidays'

export function useKoreanHolidays(year: number) {
  const [state, setState] = useState<{ year: number; holidays: HolidayMap; ready: boolean; notice: string }>({ year, holidays: {}, ready: false, notice: '' })
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setState({ year, holidays: {}, ready: false, notice: '' })
    loadKoreanHolidays(year).then(({ holidays, stale }) => {
      if (active) setState({ year, holidays, ready: true, notice: stale ? '공휴일 정보를 갱신하지 못해 마지막으로 조회한 자료를 사용합니다.' : '' })
    }).catch(error => { if (active) setState({ year, holidays: {}, ready: false, notice: error.message }) })
    return () => { active = false }
  }, [year, retry])
  return { ...(state.year === year ? state : { year, holidays: {}, ready: false, notice: '' }), reload: () => setRetry(value => value + 1) }
}
