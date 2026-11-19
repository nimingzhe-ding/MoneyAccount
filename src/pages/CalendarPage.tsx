import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { useApp } from '../lib/store'
import { formatMonth, money, weekdayLabel } from '../lib/format'
import MonthCalendar from '../components/MonthCalendar'
import TransactionRow from '../components/TransactionRow'
import { IconChevronLeft, IconChevronRight } from '../components/Icons'
import { AppIcon } from '../lib/appIcons'

/**
 * 记账日历：一月一屏，每格写当天的支出/收入，点开看那天的明细。
 * 排版按中文日历的惯例：周日排在第一列，格子里公历在上、农历在下。
 */
export default function CalendarPage({ back }: { back: () => void }) {
  const { transactions } = useApp()
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'))
  const [picked, setPicked] = useState<string | null>(null)

  const isCurrent = month === dayjs().format('YYYY-MM')

  const summary = useMemo(() => {
    let expense = 0
    let income = 0
    let days = 0
    const seen = new Set<string>()
    for (const t of transactions) {
      if (!t.date.startsWith(month)) continue
      if (t.type === 'expense') expense += t.amount
      if (t.type === 'income') income += t.amount
      if (!seen.has(t.date)) {
        seen.add(t.date)
        days += 1
      }
    }
    return { expense, income, days }
  }, [transactions, month])

  const pickedTx = useMemo(() => {
    if (!picked) return []
    return transactions
      .filter((t) => t.date === picked)
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [transactions, picked])

  const shift = (n: number) => {
    setMonth(dayjs(month + '-01').add(n, 'month').format('YYYY-MM'))
    setPicked(null)
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="row" style={{ gap: 4 }}>
          <button className="back-btn" onClick={back}>
            <IconChevronLeft size={18} />
          </button>
          <div>
            <h1>日历</h1>
            <div className="sub">
              {summary.days} 天有记录 · 支出 ¥{money(summary.expense)}
            </div>
          </div>
        </div>
        <div className="month-switch">
          <button onClick={() => shift(-1)}>
            <IconChevronLeft size={17} />
          </button>
          <span className="m">{formatMonth(month)}</span>
          <button onClick={() => shift(1)} disabled={isCurrent} style={{ opacity: isCurrent ? 0.25 : 1 }}>
            <IconChevronRight size={17} />
          </button>
        </div>
      </header>

      <MonthCalendar
        month={month}
        transactions={transactions}
        picked={picked}
        onPick={(d) => setPicked(picked === d ? null : d)}
      />

      {picked && (
        <section className="section">
          <div className="section-head">
            <h2>
              {dayjs(picked).format('M月D日')} {weekdayLabel(picked)}
            </h2>
            <span className="more">{pickedTx.length} 笔</span>
          </div>
          <div className="card">
            {pickedTx.length === 0 ? (
              <div className="empty" style={{ padding: '26px 16px' }}>
                <span className="em">
                  <AppIcon name="calendar" size={30} />
                </span>
                <div className="t">这天没有记账</div>
              </div>
            ) : (
              pickedTx.map((t) => <TransactionRow key={t.id} tx={t} />)
            )}
          </div>
        </section>
      )}

      {!picked && (
        <div className="card empty" style={{ marginTop: 14, padding: '22px 16px' }}>
          <span className="em">
            <AppIcon name="calendar" size={30} />
          </span>
          <div className="t">点某一天</div>
          <div className="s">看看那天记了几笔、花了多少</div>
        </div>
      )}

      <div style={{ height: 8 }} />
    </div>
  )
}
