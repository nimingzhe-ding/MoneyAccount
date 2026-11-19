import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import dayjs from 'dayjs'
import { getSetting, setSetting } from '../db'
import { useApp } from '../lib/store'
import { formatMonth, money, moneySigned, percent, weekdayLabel } from '../lib/format'
import { useDragReorder } from '../lib/dragReorder'
import Donut from '../components/Donut'
import TrendChart from '../components/TrendChart'
import Heatmap from '../components/Heatmap'
import MonthCalendar from '../components/MonthCalendar'
import TransactionRow from '../components/TransactionRow'
import Sheet from '../components/Sheet'
import { IconChevronLeft, IconChevronRight, IconEdit } from '../components/Icons'

type View = 'expense' | 'income'

/** 统计页可开关 / 拖动排序的模块；这里是默认顺序 */
const STATS_MODULES = [
  { id: 'summary', label: '本月结余' },
  { id: 'trend', label: '收支趋势' },
  { id: 'calendar', label: '记账日历' },
  { id: 'heatmap', label: '记账打卡' },
  { id: 'daily', label: '每日支出' },
  { id: 'donut', label: '收支构成' },
] as const

type ModuleMeta = (typeof STATS_MODULES)[number]
const ALL_IDS = STATS_MODULES.map((m) => m.id)

function GripIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="6" cy="3" r="1.3" />
      <circle cx="10" cy="3" r="1.3" />
      <circle cx="6" cy="8" r="1.3" />
      <circle cx="10" cy="8" r="1.3" />
      <circle cx="6" cy="13" r="1.3" />
      <circle cx="10" cy="13" r="1.3" />
    </svg>
  )
}

