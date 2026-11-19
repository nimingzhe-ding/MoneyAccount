import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { useApp } from '../lib/store'
import {
  formatDateLabel,
  formatMonth,
  greeting,
  money,
  moneySigned,
  percent,
  splitMoney,
  weekdayLabel,
} from '../lib/format'
import TransactionRow from '../components/TransactionRow'
import UpdateBanner from '../components/UpdateBanner'
import { IconChevronLeft, IconChevronRight } from '../components/Icons'
import { AppIcon } from '../lib/appIcons'
import type { Transaction } from '../db/types'

export default function HomePage({ navigate }: { navigate: (to: string) => void }) {
  const { transactions, budgets, accounts, accountBalances } = useApp()
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'))

  const stats = useMemo(() => {
    let expense = 0
    let income = 0
    let count = 0
    for (const t of transactions) {
      if (!t.date.startsWith(month)) continue
      if (t.type === 'expense') {
        expense += t.amount
        count++
      } else if (t.type === 'income') {
        income += t.amount
        count++
      }
    }
    return { expense, income, balance: income - expense, count }
  }, [transactions, month])

  const totalBudget =
    budgets.find((b) => b.month === month && b.categoryId === 'total')?.amount ?? 0

  const byDate = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const t of transactions) {
      if (!map.has(t.date)) map.set(t.date, [])
      map.get(t.date)!.push(t)
    }
    for (const list of map.values()) {
      list.sort((a, b) => b.createdAt - a.createdAt)
    }
    return map
  }, [transactions])

  const today = dayjs().format('YYYY-MM-DD')
  const todayList = byDate.get(today) ?? []
  const recent = useMemo(() => {
    return [...transactions]
      .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
      .filter((t) => t.date !== today)
      .slice(0, 6)
  }, [transactions, today])

  const isCurrent = month === dayjs().format('YYYY-MM')
  const daysPassed = isCurrent ? dayjs().date() : dayjs(month + '-01').daysInMonth()
  const dailyAvg = Math.round(stats.expense / Math.max(1, daysPassed))
  const budgetLeft = totalBudget - stats.expense
  const heroMoney = splitMoney(stats.expense)

  // 两个主入口：手动记一笔、说一句话让它记。其余是常用分类的快捷方式。
  const entries = [
    {
      key: 'add',
      icon: 'notebook-pen',
      title: '记一笔',
      sub: '自己填金额分类',
      go: () => navigate('/add'),
    },
    {
      key: 'chat',
      icon: 'message-circle',
      title: '对话记账',
      sub: '说一句话就记上',
      go: () => navigate('/chat'),
    },
  ]

  const shortcuts = [
    { icon: 'utensils', label: '餐饮', go: () => navigate('/add?cat=c_food') },
    { icon: 'train-front', label: '交通', go: () => navigate('/add?cat=c_transport') },
    { icon: 'shopping-bag', label: '购物', go: () => navigate('/add?cat=c_shopping') },
    { icon: 'piggy-bank', label: '预算', go: () => navigate('/budget') },
  ]

  const shiftMonth = (delta: number) =>
    setMonth(dayjs(month + '-01').add(delta, 'month').format('YYYY-MM'))

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <div className="sub">
            {greeting()} · {dayjs().format('M月D日')} {weekdayLabel(today)}
          </div>
          <h1>随手记</h1>
        </div>
        <div className="month-switch">
          <button onClick={() => shiftMonth(-1)} aria-label="上个月">
            <IconChevronLeft size={17} />
          </button>
          <button
            className="m m-link"
            onClick={() => navigate('/calendar')}
            aria-label="打开记账日历"
          >
            {formatMonth(month)}
          </button>
          <button
            onClick={() => shiftMonth(1)}
            disabled={isCurrent}
            style={{ opacity: isCurrent ? 0.25 : 1 }}
            aria-label="下个月"
          >
            <IconChevronRight size={17} />
          </button>
        </div>
      </header>

      <UpdateBanner />

      <section className="hero">
        <div className="hero-label">
          {formatMonth(month)} 支出
        </div>
        <div className="hero-balance">
          <span className="cur">¥</span>
          {heroMoney.int}
          <span className="dec">{heroMoney.dec}</span>
        </div>
        <div className="hero-sub">
          共 {stats.count} 笔 · 日均 ¥{money(dailyAvg)}
        </div>

        <div className="hero-strip">
          <div className="hero-stat">
            <div className="k">
              <span className="dot" style={{ background: 'var(--positive)' }} />
              收入
            </div>
            <div className="v">¥{money(stats.income)}</div>
          </div>
          <div className="hero-stat">
            <div className="k">
              <span className="dot" style={{ background: 'var(--accent)' }} />
              结余
            </div>
            <div
              className="v"
              style={{ color: stats.balance >= 0 ? 'var(--positive)' : 'var(--negative)' }}
            >
              {moneySigned(stats.balance)}
            </div>
          </div>
        </div>

        {totalBudget > 0 && (
          <div className="budget-line">
            <div className="row">
              <span>
                月预算 ¥{money(totalBudget)}
              </span>
              <span>
                {budgetLeft >= 0
                  ? `剩 ${moneySigned(budgetLeft)}`
                  : `超支 ${moneySigned(-budgetLeft)}`}
              </span>
            </div>
            <div className="budget-track">
              <div
                className={'budget-fill' + (budgetLeft < 0 ? ' over' : '')}
                style={{ width: `${percent(stats.expense, totalBudget)}%` }}
              />
            </div>
          </div>
        )}
      </section>

      <section className="section" style={{ marginTop: 18 }}>
        <div className="section-head">
          <h2>账户</h2>
          <button className="more" onClick={() => navigate('/accounts')}>
            管理
          </button>
        </div>
        <div className="acc-strip">
          {accounts.map((a) => (
            <button
              key={a.id}
              className="acc-mini"
              onClick={() => navigate('/accounts')}
            >
              <span
                className="cat-icon"
                style={{ background: a.color + '1f', width: 30, height: 30, borderRadius: 10 }}
              >
                <AppIcon name={a.icon} size={16} color={a.color} />
              </span>
              <span className="n">{a.name}</span>
              <span
                className="v num"
                style={{ color: (accountBalances.get(a.id) ?? 0) < 0 ? 'var(--negative)' : undefined }}
              >
                {moneySigned(accountBalances.get(a.id) ?? 0)}
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="entries">
        {entries.map((e) => (
          <button key={e.key} className={'entry entry-' + e.key} onClick={e.go}>
            <span className="em" aria-hidden>
              <AppIcon name={e.icon} size={22} />
            </span>
            <span className="txt">
              <span className="t">{e.title}</span>
              <span className="s">{e.sub}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="shortcuts">
        {shortcuts.map((s) => (
          <button key={s.label} className="shortcut" onClick={s.go}>
            <span className="em">
              <AppIcon name={s.icon} size={20} />
            </span>
            {s.label}
          </button>
        ))}
      </div>

      <section className="section" style={{ marginTop: 22 }}>
        <div className="section-head">
          <h2>今天</h2>
          <button className="more" onClick={() => navigate('/list')}>
            全部明细
          </button>
        </div>
        {todayList.length === 0 ? (
          <div className="card empty">
            <span className="em">
              <AppIcon name="coffee" size={30} />
            </span>
            <div className="t">今天还没有记账</div>
            <div className="s">点右下角的 + 记一笔</div>
          </div>
        ) : (
          <div className="tx-group">
            <div className="tx-group-head">
              <span>
                {formatDateLabel(today)} · {todayList.length} 笔
              </span>
              <span className="amt">
                支出 ¥
                {money(
                  todayList
                    .filter((t) => t.type === 'expense')
                    .reduce((s, t) => s + t.amount, 0),
                )}
              </span>
            </div>
            {todayList.map((t) => (
              <TransactionRow
                key={t.id}
                tx={t}
                onClick={() => navigate(`/add?id=${t.id}`)}
              />
            ))}
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>最近记录</h2>
            <button className="more" onClick={() => navigate('/list')}>
              查看全部
            </button>
          </div>
          <div className="tx-group">
            {recent.map((t) => (
              <TransactionRow
                key={t.id}
                tx={t}
                onClick={() => navigate(`/add?id=${t.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      <div style={{ height: 8 }} />
    </div>
  )
}
