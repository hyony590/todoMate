export default function PetalMark({ colors, completed = false, count = 0 }: { colors: string[]; completed?: boolean; count?: number }) {
  const flower = 'M12 3.8C5.2-1.5-1.5 5.2 3.8 12C-1.5 18.8 5.2 25.5 12 20.2C18.8 25.5 25.5 18.8 20.2 12C25.5 5.2 18.8-1.5 12 3.8Z'
  return <svg className="petal-mark" viewBox="0 0 24 24" aria-hidden="true">
    <path d={flower} fill={colors[0] || 'currentColor'} />
    {colors.length > 1 && <>{[1, 2, 3].map(index => <path key={index} d={flower} fill={colors[index] || colors[index % colors.length]} style={{ clipPath: index === 1 ? 'inset(0 0 50% 50%)' : index === 2 ? 'inset(50% 50% 0 0)' : 'inset(50% 0 0 50%)' }} />)}</>}
    {completed ? <path d="m7.5 12 3 3 6-6" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /> : count > 0 && <text x="12" y="15.5" textAnchor="middle" fill="white" fontSize="11" fontWeight="700">{count}</text>}
  </svg>
}
