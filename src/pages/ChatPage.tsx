import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { db } from '../db'
import { useApp } from '../lib/store'
import {
  CHAT_EXAMPLES,
  fenToYuanInput,
  parseLedgerText,
  type ParsedDraft,
} from '../lib/nlp'
import {
  askAi,
  aiReady,
  loadAiConfig,
  AiError,
  type AiConfig,
} from '../lib/ai'
import {
  speechAvailable,
  startListening,
  stopListening,
} from '../lib/speech'
import { formatDateLabel, money, parseAmount, uid } from '../lib/format'
import Sheet from '../components/Sheet'
import {
  IconArrowUp,
  IconCalendar,
  IconChevronLeft,
  IconClose,
  IconGear,
  IconMic,
  IconTrash,
} from '../components/Icons'
import { AppIcon } from '../lib/appIcons'

/** 一条消息里的一张待确认卡片 */
interface Draft extends ParsedDraft {
  key: string
  done: boolean
}

interface Msg {
  id: string
  role: 'user' | 'bot'
  text: string
  drafts?: Draft[]
  /** 这一次入账写进去的 id 和对应的卡片 key，用来撤销 */
  commit?: { ids: string[]; keys: string[]; total: number; count: number }
  undone?: boolean
  at: number
}

const STORE_KEY = 'chat-messages-v1'
const MAX_MSG = 40

function loadMessages(): Msg[] {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as Msg[]
    if (!Array.isArray(list)) return []
    return list.slice(-MAX_MSG)
  } catch {
    return []
  }
}

function saveMessages(list: Msg[]) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(-MAX_MSG)))
  } catch {
    /* 隐私模式下 localStorage 会抛错，聊胜于无 */
  }
}

const WELCOME: Msg = {
  id: 'm_welcome',
  role: 'bot',
  text: '想记什么直接说，比如「昨天午饭 25 微信」。\n懒得打字就点左下角麦克风，说完自动发出去。一句话里说几笔也行，我会拆成几张卡片，你确认后一起入账。',
  at: Date.now(),
}

