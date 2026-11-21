import { useMemo, useState } from 'react'
import { money } from '../lib/format'

export interface TrendPoint {
  label: string
  expense: number
  income: number
}

export default function TrendChart({
  data,
  height = 150,
}: {
  data: TrendPoint[]
  height?: number
}) {
  const [active, setActive] = useState<number | null>(null)
  const w = 320
  const pad = { l: 6, r: 6, t: 12, b: 20 }
  const innerW = w - pad.l - pad.r
  const innerH = height - pad.t - pad.b

  const max = useMemo(
    () => Math.max(1, ...data.map((d) => Math.max(d.expense, d.income))),
    [data],
  )

  const xAt = (i: number) =>
    pad.l + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW)
  const yAt = (v: number) => pad.t + innerH - (v / max) * innerH

  const line = (key: 'expense' | 'income') =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(d[key]).toFixed(1)}`).join(' ')

  const area = (key: 'expense' | 'income') => {
    if (data.length === 0) return ''
    const l = line(key)
    return `${l} L${xAt(data.length - 1).toFixed(1)},${(pad.t + innerH).toFixed(1)} L${xAt(0).toFixed(1)},${(pad.t + innerH).toFixed(1)} Z`
  }

  const cur = active !== null ? data[active] : null

  // 浮层贴着边缘时不越过图表：左侧靠边左对齐，右侧靠边右对齐
  const tipPct = active !== null ? (xAt(active) / w) * 100 : 0
  const tipShift = tipPct <= 25 ? '0%' : tipPct >= 75 ? '-100%' : '-50%'

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${w} ${height}`}
        width="100%"
        height={height}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setActive(null)}
        onTouchEnd={() => setActive(null)}
      >
        <defs>
          <linearGradient id="gexp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="ginc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--positive)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--positive)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line
            key={g}
            x1={pad.l}
            x2={w - pad.r}
            y1={pad.t + innerH - g * innerH}
            y2={pad.t + innerH - g * innerH}
            stroke="var(--line)"
            strokeDasharray="3 4"
          />
        ))}
        <path d={area('income')} fill="url(#ginc)" />
        <path d={area('expense')} fill="url(#gexp)" />
        <path d={line('income')} fill="none" stroke="var(--positive)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />
        <path d={line('expense')} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />

        {data.map((d, i) => (
          <g key={i}>
            <rect
              x={xAt(i) - innerW / (data.length * 2 || 1)}
              y={pad.t}
              width={innerW / (data.length || 1)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setActive(i)}
              onTouchStart={() => setActive(i)}
            />
            {active === i && (
              <>
                <line
                  x1={xAt(i)}
                  x2={xAt(i)}
                  y1={pad.t}
                  y2={pad.t + innerH}
                  stroke="var(--line-strong)"
                  strokeDasharray="3 3"
                />
                <circle cx={xAt(i)} cy={yAt(d.expense)} r="3.6" fill="var(--accent)" stroke="var(--surface)" strokeWidth="1.6" />
                <circle cx={xAt(i)} cy={yAt(d.income)} r="3.2" fill="var(--positive)" stroke="var(--surface)" strokeWidth="1.4" />
              </>
            )}
            {(data.length <= 7 || i % Math.ceil(data.length / 7) === 0) && (
              <text
                x={xAt(i)}
                y={height - 5}
                fontSize="9.5"
                textAnchor="middle"
                fill="var(--text-3)"
              >
                {d.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      {cur && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: `${tipPct.toFixed(1)}%`,
            transform: `translateX(${tipShift})`,
            maxWidth: 'calc(100% - 8px)',
            background: 'var(--text)',
            color: 'var(--bg)',
            padding: '5px 9px',
            borderRadius: 9,
            fontSize: 11,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          {cur.label} · 支出 ¥{money(cur.expense)} · 收入 ¥{money(cur.income)}
        </div>
      )}
    </div>
  )
}
