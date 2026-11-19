import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { db } from '../db'
import { useApp } from '../lib/store'
import { formatMonth, money, moneySigned, percent } from '../lib/format'
import Sheet from '../components/Sheet'
import {
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconPlus,
} from '../components/Icons'
import { AppIcon } from '../lib/appIcons'

export default function BudgetPage({ back }: { back: () => void }) {
  const { budgets, transactions, categories, catMap, toast } = useApp()
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'))
  const [editing, setEditing] = useState<{ categoryId: string; amount: number } | null>(null)
  const [draft, setDraft] = useState('')
  const [pickCat, setPickCat] = useState(false)

  const isCurrent = month === dayjs().format('YYYY-MM')

  const monthTx = useMemo(
    () => transactions.filter((t) => t.date.startsWith(month) && t.type === 'expense'),
    [transactions, month],
  )

  const totalExpense = monthTx.reduce((s, t) => s + t.amount, 0)

  const monthBudgets = useMemo(
    () => budgets.filter((b) => b.month === month),
    [budgets, month],
  )
  const totalBudget = monthBudgets.find((b) => b.categoryId === 'total')?.amount ?? 0

  const catSpend = useMemo(() => {
    const m = new Map<string, number>()
    monthTx.forEach((t) => m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + t.amount))
    return m
  }, [monthTx])

  const catBudgets = monthBudgets
    .filter((b) => b.categoryId !== 'total')
    .map((b) => ({
      ...b,
      cat: catMap.get(b.categoryId),
      spent: catSpend.get(b.categoryId) ?? 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  const catBudgetSum = catBudgets.reduce((s, b) => s + b.amount, 0)
  // 分类预算之和超过总预算时是负数——这比显示 0 更能说明「分超了」
  const unbudgeted = totalBudget > 0 ? totalBudget - catBudgetSum : 0

  const saveBudget = async (categoryId: string, amountFen: number) => {
    const id = `${month}::${categoryId}`
    if (amountFen <= 0) {
      await db.budgets.delete(id)
    } else {
      await db.budgets.put({ id, month, categoryId, amount: amountFen })
    }
    toast('预算已保存')
  }

  const openEdit = (categoryId: string) => {
    const cur = monthBudgets.find((b) => b.categoryId === categoryId)?.amount ?? 0
    setEditing({ categoryId, amount: cur })
    setDraft(cur ? (cur / 100).toString() : '')
  }

  const commitEdit = async () => {
    if (!editing) return
    await saveBudget(editing.categoryId, Math.round(Number(draft || 0) * 100))
    setEditing(null)
  }

  const availableCats = categories.filter(
    (c) => c.type === 'expense' && !catBudgets.some((b) => b.categoryId === c.id),
  )

  // 本月剩余天数
  const dim = dayjs(month + '-01').daysInMonth()
  const passed = isCurrent ? dayjs().date() : dim
  const left = Math.max(0, totalBudget - totalExpense)
  const overspent = totalBudget > 0 && totalExpense > totalBudget
  const perDayLeft = isCurrent ? Math.round(left / Math.max(1, dim - passed + 1)) : 0

  return (
    <div className="page">
      <header className="topbar">
        <div className="row" style={{ gap: 4 }}>
          <button className="back-btn" onClick={back}>
            <IconChevronLeft size={18} />
          </button>
          <h1>预算</h1>
        </div>
        <div className="month-switch">
          <button onClick={() => setMonth(dayjs(month + '-01').subtract(1, 'month').format('YYYY-MM'))}>
            <IconChevronLeft size={17} />
          </button>
          <span className="m">{formatMonth(month)}</span>
          <button
            onClick={() => setMonth(dayjs(month + '-01').add(1, 'month').format('YYYY-MM'))}
            disabled={isCurrent}
            style={{ opacity: isCurrent ? 0.25 : 1 }}
          >
            <IconChevronRight size={17} />
          </button>
        </div>
      </header>

      <div className="card budget-card">
        <div className="top">
          <span>总预算</span>
          <button
            className="row"
            style={{ color: 'var(--accent-text)', fontSize: 13 }}
            onClick={() => openEdit('total')}
          >
            设置
          </button>
        </div>
        <div className="main">
          <span className="big" style={overspent ? { color: 'var(--negative)' } : undefined}>
            {totalBudget === 0
              ? '—'
              : overspent
                ? `超支 ${moneySigned(totalExpense - totalBudget)}`
                : `${moneySigned(left)}`}
          </span>
          <span className="small">
            {totalBudget > 0
              ? overspent
                ? `预算 ¥${money(totalBudget)} 已用完`
                : `/ ¥${money(totalBudget)} 剩余`
              : '还没有设置预算'}
          </span>
        </div>
        <div className="progress">
          <div
            style={{
              width: `${totalBudget > 0 ? percent(totalExpense, totalBudget) : 0}%`,
              background: overspent
                ? 'linear-gradient(90deg, color-mix(in srgb, var(--negative) 70%, #f5b39c), var(--negative))'
                : 'linear-gradient(90deg, color-mix(in srgb, var(--accent) 62%, #f7d9a8), var(--accent))',
            }}
          />
        </div>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 8, fontSize: 11.5, color: 'var(--text-3)' }}>
          <span>已花 ¥{money(totalExpense)}</span>
          {totalBudget > 0 && isCurrent && !overspent && (
            <span>日均可用 ¥{money(perDayLeft)}</span>
          )}
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>分类预算</h2>
          <button
            className="more"
            onClick={() => setPickCat(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
          >
            <IconPlus size={13} /> 添加
          </button>
        </div>

        {catBudgets.length === 0 ? (
          <div className="card empty">
            <span className="em">
              <AppIcon name="target" size={30} />
            </span>
            <div className="t">还没有分类预算</div>
            <div className="s">给最容易超支的分类设个上限</div>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            {catBudgets.map((b, i) => {
              const p = percent(b.spent, b.amount)
              const over = b.spent > b.amount
              return (
                <button
                  key={b.id}
                  onClick={() => openEdit(b.categoryId)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '13px 15px',
                    display: 'block',
                    borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                  }}
                >
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="row" style={{ gap: 7, fontSize: 14 }}>
                      <AppIcon name={b.cat?.icon ?? 'package'} size={16} color={b.cat?.color} />
                      {b.cat?.name ?? '已删除分类'}
                    </span>
                    <span className="row" style={{ gap: 6 }}>
                      <span className="big-num" style={{ fontSize: 13 }}>
                        ¥{money(b.spent)}
                        <span style={{ color: 'var(--text-3)' }}>
                          {' '}
                          / ¥{money(b.amount)}
                        </span>
                      </span>
                      {over && <span className="tag warn">超支</span>}
                      {!over && p > 80 && <span className="tag warn">接近</span>}
                    </span>
                  </div>
                  <div className="progress" style={{ height: 6, marginTop: 7 }}>
                    <div
                      style={{
                        width: `${p}%`,
                        background: over ? 'var(--negative)' : (b.cat?.color ?? 'var(--gold)'),
                      }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {totalBudget > 0 && catBudgets.length > 0 && (
          <div
            className="row small"
            style={{ justifyContent: 'space-between', padding: '10px 4px 0', color: 'var(--text-3)' }}
          >
            <span>分类预算合计 ¥{money(catBudgetSum)}</span>
            <span>未分配 {moneySigned(unbudgeted)}</span>
          </div>
        )}
      </section>

      {editing && (
        <Sheet
          title={editing.categoryId === 'total' ? '设置总预算' : '设置分类预算'}
          onClose={() => setEditing(null)}
          right={
            editing.categoryId !== 'total' ? (
              <button
                className="icon-btn"
                onClick={async () => {
                  await db.budgets.delete(editing.categoryId === 'total' ? `${month}::total` : `${month}::${editing.categoryId}`)
                  setEditing(null)
                  toast('已删除该预算')
                }}
              >
                <IconClose size={16} />
              </button>
            ) : undefined
          }
        >
          <div className="field">
            <span className="lbl">金额</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
            <span className="muted">元</span>
          </div>
          <div className="pill-row" style={{ marginTop: 4 }}>
            {[500, 1000, 2000, 3000, 5000].map((v) => (
              <button key={v} className="pill" onClick={() => setDraft(String(v))}>
                ¥{v}
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={commitEdit}>
            保存
          </button>
        </Sheet>
      )}

      {pickCat && (
        <Sheet title="选择分类" onClose={() => setPickCat(false)}>
          <div className="cat-grid" style={{ padding: 0 }}>
            {availableCats.map((c) => (
              <button
                key={c.id}
                className="cat-cell"
                onClick={() => {
                  setPickCat(false)
                  openEdit(c.id)
                }}
              >
                <span className="box" style={{ background: c.color + '1a' }}>
                  <AppIcon name={c.icon} size={19} color={c.color} />
                </span>
                <span className="nm">{c.name}</span>
              </button>
            ))}
            {availableCats.length === 0 && (
              <div className="empty" style={{ gridColumn: '1 / -1' }}>
                <div className="t">所有支出分类都已设置预算</div>
              </div>
            )}
          </div>
        </Sheet>
      )}
    </div>
  )
}
