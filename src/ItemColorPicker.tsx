import { itemColors } from './data/itemColors'

export default function ItemColorPicker({ value, onChange, label }: { value: string; onChange: (color: string) => void; label: string }) {
  return <div className="item-color-picker" role="group" aria-label={`${label} 색상`}><span>색상</span><div className="category-color-picks">{itemColors.map(color => <button type="button" key={color} aria-label={`${label} ${color} 선택`} aria-pressed={value.toLowerCase() === color} className={value.toLowerCase() === color ? 'selected' : ''} style={{ background: color }} onClick={() => onChange(color)} />)}</div><label className="item-custom-color"><input type="color" aria-label={`${label} 직접 색상 선택`} value={value} onInput={event => onChange(event.currentTarget.value)} onChange={event => onChange(event.target.value)} />직접 선택</label></div>
}
