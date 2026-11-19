import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { db } from '../db'
import { useApp } from '../lib/store'
import { formatDateLabel, formatMonth, money, weekdayLabel } from '../lib/format'
import TransactionRow from '../components/TransactionRow'
import Sheet from '../components/Sheet'
import {
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconSearch,
} from '../components/Icons'
import { AppIcon } from '../lib/appIcons'
import type { Transaction, TxType } from '../db/types'

type Filter = 'all' | TxType

export default function TransactionsPage({
  navigate,
}: {
  navigate: (to: string) => void
}) {
  const { transactions, categories, accounts, catMap, toast } = useApp()
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'))
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [searching, setSearching] = useState(false)
  const [filterSheet, setFilterSheet] = useState(false)
  const [catFilter, setCatFilter] = useState<string | null>(null)
  const [accFilter, setAccFilter] = useState<string | null>(null)
  const [minAmt, setMinAmt] = useState('')
  const [maxAmt, setMaxAmt] = useState('')
  const [deleting, setDeleting] = useState<Transaction | null>(null)

  const isCurrent = month === dayjs().format('YYYY-MM')

  const list = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return transactions
      .filter((t) => {
        if (!t.date.startsWith(month)) return false
        if (filter !== 'all' && t.type !== filter) return false
        if (catFilter && t.categoryId !== catFilter) return false
        if (accFilter && t.accountId !== accFilter) return false
        if (minAmt && t.amount < Math.round(Number(minAmt) * 100)) return false
        if (maxAmt && t.amount > Math.round(Number(maxAmt) * 100)) return false
        if (kw) {
          const cat = catMap.get(t.categoryId)?.name ?? ''
          if (
            !t.note?.toLowerCase().includes(kw) &&
            !cat.toLowerCase().includes(kw) &&
            !String(t.amount / 100).includes(kw)
          )
            return false
        }
        return true
      })
      .sort((a, b) =>
        a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
      )
  }, [transactions, month, filter, catFilter, accFilter, q, catMap, minAmt, maxAmt])

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const t of list) {
      if (!map.has(t.date)) map.set(t.date, [])
      map.get(t.date)!.push(t)
    }
    return [...map.entries()]
  }, [list])

  const summary = useMemo(() => {
    let expense = 0
    let income = 0
    list.forEach((t) => {
      if (t.type === 'expense') expense += t.amount
      if (t.type === 'income') income += t.amount
    })
    return { expense, income }
  }, [list])

  const activeFilters =
    (catFilter ? 1 : 0) + (accFilter ? 1 : 0) + (minAmt || maxAmt ? 1 : 0)

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>明细</h1>
          <div className="sub">
            共 {list.length} 笔
            {filter !== 'all' && ` · ${filter === 'expense' ? '支出' : filter === 'income' ? '收入' : '转账'}`}
          </div>
        </div>
        <div className="month-switch">
          <button
            onClick={() => setMonth(dayjs(month + '-01').subtract(1, 'month').format('YYYY-MM'))}
          >
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

      <div className="searchbar">
        <IconSearch />
        <input
          placeholder="搜索备注、分类或金额"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q && (
          <button onClick={() => setQ('')} style={{ color: 'var(--text-3)' }}>
            <IconClose size={15} />
          </button>
        )}
      </div>

      <div className="pill-row" style={{ marginTop: 10 }}>
        {(
          [
            ['all', '全部'],
            ['expense', '支出'],
            ['income', '收入'],
            ['transfer', '转账'],
          ] as [Filter, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            className={'pill' + (filter === k ? ' active' : '')}
            onClick={() => setFilter(k)}
          >
            {label}
          </button>
        ))}
        <button
          className={'pill' + (activeFilters ? ' active' : '')}
          onClick={() => setFilterSheet(true)}
        >
          {activeFilters ? `筛选 ${activeFilters}` : '筛选'}
        </button>
      </div>

      {(catFilter || accFilter || minAmt || maxAmt) && (
        <div className="row small" style={{ padding: '0 2px 8px', gap: 8, flexWrap: 'wrap' }}>
          {catFilter && (
            <button className="chip" onClick={() => setCatFilter(null)}>
              <AppIcon
                name={catMap.get(catFilter)?.icon ?? 'package'}
                size={13}
                color={catMap.get(catFilter)?.color}
              />
              {catMap.get(catFilter)?.name}
              <IconClose size={11} />
            </button>
          )}
          {accFilter && (
            <button className="chip" onClick={() => setAccFilter(null)}>
              {accounts.find((a) => a.id === accFilter)?.name}
              <IconClose size={11} />
            </button>
          )}
          {(minAmt || maxAmt) && (
            <button
              className="chip"
              onClick={() => {
                setMinAmt('')
                setMaxAmt('')
              }}
            >
              ¥{minAmt || '0'} ~ {maxAmt ? `¥${maxAmt}` : '不限'}
              <IconClose size={11} />
            </button>
          )}
        </div>
      )}

      <div
        className="row"
        style={{
          justifyContent: 'space-between',
          padding: '4px 4px 10px',
          fontSize: 12,
          color: 'var(--text-2)',
        }}
      >
        <span>支出 ¥{money(summary.expense)}</span>
        <span>收入 ¥{money(summary.income)}</span>
      </div>

      {groups.length === 0 ? (
        <div className="card empty">
          <span className="em">
            <AppIcon name="search" size={30} />
          </span>
          <div className="t">没有符合条件的记录</div>
          <div className="s">试试换个月份或清除筛选</div>
        </div>
      ) : (
        groups.map(([date, items]) => {
          const exp = items.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
          const inc = items.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
          return (
            <div className="tx-group" key={date}>
              <div className="tx-group-head">
                <span>
                  {formatDateLabel(date)} · {weekdayLabel(date)}
                </span>
                <span className="amt">
                  {exp > 0 && <span>支出 ¥{money(exp)}</span>}
                  {inc > 0 && <span>收入 ¥{money(inc)}</span>}
                </span>
              </div>
              {items.map((t) => (
                <TransactionRow
                  key={t.id}
                  tx={t}
                  onClick={() => navigate(`/add?id=${t.id}`)}
                  onDelete={() => setDeleting(t)}
                />
              ))}
            </div>
          )
        })
      )}

      {filterSheet && (
        <Sheet title="筛选" onClose={() => setFilterSheet(false)}>
          <div className="section-head" style={{ padding: '4px 2px 8px' }}>
            <h2>分类</h2>
          </div>
          <div className="pill-row">
            <button
              className={'pill' + (!catFilter ? ' active' : '')}
              onClick={() => setCatFilter(null)}
            >
              不限
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                className={'pill' + (catFilter === c.id ? ' active' : '')}
                onClick={() => setCatFilter(catFilter === c.id ? null : c.id)}
              >
                <AppIcon name={c.icon} size={14} color={c.color} />
                {c.name}
              </button>
            ))}
          </div>
          <div className="section-head" style={{ padding: '12px 2px 8px' }}>
            <h2>金额区间</h2>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1, minWidth: 0, marginBottom: 0 }}>
              <input
                type="number"
                inputMode="decimal"
                placeholder="最低"
                style={{ textAlign: 'left' }}
                value={minAmt}
                onChange={(e) => setMinAmt(e.target.value)}
              />
            </div>
            <span className="muted" style={{ flex: 'none' }}>
              ~
            </span>
            <div className="field" style={{ flex: 1, minWidth: 0, marginBottom: 0 }}>
              <input
                type="number"
                inputMode="decimal"
                placeholder="最高"
                style={{ textAlign: 'left' }}
                value={maxAmt}
                onChange={(e) => setMaxAmt(e.target.value)}
              />
            </div>
          </div>

          <div className="section-head" style={{ padding: '12px 2px 8px' }}>
            <h2>账户</h2>
          </div>
          <div className="pill-row">
            <button
              className={'pill' + (!accFilter ? ' active' : '')}
              onClick={() => setAccFilter(null)}
            >
              不限
            </button>
            {accounts.map((a) => (
              <button
                key={a.id}
                className={'pill' + (accFilter === a.id ? ' active' : '')}
                onClick={() => setAccFilter(accFilter === a.id ? null : a.id)}
              >
                <AppIcon name={a.icon} size={14} color={a.color} />
                {a.name}
              </button>
            ))}
          </div>
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 14 }}
            onClick={() => setFilterSheet(false)}
          >
            完成
          </button>
        </Sheet>
      )}
      {deleting && (
        <Sheet title="删除这笔记录？" onClose={() => setDeleting(null)}>
          <p style={{ color: 'var(--text-2)', fontSize: 14, padding: '0 4px 14px' }}>
            删除后无法恢复；账本的历史留档里可能还有旧版本。
          </p>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-ghost btn-block" onClick={() => setDeleting(null)}>
              取消
            </button>
            <button
              className="btn btn-danger btn-block"
              onClick={async () => {
                await db.transactions.delete(deleting.id)
                toast('已删除')
                setDeleting(null)
              }}
            >
              删除
            </button>
          </div>
        </Sheet>
      )}

      {searching && <div style={{ display: 'none' }} onClick={() => setSearching(false)} />}
    </div>
  )
}