export default function ChatPage({
  back,
  navigate,
}: {
  back: () => void
  navigate: (to: string) => void
}) {
  const { accounts, categories, transactions, accountBalances, toast } = useApp()
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    const saved = loadMessages()
    return saved.length ? saved : [WELCOME]
  })
  const [text, setText] = useState('')
  const [cfg, setCfg] = useState<AiConfig | null>(null)
  const [thinking, setThinking] = useState(false)
  const [listening, setListening] = useState(false)
  const [micOk, setMicOk] = useState(false)
  const [editing, setEditing] = useState<{ msgId: string; key: string; field: Field } | null>(null)
  const [amountDraft, setAmountDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => saveMessages(msgs), [msgs])

  /* 打开页面就停在最新一条，而不是从头开始。
     用 layout effect + 无动画，免得先闪一下顶部再滑下来；
     之后来新消息才用平滑滚动。
     注意：App 在切页时会 window.scrollTo(0,0)，子组件的 effect 先跑，
     所以这里必须等一帧再滚，否则会被父组件的滚动重置掉。 */
  const firstScroll = useRef(true)
  useLayoutEffect(() => {
    const jump = () => {
      if (!bottomRef.current) return
      // 滚到文档最底，而不是把这条占位 div 的底边对齐视口底边：
      // 输入条是 fixed 的，占了视口最下面一截，对齐视口底边等于把最后一条
      // 塞到输入条底下。滚到最底则留出 .chat-page 的 padding-bottom 当缓冲区。
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (firstScroll.current) {
        window.scrollTo(0, Math.max(0, max))
        firstScroll.current = false
      } else {
        window.scrollTo({ top: Math.max(0, max), behavior: 'smooth' })
      }
    }
    jump()
    const raf = requestAnimationFrame(jump)
    const timer = window.setTimeout(jump, 60)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [msgs.length, thinking])

  /* 系统键盘弹起时把可视区高度记下来：
     卡片里的备注框要能滚到键盘上方，输入条也要跟着抬起来。 */
  const [kbPad, setKbPad] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const gap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKbPad(gap > 80 ? gap : 0)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  /** 点开备注框时把它顶到键盘上方，别被挡住 */
  const revealField = (e: { currentTarget: HTMLElement }) => {
    const el = e.currentTarget
    window.setTimeout(() => {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 280)
  }
  useEffect(() => {
    void loadAiConfig().then(setCfg)
    void speechAvailable().then(setMicOk)
  }, [])

  // 离开页面时别让麦克风还开着
  useEffect(() => () => void stopListening(), [])

  const activeAccounts = useMemo(
    () => accounts.filter((a) => !a.archived),
    [accounts],
  )

  /** 没识别出账户时，用最常用的那个兜底 */
  const defaultAccountId = useMemo(() => {
    const count = new Map<string, number>()
    transactions.forEach((t) => count.set(t.accountId, (count.get(t.accountId) ?? 0) + 1))
    let best = ''
    let bestN = 0
    count.forEach((n, id) => {
      if (n > bestN && activeAccounts.some((a) => a.id === id)) {
        best = id
        bestN = n
      }
    })
    return best || activeAccounts[0]?.id || accounts[0]?.id || ''
  }, [transactions, activeAccounts, accounts])

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const accMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])

  const push = (m: Msg) => setMsgs((prev) => [...prev, m].slice(-MAX_MSG))

  /** 本地规则解析：没配 Key、模型失败、或模型说没听懂时都用它兜底 */
  const localParse = (input: string): Draft[] => {
    const drafts = parseLedgerText(input, { categories, accounts: activeAccounts }, dayjs())
    return drafts.map((d) => ({
      ...d,
      key: uid('d_'),
      accountId: d.accountId || defaultAccountId,
      done: false,
    }))
  }

  const cardsReply = (cards: Draft[], lead?: string): string => {
    const missingAmount = cards.filter((c) => !c.amount).length
    if (lead) return missingAmount > 0 ? `${lead}（${missingAmount} 笔还差金额）` : lead
    return missingAmount > 0
      ? `识别到 ${cards.length} 笔，其中 ${missingAmount} 笔还差金额，补上就能入账。`
      : `识别到 ${cards.length} 笔，核对一下：`
  }

  const aiHint = (e: unknown): string => {
    if (!(e instanceof AiError)) return 'AI 没接上，先用本地识别试了试：'
    switch (e.kind) {
      case 'auth':
        return 'API Key 好像不对，先去「我的 → 设置」里改一下。这句先用本地识别：'
      case 'quota':
        return 'DeepSeek 账户余额不足，充完就能用。这句先用本地识别：'
      case 'rate':
        return '请求有点频繁，缓一下再试。这句先用本地识别：'
      case 'network':
        return '网络没通，这句先用本地识别：'
      default:
        return 'AI 这次没返回可用的结果，先用本地识别：'
    }
  }

  /**
   * 按住说话：边听边把识别结果写进输入框，停手就用这句话直接发出去。
   * 之所以「停手即发送」而不是「填好再点发送」——对话记账本来就是一句话的事，
   * 多说一次点击没意义。
   */
  const toggleMic = async () => {
    if (thinking) return

    if (listening) {
      setListening(false)
      await stopListening()
      return
    }

    setListening(true)
    let got = ''

    await startListening((r) => {
      if (r.text) {
        got = r.text
        setText(r.text)
      }
      if (r.final) {
        setListening(false)
        void stopListening().then(() => {
          if (got.trim()) void send(got)
          else if (!r.text) toast('没听清，再说一次试试')
        })
      }
    })
  }

  const send = async (raw?: string) => {
    const input = (raw ?? text).trim()
    if (!input || thinking) return
    setText('')
    push({ id: uid('m_'), role: 'user', text: input, at: Date.now() })

    const config = cfg ?? (await loadAiConfig())

    if (!aiReady(config)) {
      // 没配 Key：本地规则，并提示可以开 AI
      const cards = localParse(input)
      if (!cards.length) {
        push({
          id: uid('m_'),
          role: 'bot',
          text: '这句我没抓到金额或分类。试着带上「多少钱」和「买了什么」，例如「奶茶 18 微信」。',
          at: Date.now(),
        })
        return
      }
      push({
        id: uid('m_'),
        role: 'bot',
        text: cardsReply(cards),
        drafts: cards,
        at: Date.now(),
      })
      return
    }

    setThinking(true)
    try {
      const { reply, drafts } = await askAi(
        input,
        {
          categories,
          accounts: activeAccounts,
          transactions,
          accountBalances,
          defaultAccount: activeAccounts.find((a) => a.id === defaultAccountId)?.name,
        },
        config,
      )

      const cards: Draft[] = drafts.map((d) => ({
        ...d,
        key: uid('d_'),
        accountId: d.accountId || defaultAccountId,
        done: false,
      }))

      if (!cards.length) {
        push({
          id: uid('m_'),
          role: 'bot',
          text: reply || '这句里没看到要记的账。要记的话跟我说「花了多少钱、买了什么」。',
          at: Date.now(),
        })
        return
      }

      push({
        id: uid('m_'),
        role: 'bot',
        text: reply || cardsReply(cards),
        drafts: cards,
        at: Date.now(),
      })
    } catch (e) {
      const cards = localParse(input)
      const hint = aiHint(e)
      if (!cards.length) {
        push({
          id: uid('m_'),
          role: 'bot',
          text: hint + '\n也没从这句话里抓到金额，试着说「奶茶 18 微信」。',
          at: Date.now(),
        })
        return
      }
      push({
        id: uid('m_'),
        role: 'bot',
        text: hint,
        drafts: cards,
        at: Date.now(),
      })
    } finally {
      setThinking(false)
    }
  }

  const patchDraft = (msgId: string, key: string, patch: Partial<Draft>) => {
    setMsgs((prev) =>
      prev.map((m) =>
        m.id !== msgId || !m.drafts
          ? m
          : {
              ...m,
              drafts: m.drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)),
            },
      ),
    )
  }

  const closeSheet = () => setEditing(null)

  const openField = (msgId: string, d: Draft, field: Field) => {
    setEditing({ msgId, key: d.key, field })
    if (field === 'amount') setAmountDraft(fenToYuanInput(d.amount))
  }

  /** 把卡片写进账本，成功返回写入的 id */
  const persist = async (list: Draft[]): Promise<string[]> => {
    const ids: string[] = []
    const now = Date.now()
    for (const d of list) {
      const id = uid('t_')
      await db.transactions.put({
        id,
        type: d.type,
        amount: d.amount,
        categoryId: d.type === 'transfer' ? 'c_transfer' : d.categoryId,
        accountId: d.accountId,
        toAccountId: d.type === 'transfer' ? d.toAccountId : undefined,
        note: d.note?.trim() || undefined,
        date: d.date,
        time: d.time,
        createdAt: now + ids.length,
        updatedAt: now + ids.length,
      })
      ids.push(id)
    }
    return ids
  }

  const ready = (d: Draft) =>
    d.amount > 0 &&
    Boolean(d.accountId) &&
    (d.type === 'transfer' ? Boolean(d.toAccountId) : Boolean(d.categoryId))

  const commitMessage = async (msg: Msg) => {
    const list = (msg.drafts ?? []).filter((d) => !d.done)
    const ok = list.filter(ready)
    if (!ok.length) {
      toast('还有卡片缺金额或分类')
      return
    }
    const ids = await persist(ok)
    const total = ok.reduce((s, d) => s + d.amount, 0)
    const keys = ok.map((d) => d.key)
    const keySet = new Set(keys)
    setMsgs((prev) =>
      prev.map((m) =>
        m.id === msg.id && m.drafts
          ? { ...m, drafts: m.drafts.map((d) => (keySet.has(d.key) ? { ...d, done: true } : d)) }
          : m,
      ),
    )
    push({
      id: uid('m_'),
      role: 'bot',
      text: ok.length > 1
        ? `已入账 ${ok.length} 笔，合计 ¥${money(total)}`
        : `已入账 ¥${money(total)}`,
      commit: { ids, keys, total, count: ok.length },
      at: Date.now(),
    })
  }

  const commitOne = async (msg: Msg, d: Draft) => {
    if (!ready(d)) {
      toast('这张卡片还缺金额或分类')
      return
    }
    const ids = await persist([d])
    patchDraft(msg.id, d.key, { done: true })
    push({
      id: uid('m_'),
      role: 'bot',
      text: `已入账 ¥${money(d.amount)}`,
      commit: { ids, keys: [d.key], total: d.amount, count: 1 },
      at: Date.now(),
    })
  }

  const undo = async (msg: Msg) => {
    const commit = msg.commit
    if (!commit || msg.undone) return
    await db.transactions.bulkDelete(commit.ids)
    const keySet = new Set(commit.keys)
    setMsgs((prev) =>
      prev.map((m) => {
        if (m.id === msg.id) return { ...m, undone: true }
        if (!m.drafts) return m
        // 把被撤销的卡片放回「待确认」，用户可以改完再记
        return {
          ...m,
          drafts: m.drafts.map((d) => (keySet.has(d.key) ? { ...d, done: false } : d)),
        }
      }),
    )
    toast(`已撤销 ${commit.count} 笔`)
  }

  const reset = () => {
    setMsgs([WELCOME])
    saveMessages([WELCOME])
  }

  const editingDraft = useMemo(() => {
    if (!editing) return null
    const msg = msgs.find((m) => m.id === editing.msgId)
    return msg?.drafts?.find((d) => d.key === editing.key) ?? null
  }, [editing, msgs])

  return (
    <div className="page chat-page" style={{ paddingBottom: kbPad ? kbPad + 108 : undefined }}>
      <header className="topbar">
        <div className="row" style={{ gap: 4, alignItems: 'center' }}>
          <button className="icon-btn" onClick={back} aria-label="返回">
            <IconChevronLeft size={19} />
          </button>
          <div>
            <h1 style={{ fontSize: 20 }}>对话记账</h1>
            <div className="sub">
              {aiReady(cfg) ? 'AI 在听，随便说' : '本地识别 · 设置里可接 AI'}
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: 2 }}>
          {!aiReady(cfg) && (
            <button
              className="icon-btn"
              onClick={() => navigate('/settings')}
              aria-label="设置 AI"
              title="接入 AI"
            >
              <IconGear size={17} />
            </button>
          )}
          <button className="icon-btn" onClick={reset} aria-label="清空对话">
            <IconTrash size={16} />
          </button>
        </div>
      </header>

      <div className="chat-log">
        {msgs.map((m) => (
          <div key={m.id} className={'chat-msg ' + m.role}>
            {m.role === 'bot' && (
              <span className="chat-avatar">
                <AppIcon name="receipt" size={15} />
              </span>
            )}
            <div className="chat-col">
              <div className="bubble">{m.text}</div>

              {m.drafts?.map((d) => {
                const cat = catMap.get(d.categoryId)
                const acc = accMap.get(d.accountId)
                const toAcc = d.toAccountId ? accMap.get(d.toAccountId) : undefined
                const isTransfer = d.type === 'transfer'
                return (
                  <div key={d.key} className={'draft-card' + (d.done ? ' done' : '')}>
                    <div className="draft-head">
                      <span
                        className="cat-icon"
                        style={{
                          background: (cat?.color ?? '#9C86C9') + '1f',
                          color: cat?.color ?? '#9C86C9',
                        }}
                      >
                        <AppIcon
                          name={isTransfer ? 'arrow-left-right' : (cat?.icon ?? 'package')}
                          size={18}
                          color={cat?.color ?? '#9C86C9'}
                        />
                      </span>
                      {isTransfer ? (
                        <span className="draft-title">
                          {acc?.name ?? '账户'} → {toAcc?.name ?? '账户'}
                          <span className="draft-type">转账</span>
                        </span>
                      ) : (
                        <button
                          className="draft-title as-btn"
                          onClick={() => openField(m.id, d, 'category')}
                        >
                          {cat?.name ?? '选分类'}
                          <span className="draft-type">
                            {d.type === 'income' ? '收入' : '支出'}
                          </span>
                          <span className="draft-caret">▾</span>
                        </button>
                      )}
                      <button
                        className={
                          'draft-amount' + (d.amount ? '' : ' empty')
                        }
                        onClick={() => openField(m.id, d, 'amount')}
                      >
                        {d.amount ? `¥${money(d.amount)}` : '填金额'}
                      </button>
                    </div>

                    <div className="draft-fields">
                      <button className="chip" onClick={() => openField(m.id, d, 'account')}>
                        <span className="em">
                          <AppIcon name={acc?.icon ?? 'credit-card'} size={14} color={acc?.color} />
                        </span>
                        {acc?.name ?? '选账户'}
                      </button>
                      {isTransfer && (
                        <button className="chip" onClick={() => openField(m.id, d, 'toAccount')}>
                          <span className="em">→</span>
                          {toAcc?.name ?? '转入账户'}
                        </button>
                      )}
                      <button className="chip" onClick={() => openField(m.id, d, 'date')}>
                        <IconCalendar size={12} />
                        {formatDateLabel(d.date)}
                      </button>
                    </div>

                    {!d.done && (
                      <input
                        className="draft-note"
                        placeholder="+ 备注，直接写"
                        value={d.note ?? ''}
                        onFocus={revealField}
                        onChange={(e) =>
                          patchDraft(m.id, d.key, { note: e.target.value || undefined })
                        }
                      />
                    )}
                    {d.done && d.note && (
                      <div className="draft-note-ro">
                        <AppIcon name="notebook-pen" size={12} /> {d.note}
                      </div>
                    )}

                    {!d.done && (
                      <div className="draft-actions">
                        {!ready(d) && (
                          <span className="draft-warn">
                            {d.amount ? '还缺账户或分类' : '还缺金额'}
                          </span>
                        )}
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => commitOne(m, d)}
                          disabled={!ready(d)}
                        >
                          只记这笔
                        </button>
                      </div>
                    )}
                    {d.done && <div className="draft-warn">已入账</div>}
                  </div>
                )
              })}

              {m.commit && (
                <div className="chat-commit">
                  <span>✓ {m.undone ? '已撤销' : '记账完成'}</span>
                  {!m.undone && (
                    <button className="link-btn" onClick={() => undo(m)}>
                      撤销
                    </button>
                  )}
                </div>
              )}

              {m.drafts && m.drafts.some((d) => !d.done) && (() => {
                const pending = m.drafts.filter((d) => !d.done)
                const okCount = pending.filter(ready).length
                return (
                  <div className="row" style={{ gap: 8, marginTop: 8 }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => commitMessage(m)}
                      disabled={!okCount}
                    >
                      {okCount === pending.length
                        ? `全部入账（${okCount}）`
                        : `先记这 ${okCount} 笔`}
                    </button>
                    <button className="btn btn-ghost" onClick={() => navigate('/add')}>
                      手动记
                    </button>
                  </div>
                )
              })()}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="chat-msg bot">
            <span className="chat-avatar">
              <AppIcon name="receipt" size={15} />
            </span>
            <div className="chat-col">
              <div className="bubble typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {msgs.length <= 1 && (
        <div className="chat-chips">
          {CHAT_EXAMPLES.map((e) => (
            <button key={e} className="pill" onClick={() => send(e)}>
              {e}
            </button>
          ))}
        </div>
      )}

      <div className="chat-input-bar" style={kbPad ? { bottom: kbPad } : undefined}>
        {micOk && (
          <button
            className={'chat-mic' + (listening ? ' on' : '')}
            onClick={() => void toggleMic()}
            disabled={thinking}
            aria-label={listening ? '停止说话' : '语音输入'}
            title={listening ? '说完了，点一下结束' : '语音输入'}
          >
            <IconMic size={18} />
            {listening && <span className="chat-mic-wave" />}
          </button>
        )}
        <div className="chat-input">
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            placeholder={
              listening ? '听着呢，说完点一下麦克风…' : thinking ? '正在想…' : '例如：昨天午饭 25 微信'
            }
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
          />
          {text && (
            <button className="icon-btn" onClick={() => setText('')} aria-label="清空输入">
              <IconClose size={15} />
            </button>
          )}
        </div>
        <button
          className="chat-send"
          onClick={() => send()}
          disabled={!text.trim() || thinking || listening}
          aria-label="发送"
        >
          {thinking ? <span className="spinner" /> : <IconArrowUp size={17} strokeWidth={2.4} />}
        </button>
      </div>

      {editing && editingDraft && (
        <Sheet
          title={SHEET_TITLE[editing.field]}
          onClose={closeSheet}
        >
          {editing.field === 'account' && (
            <div className="acc-list" style={{ paddingBottom: 8 }}>
              {activeAccounts.map((a) => (
                <button
                  key={a.id}
                  className="acc-row"
                  onClick={() => {
                    patchDraft(editing.msgId, editing.key, { accountId: a.id, guessedAccount: false })
                    closeSheet()
                  }}
                  style={
                    a.id === editingDraft.accountId
                      ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' }
                      : undefined
                  }
                >
                  <span className="cat-icon" style={{ background: a.color + '1f' }}>
                    <AppIcon name={a.icon} size={17} color={a.color} />
                  </span>
                  <span style={{ flex: 1, textAlign: 'left' }} className="nm">
                    {a.name}
                  </span>
                  {a.id === editingDraft.accountId && <span className="chip">当前</span>}
                </button>
              ))}
            </div>
          )}

          {editing.field === 'toAccount' && (
            <div className="acc-list" style={{ paddingBottom: 8 }}>
              {activeAccounts
                .filter((a) => a.id !== editingDraft.accountId)
                .map((a) => (
                  <button
                    key={a.id}
                    className="acc-row"
                    onClick={() => {
                      patchDraft(editing.msgId, editing.key, { toAccountId: a.id })
                      closeSheet()
                    }}
                    style={
                      a.id === editingDraft.toAccountId
                        ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' }
                        : undefined
                    }
                  >
                    <span className="cat-icon" style={{ background: a.color + '1f' }}>
                      <AppIcon name={a.icon} size={17} color={a.color} />
                    </span>
                    <span style={{ flex: 1, textAlign: 'left' }} className="nm">
                      {a.name}
                    </span>
                    {a.id === editingDraft.toAccountId && <span className="chip">当前</span>}
                  </button>
                ))}
            </div>
          )}

          {editing.field === 'category' && (
            <div className="cat-grid">
              {categories
                .filter(
                  (c) => c.type === (editingDraft.type === 'income' ? 'income' : 'expense') && !c.archived,
                )
                .map((c) => (
                  <button
                    key={c.id}
                    className={'cat-cell' + (c.id === editingDraft.categoryId ? ' sel' : '')}
                    style={{
                      ['--cat-color' as string]: c.color,
                      ['--tint' as string]: c.color + '1f',
                    }}
                    onClick={() => {
                      patchDraft(editing.msgId, editing.key, {
                        categoryId: c.id,
                        guessedCategory: false,
                      })
                      closeSheet()
                    }}
                  >
                    <span
                      className="box"
                      style={c.id === editingDraft.categoryId ? { background: c.color } : undefined}
                    >
                      <AppIcon
                        name={c.icon}
                        size={18}
                        color={c.id === editingDraft.categoryId ? '#fff' : c.color}
                      />
                    </span>
                    <span className="nm">{c.name}</span>
                  </button>
                ))}
            </div>
          )}

          {editing.field === 'amount' && (
            <>
              <input
                className="field"
                style={{ textAlign: 'left', fontSize: 18, width: '100%' }}
                inputMode="decimal"
                placeholder="0.00"
                value={amountDraft}
                autoFocus
                onChange={(e) => setAmountDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  patchDraft(editing.msgId, editing.key, { amount: parseAmount(amountDraft) })
                  closeSheet()
                }}
              />
              <button
                className="btn btn-primary btn-block"
                style={{ marginTop: 10 }}
                onClick={() => {
                  patchDraft(editing.msgId, editing.key, { amount: parseAmount(amountDraft) })
                  closeSheet()
                }}
              >
                确定
              </button>
            </>
          )}

          {editing.field === 'date' && (
            <>
              <input
                type="date"
                value={editingDraft.date}
                className="field"
                style={{ textAlign: 'left', fontSize: 16, width: '100%' }}
                onChange={(e) =>
                  patchDraft(editing.msgId, editing.key, { date: e.target.value })
                }
              />
              <div className="pill-row" style={{ marginTop: 6 }}>
                {[0, 1, 2, 3].map((d) => {
                  const v = dayjs().subtract(d, 'day').format('YYYY-MM-DD')
                  return (
                    <button
                      key={d}
                      className={'pill' + (editingDraft.date === v ? ' active' : '')}
                      onClick={() => patchDraft(editing.msgId, editing.key, { date: v })}
                    >
                      {formatDateLabel(v)}
                    </button>
                  )
                })}
              </div>
              <div className="field" style={{ marginTop: 6 }}>
                <span className="lbl">时间</span>
                <input
                  type="time"
                  value={editingDraft.time ?? ''}
                  onChange={(e) =>
                    patchDraft(editing.msgId, editing.key, { time: e.target.value || undefined })
                  }
                />
              </div>
              <button
                className="btn btn-primary btn-block"
                style={{ marginTop: 10 }}
                onClick={closeSheet}
              >
                完成
              </button>
            </>
          )}

        </Sheet>
      )}

    </div>
  )
}

type Field = 'amount' | 'category' | 'account' | 'toAccount' | 'date'

const SHEET_TITLE: Record<Field, string> = {
  amount: '金额',
  category: '选择分类',
  account: '选择账户',
  toAccount: '转入账户',
  date: '选择日期',
}
