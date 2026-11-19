import { useState } from 'react'
import dayjs from 'dayjs'
import { db } from '../db'
import { useApp } from '../lib/store'
import { money, uid } from '../lib/format'
import Sheet from '../components/Sheet'
import { IconChevronLeft, IconPlus, IconTrash, IconRepeat } from '../components/Icons'
import { AppIcon } from '../lib/appIcons'
import type { Recurring, RecurringFreq } from '../db/types'

const FREQ_LABEL: Record<RecurringFreq, string> = {
  monthly: '每月',
  weekly: '每周',
  daily: '每天',
  yearly: '每年',
}

export default function RecurringPage({ back }: { back: () => void }) {
  const { recurring, catMap, accMap, toast, categories, accounts } = useApp()
  const [editing, setEditing] = useState<Recurring | 'new' | null>(null)

  const toggle = async (r: Recurring) => {
    await db.recurring.update(r.id, { enabled: !r.enabled })
    toast(r.enabled ? '已暂停' : '已启用')
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="row" style={{ gap: 4 }}>
          <button className="back-btn" onClick={back}>
            <IconChevronLeft size={18} />
          </button>
          <h1>周期账单</h1>
        </div>
        <button className="icon-btn" onClick={() => setEditing('new')} aria-label="新建">
          <IconPlus size={19} />
        </button>
      </header>

      <div className="card card-pad" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <AppIcon name="calendar-clock" size={18} color="var(--accent)" />
        <div className="small" style={{ color: 'var(--text-2)', lineHeight: 1.5 }}>
          房租、订阅、还款这类固定账目可以设成周期账单，
          <b style={{ color: 'var(--text)' }}>打开 App 时会自动补记</b>到期的条目。
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>规则</h2>
          <span className="more">{recurring.length} 条</span>
        </div>

        {recurring.length === 0 ? (
          <div className="card empty">
            <span className="em">
              <AppIcon name="calendar-clock" size={30} />
            </span>
            <div className="t">还没有周期账单</div>
            <div className="s">点击右上角 + 添加</div>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            {recurring.map((r, i) => {
              const cat = catMap.get(r.categoryId)
              const acc = accMap.get(r.accountId)
              return (
                <div
                  key={r.id}
                  style={{
                    padding: '13px 15px',
                    borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                    opacity: r.enabled ? 1 : 0.5,
                  }}
                >
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <button
                      className="row"
                      style={{ gap: 9, textAlign: 'left', flex: 1, minWidth: 0 }}
                      onClick={() => setEditing(r)}
                    >
                      <span
                        className="cat-icon"
                        style={{ background: (cat?.color ?? '#999') + '1f' }}
                      >
                        <AppIcon
                          name={cat?.icon ?? 'package'}
                          size={18}
                          color={cat?.color ?? 'var(--text-2)'}
                        />
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{r.name}</div>
                        <div className="small muted" style={{ fontSize: 11.5 }}>
                          {FREQ_LABEL[r.freq]}
                          {r.freq !== 'daily' && r.freq !== 'yearly' && ` ${r.day} 号`}
                          {r.freq === 'weekly' && ` ${['周日','周一','周二','周三','周四','周五','周六'][r.day]}`}
                          {' · '}
                          {acc?.name}
                        </div>
                      </span>
                    </button>
                    <div style={{ textAlign: 'right' }}>
                      <div className="big-num" style={{ fontSize: 15, fontWeight: 600 }}>
                        {r.type === 'income' ? '+' : '-'}¥{money(r.amount)}
                      </div>
                      <button
                        onClick={() => toggle(r)}
                        className="small"
                        style={{ color: r.enabled ? 'var(--positive)' : 'var(--text-3)', marginTop: 2 }}
                      >
                        {r.enabled ? '● 启用中' : '○ 已暂停'}
                      </button>
                    </div>
                  </div>
                  {r.lastRun && (
                    <div className="small muted" style={{ fontSize: 11, marginTop: 6, paddingLeft: 43 }}>
                      上次记账：{r.lastRun}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {editing && (
        <RuleEditor
          rule={editing === 'new' ? null : editing}
          categories={categories}
          accounts={accounts}
          onClose={() => setEditing(null)}
          onDone={(msg) => {
            toast(msg)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function RuleEditor({
  rule,
  categories,
  accounts,
  onClose,
  onDone,
}: {
  rule: Recurring | null
  categories: ReturnType<typeof useApp>['categories']
  accounts: ReturnType<typeof useApp>['accounts']
  onClose: () => void
  onDone: (msg: string) => void
}) {
  const { toast } = useApp()
  const [name, setName] = useState(rule?.name ?? '')
  const [amount, setAmount] = useState(rule ? String(rule.amount / 100) : '')
  const [type, setType] = useState<'expense' | 'income'>(rule?.type ?? 'expense')
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? '')
  const [accountId, setAccountId] = useState(rule?.accountId ?? accounts[0]?.id ?? '')
  const [freq, setFreq] = useState<RecurringFreq>(rule?.freq ?? 'monthly')
  const [day, setDay] = useState(rule?.day ?? dayjs().date())
  const [note, setNote] = useState(rule?.note ?? '')
  const [confirmDel, setConfirmDel] = useState(false)

  const cats = categories.filter((c) => c.type === type)

  const save = async () => {
    const fen = Math.round(Number(amount) * 100)
    if (!name.trim()) return toast('请输入名称')
    if (fen <= 0) return toast('请输入金额')
    if (!categoryId && cats[0]) setCategoryId(cats[0].id)
    const payload: Recurring = {
      id: rule?.id ?? uid('r_'),
      name: name.trim(),
      type,
      amount: fen,
      categoryId: categoryId || cats[0]?.id || 'c_other_e',
      accountId,
      note: note.trim() || undefined,
      freq,
      day,
      startDate: rule?.startDate ?? dayjs().format('YYYY-MM-DD'),
      lastRun: rule?.lastRun,
      enabled: rule?.enabled ?? true,
      createdAt: rule?.createdAt ?? Date.now(),
    }
    await db.recurring.put(payload)
    onDone(rule ? '已更新' : '已创建周期账单')
  }

  return (
    <Sheet
      title={rule ? '编辑周期账单' : '新建周期账单'}
      onClose={onClose}
      right={
        rule ? (
          <button className="icon-btn" onClick={() => setConfirmDel(true)}>
            <IconTrash size={15} />
          </button>
        ) : undefined
      }
    >
      <div className="segmented" style={{ marginBottom: 10 }}>
        <button className={type === 'expense' ? 'active' : ''} onClick={() => { setType('expense'); setCategoryId('') }}>
          支出
        </button>
        <button className={type === 'income' ? 'active' : ''} onClick={() => { setType('income'); setCategoryId('') }}>
          收入
        </button>
      </div>
      <div className="field">
        <span className="lbl">名称</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：房租" />
      </div>
      <div className="field">
        <span className="lbl">金额</span>
        <input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />
      </div>
      <div className="field">
        <span className="lbl">分类</span>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <span className="lbl">账户</span>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <span className="lbl">频率</span>
        <select value={freq} onChange={(e) => setFreq(e.target.value as RecurringFreq)}>
          <option value="monthly">每月</option>
          <option value="weekly">每周</option>
          <option value="daily">每天</option>
          <option value="yearly">每年</option>
        </select>
      </div>
      {freq === 'monthly' && (
        <div className="field">
          <span className="lbl">每月</span>
          <select value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d} 号
              </option>
            ))}
          </select>
        </div>
      )}
      {freq === 'weekly' && (
        <div className="field">
          <span className="lbl">星期</span>
          <select value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map((d, i) => (
              <option key={i} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field">
        <span className="lbl">备注</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选" />
      </div>

      <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={save}>
        保存
      </button>

      {confirmDel && (
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn btn-ghost btn-block" onClick={() => setConfirmDel(false)}>
            取消
          </button>
          <button
            className="btn btn-danger btn-block"
            onClick={async () => {
              if (rule) await db.recurring.delete(rule.id)
              onDone('已删除')
            }}
          >
            确认删除
          </button>
        </div>
      )}
      {!rule && (
        <div className="row small muted" style={{ padding: '10px 4px 0', gap: 6 }}>
          <IconRepeat size={12} />
          创建后，到期的账目会在打开 App 时自动生成
        </div>
      )}
    </Sheet>
  )
}
