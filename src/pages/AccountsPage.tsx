import { useMemo, useState } from 'react'
import { db } from '../db'
import { useApp } from '../lib/store'
import { money, moneySigned, uid } from '../lib/format'
import Sheet from '../components/Sheet'
import {
  IconChevronLeft,
  IconPlus,
  IconTrash,
  IconTransfer,
} from '../components/Icons'
import { AppIcon } from '../lib/appIcons'
import type { Account, AccountKind } from '../db/types'

const KINDS: { k: AccountKind; label: string }[] = [
  { k: 'cash', label: '现金' },
  { k: 'ewallet', label: '电子钱包' },
  { k: 'bank', label: '银行卡' },
  { k: 'credit', label: '信用卡' },
  { k: 'other', label: '其他' },
]

const PRESET_ICONS = [
  'message-circle',
  'wallet',
  'landmark',
  'credit-card',
  'banknote',
  'coins',
  'trending-up',
  'piggy-bank',
  'house',
  'plane',
]

export default function AccountsPage({ back }: { back: () => void }) {
  const { accounts, accountBalances, transactions, toast } = useApp()
  const [editing, setEditing] = useState<Account | 'new' | null>(null)

  const { assets, debts } = useMemo(() => {
    let assets = 0
    let debts = 0
    accounts.forEach((a) => {
      const b = accountBalances.get(a.id) ?? 0
      if (a.kind === 'credit') debts += b
      else assets += b
    })
    return { assets, debts }
  }, [accounts, accountBalances])

  const netWorth = assets + debts

  const monthFlow = useMemo(() => {
    const m = new Date().toISOString().slice(0, 7)
    let inc = 0
    let exp = 0
    transactions.forEach((t) => {
      if (!t.date.startsWith(m)) return
      if (t.accountId && t.type === 'income') inc += t.amount
      if (t.accountId && t.type === 'expense') exp += t.amount
    })
    return { inc, exp }
  }, [transactions])

  return (
    <div className="page">
      <header className="topbar">
        <div className="row" style={{ gap: 4 }}>
          <button className="back-btn" onClick={back}>
            <IconChevronLeft size={18} />
          </button>
          <h1>账户</h1>
        </div>
        <button className="icon-btn" onClick={() => setEditing('new')} aria-label="添加账户">
          <IconPlus size={19} />
        </button>
      </header>

      <div className="hero" style={{ padding: '18px 20px' }}>
        <div className="hero-label">净资产</div>
        <div className="hero-balance" style={{ fontSize: 34 }}>
          {moneySigned(netWorth)}
        </div>
        <div className="hero-strip" style={{ marginTop: 14 }}>
          <div className="hero-stat">
            <div className="k">资产</div>
            <div className="v">{moneySigned(assets)}</div>
          </div>
          <div className="hero-stat">
            <div className="k">负债</div>
            <div className="v" style={{ color: debts < 0 ? '#ff9d88' : undefined }}>
              {moneySigned(-debts)}
            </div>
          </div>
        </div>
      </div>

      <div className="row grid-2" style={{ marginTop: 12 }}>
        <div className="card card-pad" style={{ padding: '12px 14px' }}>
          <div className="small muted">本月收入</div>
          <div className="big-num" style={{ fontSize: 18, color: 'var(--positive)', marginTop: 2 }}>
            ¥{money(monthFlow.inc)}
          </div>
        </div>
        <div className="card card-pad" style={{ padding: '12px 14px' }}>
          <div className="small muted">本月支出</div>
          <div className="big-num" style={{ fontSize: 18, marginTop: 2 }}>
            ¥{money(monthFlow.exp)}
          </div>
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>我的账户</h2>
          <span className="more">{accounts.length} 个</span>
        </div>
        <div className="acc-list">
          {accounts.map((a) => {
            const bal = accountBalances.get(a.id) ?? 0
            const kind = KINDS.find((k) => k.k === a.kind)
            return (
              <div key={a.id} className="acc-row" onClick={() => setEditing(a)} style={{ cursor: 'pointer' }}>
                <span
                  className="cat-icon"
                  style={{ background: a.color + '1f', width: 38, height: 38, borderRadius: 12 }}
                >
                  <AppIcon name={a.icon} size={19} color={a.color} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="nm">{a.name}</div>
                  <div className="sub">{kind?.label}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    className="big-num"
                    style={{
                      fontSize: 15.5,
                      fontWeight: 600,
                      color: bal < 0 ? 'var(--negative)' : 'var(--text)',
                    }}
                  >
                    {moneySigned(bal)}
                  </div>
                  {a.kind === 'credit' && a.creditLimit ? (
                    <div className="sub">额度 ¥{money(a.creditLimit, { decimals: false })}</div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <div className="card" style={{ marginTop: 14, overflow: 'hidden' }}>
        <div className="list-row" style={{ cursor: 'default' }}>
          <span className="lbl">小提示</span>
          <span className="val" style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-3)', textAlign: 'right' }}>
            余额 = 初始余额 + 收入 − 支出
          </span>
        </div>
      </div>

      {editing && (
        <AccountEditor
          account={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            toast(msg)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function AccountEditor({
  account,
  onClose,
  onSaved,
}: {
  account: Account | null
  onClose: () => void
  onSaved: (msg: string) => void
}) {
  const { toast } = useApp()
  const [name, setName] = useState(account?.name ?? '')
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? 'ewallet')
  const [icon, setIcon] = useState(account?.icon ?? 'credit-card')
  const [balance, setBalance] = useState(
    account ? String(account.initialBalance / 100) : '',
  )
  const [limit, setLimit] = useState(account?.creditLimit ? String(account.creditLimit / 100) : '')
  const [delConfirm, setDelConfirm] = useState(false)

  const save = async () => {
    if (!name.trim()) {
      toast('请输入账户名称')
      return
    }
    const colorMap: Record<AccountKind, string> = {
      cash: '#7FA85E',
      ewallet: '#4E9E6B',
      bank: '#C79A47',
      credit: '#A77BBE',
      other: '#9C86C9',
    }
    const payload: Account = {
      id: account?.id ?? uid('a_'),
      name: name.trim(),
      kind,
      icon,
      color: account?.color ?? colorMap[kind],
      initialBalance: Math.round(Number(balance || 0) * 100),
      order: account?.order ?? Date.now(),
      creditLimit: kind === 'credit' && limit ? Math.round(Number(limit) * 100) : undefined,
    }
    await db.accounts.put(payload)
    onSaved(account ? '已更新账户' : '已添加账户')
  }

  const remove = async () => {
    if (!account) return
    await db.accounts.delete(account.id)
    onSaved('已删除账户')
  }

  return (
    <Sheet title={account ? '编辑账户' : '添加账户'} onClose={onClose}>
      <div className="field">
        <span className="lbl">名称</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：招商银行" />
      </div>
      <div className="field">
        <span className="lbl">类型</span>
        <select value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
          {KINDS.map((k) => (
            <option key={k.k} value={k.k}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <span className="lbl">初始余额</span>
        <input
          type="number"
          inputMode="decimal"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          placeholder="0.00"
        />
      </div>
      {kind === 'credit' && (
        <div className="field">
          <span className="lbl">信用额度</span>
          <input
            type="number"
            inputMode="decimal"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="可选"
          />
        </div>
      )}
      <div className="field" style={{ flexWrap: 'wrap', gap: 8 }}>
        <span className="lbl">图标</span>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', flex: 1 }}>
          {PRESET_ICONS.map((ic) => (
            <button
              key={ic}
              onClick={() => setIcon(ic)}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: icon === ic ? 'var(--accent-soft)' : 'var(--surface-3)',
                border: icon === ic ? '1px solid var(--accent)' : '1px solid transparent',
              }}
            >
              <AppIcon name={ic} size={18} color={icon === ic ? 'var(--accent)' : 'var(--text-2)'} />
            </button>
          ))}
        </div>
      </div>

      <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={save}>
        保存
      </button>
      {account && (
        <>
          {!delConfirm ? (
            <button
              className="btn btn-ghost btn-block"
              style={{ marginTop: 8, color: 'var(--negative)' }}
              onClick={() => setDelConfirm(true)}
            >
              <IconTrash size={15} /> 删除账户
            </button>
          ) : (
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <button className="btn btn-ghost btn-block" onClick={() => setDelConfirm(false)}>
                取消
              </button>
              <button className="btn btn-danger btn-block" onClick={remove}>
                确认删除
              </button>
            </div>
          )}
        </>
      )}
      <div style={{ height: 6 }} />
      <div className="row small muted" style={{ padding: '0 4px', gap: 6 }}>
        <IconTransfer size={13} />
        账户间转账请到「记一笔 → 转账」
      </div>
    </Sheet>
  )
}
