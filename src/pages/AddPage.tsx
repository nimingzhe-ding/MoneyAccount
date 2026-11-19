import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { db, getSetting, setSetting } from '../db'
import { useApp } from '../lib/store'
import { useDragReorder } from '../lib/dragReorder'
import { formatDateLabel, money, moneySigned, nowTime, parseAmount, todayStr, uid } from '../lib/format'
import Sheet from '../components/Sheet'
import CategoryEditor from '../components/CategoryEditor'
import {
  IconCalendar,
  IconCheck,
  IconTransfer,
  IconTrash,
} from '../components/Icons'
import type { Category, Transaction, TxType } from '../db/types'

type Mode = TxType

export default function AddPage({
  back,
  editId,
  presetType,
  presetCat,
  navigate,
}: {
  back: () => void
  editId?: string
  presetType?: Mode
  presetCat?: string
  navigate: (to: string) => void
}) {
  const { transactions, categories, accounts, accMap, catMap, accountBalances, toast } = useApp()

  const [mode, setMode] = useState<Mode>(presetType ?? 'expense')
  const [raw, setRaw] = useState('')
  const [categoryId, setCategoryId] = useState(presetCat ?? '')
  const [accountId, setAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [time, setTime] = useState(nowTime())
  const [note, setNote] = useState('')
  const [sheet, setSheet] = useState<'account' | 'toAccount' | 'date' | null>(null)
  const [catEditor, setCatEditor] = useState<Category | 'new' | null>(null)
  // 整理模式：长按分类进入，进去后能拖动排序、点 × 删除
  const [catMode, setCatMode] = useState(false)
  const [deleting, setDeleting] = useState<{ cat: Category; count: number } | null>(null)
  // 备注改成页面里直接打，不再弹面板；打字时把键盘收起来给输入框让位
  const [noteFocus, setNoteFocus] = useState(false)
  const [loaded, setLoaded] = useState(!editId)
  const [saving, setSaving] = useState(false)

  const originalRef = useRef<Transaction | null>(null)
  const holdRef = useRef<number>(0)
  const holdFiredRef = useRef(0)
  const defaultAccountLoaded = useRef(false)

  const expenseCats = useMemo(
    () => categories.filter((c) => c.type === 'expense' && !c.archived),
    [categories],
  )
  const incomeCats = useMemo(
    () => categories.filter((c) => c.type === 'income' && !c.archived),
    [categories],
  )

  // 首次进入：设置默认账户 / 分类
  useEffect(() => {
    if (!accounts.length) return
    if (!accountId && !editId && !defaultAccountLoaded.current) {
      defaultAccountLoaded.current = true
      let cancelled = false
      getSetting<string>('lastAccountId', '').then((id) => {
        if (cancelled) return
        const pick = accounts.find((a) => a.id === id && !a.archived) ?? accounts[0]
        if (pick) setAccountId(pick.id)
      })
      return () => {
        cancelled = true
      }
    }
    if (!toAccountId && accounts.length > 1) {
      const other = accounts.find((a) => a.id !== accountId && !a.archived)
      if (other) setToAccountId(other.id)
    }
  }, [accounts, accountId, toAccountId])

  useEffect(() => {
    if (!categoryId) {
      const first = mode === 'income' ? incomeCats[0] : expenseCats[0]
      if (first) setCategoryId(first.id)
    }
  }, [mode, expenseCats, incomeCats, categoryId])

  // 编辑模式加载
  useEffect(() => {
    if (!editId) return
    db.transactions.get(editId).then((tx) => {
      if (!tx) return
      originalRef.current = tx
      setMode(tx.type)
      setRaw((tx.amount / 100).toFixed(2).replace(/\.00$/, ''))
      setCategoryId(tx.categoryId)
      setAccountId(tx.accountId)
      setToAccountId(tx.toAccountId ?? '')
      setDate(tx.date)
      setTime(tx.time ?? nowTime())
      setNote(tx.note ?? '')
      setLoaded(true)
    })
  }, [editId])

  const amount = parseAmount(raw)

  const press = (k: string) => {
    if (k === 'del') {
      setRaw((r) => r.slice(0, -1))
      return
    }
    if (k === 'clear') {
      setRaw('')
      return
    }
    if (k === '.') {
      if (raw.includes('.')) return
      setRaw((r) => (r === '' ? '0.' : r + '.'))
      return
    }
    if (raw.includes('.')) {
      const dec = raw.split('.')[1] ?? ''
      if (dec.length >= 2) return
    }
    if (raw === '0' && k !== '.') {
      setRaw(k)
      return
    }
    if (raw.replace('.', '').length >= 9 && k !== '.') return
    setRaw((r) => r + k)
  }

  const save = async () => {
    if (saving) return
    if (amount <= 0) {
      toast('请输入金额')
      return
    }
    if (!accountId) {
      toast('请选择账户')
      return
    }
    if (mode === 'transfer' && (!toAccountId || toAccountId === accountId)) {
      toast('选择不同的转出与转入账户')
      return
    }
    if (mode !== 'transfer' && !categoryId) {
      toast('请选择分类')
      return
    }

    setSaving(true)
    const now = Date.now()
    const orig = originalRef.current
    const payload: Transaction = {
      id: orig?.id ?? uid('t_'),
      type: mode,
      amount,
      categoryId: mode === 'transfer' ? 'c_transfer' : categoryId,
      accountId,
      toAccountId: mode === 'transfer' ? toAccountId : undefined,
      note: note.trim() || undefined,
      date,
      time,
      createdAt: orig?.createdAt ?? now,
      updatedAt: now,
      recurringId: orig?.recurringId,
    }
    await db.transactions.put(payload)
    // 记住这次用的账户，下次新建默认选它
    await setSetting('lastAccountId', accountId)
    toast(orig ? '已更新' : `已记账 ¥${money(amount)}`)
    back()
  }

  const remove = async () => {
    if (!originalRef.current) return
    await db.transactions.delete(originalRef.current.id)
    toast('已删除')
    back()
  }

  const catList = mode === 'income' ? incomeCats : expenseCats
  const acc = accMap.get(accountId)
  const toAcc = accMap.get(toAccountId)

  // 金额卡左侧：支出/收入跟着分类走，转账显示两端账户
  const pickedCat = catMap.get(categoryId)
  const pickEmoji =
    mode === 'transfer' ? '🔄' : (pickedCat?.icon ?? '❓')
  const pickColor =
    mode === 'transfer' ? '#9C86C9' : pickedCat?.color
  // 转账时这里只说「转账」，两端账户交给下面那张卡，免得同一句话写两遍
  const pickName =
    mode === 'transfer' ? '转账' : (pickedCat?.name ?? '选个分类')
  const pickSub =
    mode === 'transfer'
      ? '账户之间互转，不计收支'
      : `${mode === 'income' ? '收入' : '支出'} · ${acc?.name ?? '未选账户'}`

  // 最近用过的转账组合：转账页空着一大片，正好拿来当快捷入口
  const recentTransfers = useMemo(() => {
    const seen = new Map<string, { from: string; to: string; at: number }>()
    transactions.forEach((t) => {
      if (t.type !== 'transfer' || !t.toAccountId) return
      const key = `${t.accountId}>${t.toAccountId}`
      const hit = seen.get(key)
      const at = t.createdAt || 0
      if (!hit || at > hit.at) seen.set(key, { from: t.accountId, to: t.toAccountId, at })
    })
    return [...seen.values()].slice(0, 3)
  }, [transactions])

  /** 取消「长按进入整理模式」的计时器 */
  const clearHold = () => {
    if (holdRef.current) {
      window.clearTimeout(holdRef.current)
      holdRef.current = 0
    }
  }

  const catIds = useMemo(() => catList.map((c) => c.id), [catList])
  // 松手时把新顺序按 1..n 写回，两次 update 之间不留空档，所以包一个事务
  const commitCatOrder = useCallback(async (ids: string[]) => {
    await db.transaction('rw', db.categories, async () => {
      for (let i = 0; i < ids.length; i += 1) {
        await db.categories.update(ids[i], { order: i + 1 })
      }
    })
  }, [])
  const { order: catOrder, dragId, onPointerDown, wasDragging } = useDragReorder({
    ids: catIds,
    onCommit: commitCatOrder,
  })
  const orderedCats = useMemo(() => {
    const byId = new Map(catList.map((c) => [c.id, c]))
    const arr: Category[] = []
    catOrder.forEach((id) => {
      const c = byId.get(id)
      if (c) {
        arr.push(c)
        byId.delete(id)
      }
    })
    // 刚建好、还没进拖动快照的新分类补在末尾
    byId.forEach((c) => arr.push(c))
    return arr
  }, [catList, catOrder])

  const askDeleteCat = async (c: Category) => {
    const n = await db.transactions.where('categoryId').equals(c.id).count()
    setDeleting({ cat: c, count: n })
  }
  const confirmDeleteCat = async () => {
    if (!deleting) return
    const { cat } = deleting
    await db.categories.delete(cat.id)
    if (categoryId === cat.id) setCategoryId('')
    setDeleting(null)
    toast('已删除分类')
  }

  // 长按删除更安全，这里用弹 sheet 确认
  const [confirmDel, setConfirmDel] = useState(false)

  return (
    <div className={'add-page' + (noteFocus ? ' note-on' : '')}>
      <div className="add-header">
        <div className="row" style={{ gap: 2 }}>
          <button className="icon-btn" onClick={back} aria-label="返回">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        </div>
        <div className="segmented">
          {(['expense', 'income', 'transfer'] as Mode[]).map((m) => (
            <button
              key={m}
              className={mode === m ? 'active' : ''}
              onClick={() => {
                setMode(m)
                setCategoryId('')
                setCatMode(false)
              }}
            >
              {m === 'expense' ? '支出' : m === 'income' ? '收入' : '转账'}
            </button>
          ))}
        </div>
        <div style={{ width: 38 }}>
          {editId ? (
            <button
              className="icon-btn"
              onClick={() => setConfirmDel(true)}
              aria-label="删除"
            >
              <IconTrash size={17} />
            </button>
          ) : null}
        </div>
      </div>

      {/* 金额区：左边是当前选中的分类/转账，右边是大金额。
          之前金额单独右对齐悬在空中，左边全是空的，重心是散的 */}
      <div className="add-amount-card">
        <div className="am-left">
          <span
            className="am-em"
            style={{ background: (pickColor ?? '#999') + '26' }}
          >
            {pickEmoji}
          </span>
          <span className="am-txt">
            <span className="am-name">{pickName}</span>
            <span className="am-sub">{pickSub}</span>
          </span>
        </div>
        <div className="am-right">
          <span className="cur">¥</span>
          <span className={'val' + (raw === '' ? ' placeholder' : '')}>
            {raw === '' ? '0.00' : raw}
          </span>
        </div>
      </div>

      <div className="add-meta">
        <button className="chip strong" onClick={() => setSheet('account')}>
          <span className="em">{acc?.icon ?? '💳'}</span>
          {acc?.name ?? '选择账户'}
        </button>
        {mode === 'transfer' && (
          <>
            <span className="chip" style={{ padding: '6px 4px', background: 'none', border: 'none', boxShadow: 'none' }}>
              →
            </span>
            <button className="chip strong" onClick={() => setSheet('toAccount')}>
              <span className="em">{toAcc?.icon ?? '💳'}</span>
              {toAcc?.name ?? '转入账户'}
            </button>
          </>
        )}
        <button className="chip" onClick={() => setSheet('date')}>
          <IconCalendar size={13} />
          {formatDateLabel(date)}
        </button>

        {/* 备注并进这一排：它和账户、日期一样都是「这笔的附属信息」，
            单独占一条横带会像中间夹了块板子 */}
        <label className={'note-chip' + (noteFocus ? ' on' : '') + (note ? ' has' : '')}>
          <span className="note-em">📝</span>
          <input
            className="note-input"
            placeholder="备注"
            value={note}
            maxLength={60}
            onFocus={() => setNoteFocus(true)}
            onBlur={() => setNoteFocus(false)}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
          />
          {note && (
            <span
              className="note-clear"
              role="button"
              aria-label="清空备注"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setNote('')
              }}
            >
              ✕
            </span>
          )}
        </label>
      </div>

      {mode === 'transfer' ? (
        /* 转账：左右两半各点一个账户，中间的箭头可以一键对调。
           之前只有一张只读卡片，中间空着一大片什么都没有 */
        <div className="tf-wrap">
          <div className="tf-card">
            <button
              className="tf-side"
              onClick={() => setSheet('account')}
              aria-label="选择转出账户"
            >
              <span
                className="tf-em"
                style={{ background: (acc?.color ?? '#999') + '26' }}
              >
                {acc?.icon ?? '💳'}
              </span>
              <span className="tf-name">{acc?.name ?? '转出账户'}</span>
              <span className="tf-bal">
                {moneySigned(accountBalances.get(accountId) ?? 0)}
              </span>
            </button>

            <button
              className="tf-swap"
              onClick={() => {
                if (!toAccountId) return
                setAccountId(toAccountId)
                setToAccountId(accountId)
                navigator.vibrate?.(10)
              }}
              aria-label="对调转出与转入"
            >
              <IconTransfer size={20} />
            </button>

            <button
              className="tf-side"
              onClick={() => setSheet('toAccount')}
              aria-label="选择转入账户"
            >
              <span
                className="tf-em"
                style={{ background: (toAcc?.color ?? '#999') + '26' }}
              >
                {toAcc?.icon ?? '💳'}
              </span>
              <span className="tf-name">{toAcc?.name ?? '转入账户'}</span>
              <span className="tf-bal">
                {moneySigned(accountBalances.get(toAccountId) ?? 0)}
              </span>
            </button>
          </div>
          <div className="tf-hint">点账户换方向，点中间箭头两边对调</div>

          {recentTransfers.length > 0 && (
            <div className="tf-recent">
              <div className="tf-recent-head">常用</div>
              {recentTransfers.map((r) => {
                const from = accMap.get(r.from)
                const to = accMap.get(r.to)
                if (!from || !to) return null
                const on = r.from === accountId && r.to === toAccountId
                return (
                  <button
                    key={`${r.from}>${r.to}`}
                    className={'tf-recent-row' + (on ? ' on' : '')}
                    onClick={() => {
                      setAccountId(r.from)
                      setToAccountId(r.to)
                    }}
                  >
                    <span className="cat-icon" style={{ background: from.color + '1f' }}>
                      {from.icon}
                    </span>
                    <span className="tf-recent-name">
                      {from.name} → {to.name}
                    </span>
                    {on && <IconCheck size={16} />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div className={'cat-grid' + (catMode ? ' editing' : '')}>
          {catMode && (
            <div className="cat-edit-bar">
              <span>按住分类拖动排序，点 × 删除</span>
              <button className="btn btn-sm btn-ghost" onClick={() => setCatMode(false)}>
                完成
              </button>
            </div>
          )}
          {orderedCats.map((c) => {
            const sel = c.id === categoryId && !catMode
            return (
              <div className="cat-slot" key={c.id} data-drag-id={c.id}>
                <button
                  className={'cat-cell' + (sel ? ' sel' : '') + (dragId === c.id ? ' dragging' : '')}
                  style={{
                    ['--cat-color' as string]: c.color,
                    ['--tint' as string]: c.color + '1f',
                  }}
                  onPointerDown={(e) => {
                    if (catMode) {
                      onPointerDown(c.id, e)
                      return
                    }
                    // 长按进入整理模式：拖动排序、点 × 删除都在里面
                    holdRef.current = window.setTimeout(() => {
                      holdRef.current = 0
                      holdFiredRef.current = Date.now()
                      setCatMode(true)
                      navigator.vibrate?.(12)
                    }, 450)
                  }}
                  onPointerUp={clearHold}
                  onPointerLeave={clearHold}
                  onClick={() => {
                    // 长按 / 拖动松手后浏览器还会补一个 click，别让它顺手选中或打开编辑
                    if (Date.now() - holdFiredRef.current < 600) return
                    if (wasDragging()) return
                    if (catMode) {
                      setCatEditor(c)
                      return
                    }
                    setCategoryId(c.id)
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setCatMode(true)
                  }}
                >
                  <span className="box" style={sel ? { background: c.color } : undefined}>
                    {c.icon}
                  </span>
                  <span className="nm">{c.name}</span>
                </button>
                {catMode && (
                  <button
                    className="cat-x"
                    onClick={() => askDeleteCat(c)}
                    aria-label={`删除 ${c.name}`}
                  >
                    ×
                  </button>
                )}
              </div>
            )
          })}
          {!catMode && (
            <button
              className="cat-cell add"
              onClick={() => setCatEditor('new')}
              aria-label="新建分类"
            >
              <span className="box">＋</span>
              <span className="nm">添加</span>
            </button>
          )}
        </div>
      )}

      {/* 打字时自绘键盘让位给系统键盘，但保存入口不能跟着消失 */}
      {noteFocus && (
        <div className="note-actions">
          <button
            className="btn btn-ghost"
            onClick={() => (document.activeElement as HTMLElement | null)?.blur()}
          >
            收起
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      )}


      <div className="keypad">
        <div className="keys">
          {['1', '2', '3', 'del', '4', '5', '6', 'clear', '7', '8', '9'].map((k) => (
            <button
              key={k}
              className={'key' + (k === 'del' || k === 'clear' ? ' fn' : '')}
              onClick={() => press(k)}
            >
              {k === 'del' ? '⌫' : k === 'clear' ? 'C' : k}
            </button>
          ))}
          <button
            className="key accent"
            style={{ gridRow: 'span 2', gridColumn: '4', height: 'auto', fontSize: 16, fontWeight: 600 }}
            onClick={save}
            disabled={saving}
          >
            {editId ? '保存' : '完成'}
          </button>
          <button className="key" onClick={() => press('00')}>
            00
          </button>
          <button className="key" onClick={() => press('0')}>
            0
          </button>
          <button className="key" onClick={() => press('.')}>
            .
          </button>
        </div>
      </div>

      {sheet === 'account' && (
        <Sheet title="选择账户" onClose={() => setSheet(null)}>
          <div className="acc-list" style={{ paddingBottom: 8 }}>
            {accounts.map((a) => (
              <button
                key={a.id}
                className="acc-row"
                onClick={() => { setAccountId(a.id); setSheet(null) }}
                style={a.id === accountId ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' } : undefined}
              >
                <span className="cat-icon" style={{ background: a.color + '1f' }}>{a.icon}</span>
                <span style={{ flex: 1, textAlign: 'left' }}>
                  <span className="nm">{a.name}</span>
                </span>
                {a.id === accountId && <IconCheck size={17} />}
              </button>
            ))}
            <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => { setSheet(null); navigate('/accounts') }}>
              管理账户
            </button>
          </div>
        </Sheet>
      )}

      {sheet === 'toAccount' && (
        <Sheet title="转入账户" onClose={() => setSheet(null)}>
          <div className="acc-list" style={{ paddingBottom: 8 }}>
            {accounts.filter((a) => a.id !== accountId).map((a) => (
              <button
                key={a.id}
                className="acc-row"
                onClick={() => { setToAccountId(a.id); setSheet(null) }}
                style={a.id === toAccountId ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' } : undefined}
              >
                <span className="cat-icon" style={{ background: a.color + '1f' }}>{a.icon}</span>
                <span style={{ flex: 1, textAlign: 'left' }}>
                  <span className="nm">{a.name}</span>
                </span>
                {a.id === toAccountId && <IconCheck size={17} />}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {sheet === 'date' && (
        <Sheet title="选择日期" onClose={() => setSheet(null)}>
          <input
            type="date"
            value={date}
            max={dayjs().add(1, 'year').format('YYYY-MM-DD')}
            onChange={(e) => setDate(e.target.value)}
            className="field"
            style={{ textAlign: 'left', fontSize: 16, width: '100%' }}
          />
          <div className="pill-row" style={{ marginTop: 4 }}>
            {[0, 1, 2, 3].map((d) => {
              const v = dayjs().subtract(d, 'day').format('YYYY-MM-DD')
              return (
                <button
                  key={d}
                  className={'pill' + (date === v ? ' active' : '')}
                  onClick={() => setDate(v)}
                >
                  {formatDateLabel(v)}
                </button>
              )
            })}
          </div>
          <div className="field">
            <span className="lbl">时间</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-block" style={{ marginTop: 10 }} onClick={() => setSheet(null)}>
            完成
          </button>
        </Sheet>
      )}

      {catEditor && (
        <CategoryEditor
          cat={catEditor === 'new' ? null : catEditor}
          type={mode === 'income' ? 'income' : 'expense'}
          onClose={() => setCatEditor(null)}
          onDone={(msg, created) => {
            toast(msg)
            setCatEditor(null)
            // 新建后直接选中它，省得再点一次
            if (created) setCategoryId(created.id)
          }}
        />
      )}

      {confirmDel && (
        <Sheet title="删除这笔记录？" onClose={() => setConfirmDel(false)}>
          <p style={{ color: 'var(--text-2)', fontSize: 14, padding: '0 4px 14px' }}>
            删除后无法恢复。
          </p>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-ghost btn-block" onClick={() => setConfirmDel(false)}>取消</button>
            <button className="btn btn-danger btn-block" onClick={remove}>
              删除
            </button>
          </div>
        </Sheet>
      )}

      {deleting && (
        <Sheet title={`删除「${deleting.cat.name}」？`} onClose={() => setDeleting(null)}>
          <p style={{ color: 'var(--text-2)', fontSize: 13.5, padding: '0 4px 14px', lineHeight: 1.65 }}>
            {deleting.count > 0
              ? `已有 ${deleting.count} 笔记账用了这个分类，删掉后这些记录会显示成「未分类」，金额和账户都还在。`
              : '这个分类还没有记过账，删掉后不可恢复。'}
          </p>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-ghost btn-block" onClick={() => setDeleting(null)}>
              取消
            </button>
            <button className="btn btn-danger btn-block" onClick={confirmDeleteCat}>
              删除
            </button>
          </div>
        </Sheet>
      )}

      {!loaded && <div className="toast">加载中…</div>}
    </div>
  )
}