export default function StatsPage({ navigate }: { navigate: (to: string) => void }) {
  const { transactions, catMap } = useApp()
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'))
  const [view, setView] = useState<View>('expense')
  const [trendMode, setTrendMode] = useState<'6m' | '30d'>('6m')
  const [picked, setPicked] = useState<string | null>(null)

  const [order, setOrder] = useState<string[]>([...ALL_IDS])
  const [hidden, setHidden] = useState<string[]>([])
  const [editing, setEditing] = useState(false)

  // 设置只存在本机；order 是全部模块的顺序（隐藏的也留在里面），hidden 是被关掉的模块
  useEffect(() => {
    Promise.all([
      getSetting<string[]>('stats.order', []),
      getSetting<string[]>('stats.hidden', []),
    ]).then(([savedOrder, savedHidden]) => {
      const known = new Set<string>(ALL_IDS)
      const saved = savedOrder.filter((id) => known.has(id))
      const hiddenNext = savedHidden.filter((id) => known.has(id))
      // 新版本新增的模块没有被保存过，默认追加到末尾
      setOrder([...saved, ...ALL_IDS.filter((id) => !saved.includes(id))])
      setHidden(hiddenNext)
    })
  }, [])

  const { order: dragOrder, dragId, onPointerDown, wasDragging } = useDragReorder({
    ids: order,
    onCommit: (next) => {
      setOrder(next)
      void setSetting('stats.order', next)
    },
  })

  const isCurrent = month === dayjs().format('YYYY-MM')

  const monthTx = useMemo(
    () => transactions.filter((t) => t.date.startsWith(month)),
    [transactions, month],
  )

  const total = useMemo(() => {
    let exp = 0
    let inc = 0
    monthTx.forEach((t) => {
      if (t.type === 'expense') exp += t.amount
      if (t.type === 'income') inc += t.amount
    })
    return { exp, inc, net: inc - exp }
  }, [monthTx])

  const byCat = useMemo(() => {
    const map = new Map<string, number>()
    monthTx
      .filter((t) => t.type === view)
      .forEach((t) => map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount))
    const arr = [...map.entries()]
      .map(([id, v]) => ({
        id,
        value: v,
        label: catMap.get(id)?.name ?? '未分类',
        color: catMap.get(id)?.color ?? '#9A938C',
        icon: catMap.get(id)?.icon ?? '📦',
      }))
      .sort((a, b) => b.value - a.value)
    return arr
  }, [monthTx, view, catMap])

  const viewTotal = byCat.reduce((s, c) => s + c.value, 0)

  const trend = useMemo(() => {
    if (trendMode === '6m') {
      const out = []
      for (let i = 5; i >= 0; i--) {
        const m = dayjs(month + '-01').subtract(i, 'month')
        const key = m.format('YYYY-MM')
        let exp = 0
        let inc = 0
        transactions.forEach((t) => {
          if (!t.date.startsWith(key)) return
          if (t.type === 'expense') exp += t.amount
          if (t.type === 'income') inc += t.amount
        })
        out.push({ label: m.format('M月'), expense: exp, income: inc })
      }
      return out
    }
    const out: { label: string; expense: number; income: number }[] = []
    const dim = dayjs(month + '-01').daysInMonth()
    const chunk = 3
    for (let start = 1; start <= dim; start += chunk) {
      const end = Math.min(dim, start + chunk - 1)
      let exp = 0
      let inc = 0
      monthTx.forEach((t) => {
        const d = Number(t.date.slice(8))
        if (d >= start && d <= end) {
          if (t.type === 'expense') exp += t.amount
          if (t.type === 'income') inc += t.amount
        }
      })
      out.push({ label: `${start}`, expense: exp, income: inc })
    }
    return out
  }, [transactions, monthTx, month, trendMode])

  const avgDaily = Math.round(total.exp / dayjs(month + '-01').daysInMonth())

  // 每日支出柱状
  const dailyBars = useMemo(() => {
    const dim = dayjs(month + '-01').daysInMonth()
    const arr = new Array(dim).fill(0) as number[]
    monthTx.forEach((t) => {
      if (t.type !== 'expense') return
      arr[Number(t.date.slice(8)) - 1] += t.amount
    })
    return arr
  }, [monthTx, month])
  const dailyMax = Math.max(1, ...dailyBars)

  const shiftMonth = (d: number) => {
    setMonth(dayjs(month + '-01').add(d, 'month').format('YYYY-MM'))
    setPicked(null)
  }

  // 本月有几天记过账，写在日历标题右边
  const activeDays = useMemo(() => {
    const seen = new Set<string>()
    monthTx.forEach((t) => seen.add(t.date))
    return seen.size
  }, [monthTx])

  const pickedTx = useMemo(() => {
    if (!picked) return []
    return monthTx
      .filter((t) => t.date === picked)
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [monthTx, picked])

  // ---------------------------------------------------------------- 编辑布局

  const isHidden = (id: string) => hidden.includes(id)

  const toggleModule = (id: string) => {
    setHidden((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      void setSetting('stats.hidden', next)
      return next
    })
  }

  const resetModules = () => {
    setOrder([...ALL_IDS])
    setHidden([])
    void setSetting('stats.order', [...ALL_IDS])
    void setSetting('stats.hidden', [])
  }

  const visibleModules = dragOrder
    .filter((id) => !isHidden(id))
    .map((id) => STATS_MODULES.find((m) => m.id === id))
    .filter((m): m is ModuleMeta => !!m)

  // 每个模块的内容；顺序由上面的 dragOrder 决定
  const modules: Record<string, ReactNode> = {
    summary: (
      <div className="card stat-hero">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="m">本月结余</span>
          <span className="tag mute">日均支出 ¥{money(avgDaily)}</span>
        </div>
        <div className="big" style={{ color: total.net >= 0 ? 'var(--text)' : 'var(--negative)' }}>
          {moneySigned(total.net)}
        </div>
        <div className="legend">
          <span>
            <span className="dot" style={{ background: 'var(--accent)' }} />
            支出 ¥{money(total.exp)}
          </span>
          <span>
            <span className="dot" style={{ background: 'var(--positive)' }} />
            收入 ¥{money(total.inc)}
          </span>
        </div>
      </div>
    ),
    trend: (
      <section className="section">
        <div className="section-head">
          <h2>收支趋势</h2>
          <div className="segmented" style={{ transform: 'scale(0.86)', transformOrigin: 'right' }}>
            <button className={trendMode === '6m' ? 'active' : ''} onClick={() => setTrendMode('6m')}>
              近6月
            </button>
            <button className={trendMode === '30d' ? 'active' : ''} onClick={() => setTrendMode('30d')}>
              本月
            </button>
          </div>
        </div>
        <div className="card card-pad" style={{ padding: '12px 8px 6px' }}>
          <TrendChart data={trend} height={142} />
        </div>
      </section>
    ),
    calendar: (
      <section className="section">
        <div className="section-head">
          <h2>记账日历</h2>
          <span className="more">{activeDays} 天有记录</span>
        </div>
        <MonthCalendar
          month={month}
          transactions={transactions}
          picked={picked}
          onPick={(d) => setPicked(picked === d ? null : d)}
        />

        {picked && (
          <div className="card" style={{ marginTop: 10 }}>
            <div className="cal-picked-head">
              <span>
                {dayjs(picked).format('M月D日')} {weekdayLabel(picked)}
              </span>
              <span className="more">{pickedTx.length} 笔</span>
            </div>
            {pickedTx.length === 0 ? (
              <div className="cal-picked-empty">这天没有记账</div>
            ) : (
              pickedTx.map((t) => <TransactionRow key={t.id} tx={t} />)
            )}
          </div>
        )}
      </section>
    ),
    heatmap: (
      <section className="section">
        <div className="section-head">
          <h2>记账打卡</h2>
          <span className="more">近 19 周</span>
        </div>
        <div className="card card-pad">
          <Heatmap transactions={transactions} />
        </div>
      </section>
    ),
    daily: (
      <section className="section">
        <div className="section-head">
          <h2>每日支出</h2>
          <span className="more">最高 ¥{money(dailyMax)}</span>
        </div>
        <div className="card card-pad" style={{ padding: '14px 12px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 74 }}>
            {dailyBars.map((v, i) => (
              <div
                key={i}
                title={`${i + 1}日 ¥${money(v)}`}
                style={{
                  flex: 1,
                  height: Math.max(2, (v / dailyMax) * 100) + '%',
                  borderRadius: 3,
                  background:
                    v > 0
                      ? 'linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 72%, #7a3d12))'
                      : 'var(--surface-3)',
                  opacity: v > 0 ? 1 : 0.5,
                  transition: 'height .4s',
                }}
              />
            ))}
          </div>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 10, color: 'var(--text-3)', marginTop: 6 }}>
            <span>1日</span>
            <span>{Math.round(dailyBars.length / 2)}日</span>
            <span>{dailyBars.length}日</span>
          </div>
        </div>
      </section>
    ),
    donut: (
      <section className="section">
        <div className="section-head">
          <h2>{view === 'expense' ? '支出' : '收入'}构成</h2>
          <div className="segmented" style={{ transform: 'scale(0.86)', transformOrigin: 'right' }}>
            <button className={view === 'expense' ? 'active' : ''} onClick={() => setView('expense')}>
              支出
            </button>
            <button className={view === 'income' ? 'active' : ''} onClick={() => setView('income')}>
              收入
            </button>
          </div>
        </div>

        {byCat.length === 0 ? (
          <div className="card empty">
            <span className="em">📊</span>
            <div className="t">本月还没有{view === 'expense' ? '支出' : '收入'}记录</div>
          </div>
        ) : (
          <div className="card card-pad">
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Donut slices={byCat.slice(0, 8)} size={168} thickness={19}>
                <div className="k">{view === 'expense' ? '总支出' : '总收入'}</div>
                <div className="v">¥{money(viewTotal)}</div>
              </Donut>
            </div>
            <div style={{ marginTop: 12 }}>
              {byCat.slice(0, 8).map((c) => (
                <button
                  key={c.id}
                  className="bar-row"
                  style={{ width: '100%', textAlign: 'left' }}
                  onClick={() => navigate(`/list`)}
                >
                  <span className="nm">
                    <span>{c.icon}</span>
                    {c.label}
                  </span>
                  <span className="bar-track">
                    <span
                      className="bar-fill"
                      style={{
                        width: `${percent(c.value, byCat[0].value)}%`,
                        background: c.color,
                        display: 'block',
                      }}
                    />
                  </span>
                  <span className="amt">¥{money(c.value)}</span>
                  <span className="pct">{((c.value / viewTotal) * 100).toFixed(0)}%</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    ),
  }

  return (
    <div className="page stats-page">
      <header className="topbar">
        <div>
          <h1>统计</h1>
          <div className="sub">{formatMonth(month)} 概览</div>
        </div>
        <div className="row" style={{ gap: 4, alignItems: 'center' }}>
          <button className="icon-btn" onClick={() => setEditing(true)} aria-label="编辑统计页">
            <IconEdit size={17} />
          </button>
          <div className="month-switch">
            <button onClick={() => shiftMonth(-1)}>
              <IconChevronLeft size={17} />
            </button>
            <span className="m">{formatMonth(month)}</span>
            <button onClick={() => shiftMonth(1)} disabled={isCurrent} style={{ opacity: isCurrent ? 0.25 : 1 }}>
              <IconChevronRight size={17} />
            </button>
          </div>
        </div>
      </header>

      {visibleModules.map((m) => (
        <Fragment key={m.id}>{modules[m.id]}</Fragment>
      ))}

      {visibleModules.length === 0 && (
        <div className="card empty" style={{ marginTop: 14 }}>
          <div className="t">统计页的组件都被隐藏了</div>
          <div className="s">点右上角的编辑图标重新打开</div>
        </div>
      )}

      {editing && (
        <Sheet title="编辑统计页" onClose={() => setEditing(false)}>
          <div className="card" style={{ overflow: 'hidden' }}>
            {dragOrder.map((id, i) => {
              const m = STATS_MODULES.find((x) => x.id === id)
              if (!m) return null
              const on = !isHidden(id)
              return (
                <button
                  key={id}
                  className={'list-row' + (dragId === id ? ' dragging' : '')}
                  data-drag-id={id}
                  style={{ borderTop: i === 0 ? 'none' : undefined }}
                  onClick={() => {
                    if (!wasDragging()) toggleModule(id)
                  }}
                >
                  <span
                    className="drag-handle"
                    onPointerDown={(e) => onPointerDown(id, e)}
                    aria-hidden
                  >
                    <GripIcon />
                  </span>
                  <span className="lbl" style={{ opacity: on ? 1 : 0.45 }}>
                    {m.label}
                  </span>
                  <span className={'switch' + (on ? ' on' : '')} aria-hidden />
                </button>
              )
            })}
          </div>
          <button className="btn btn-ghost btn-block" style={{ marginTop: 12 }} onClick={resetModules}>
            恢复默认
          </button>
        </Sheet>
      )}

      <div style={{ height: 8 }} />
    </div>
  )
}
