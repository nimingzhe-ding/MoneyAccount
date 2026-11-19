import { useEffect, useRef, useState } from 'react'
import { db } from '../db'
import { useApp } from '../lib/store'
import { saveTextFile, openExternal } from '../lib/native'
import { RELEASES_URL } from '../lib/update'
import {
  buildBackup,
  backupToCsv,
  parseBackup,
  applyBackup,
} from '../lib/backup'
import {
  FILE_PATH_HINT,
  getLastSave,
  onSaved,
  flushSave,
  listArchives,
  readArchive,
  currentDirLabel,
  hasFileAccess,
  requestFileAccess,
  retryAfterPermission,
  isNativePlatform,
  type SaveState,
} from '../lib/datafile'
import Sheet from '../components/Sheet'
import {
  AI_MODELS,
  aiReady,
  loadAiConfig,
  saveAiConfig,
  testAi,
  AiError,
  type AiConfig,
} from '../lib/ai'
import {
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconTrash,
  IconUpload,
} from '../components/Icons'
import { AppIcon } from '../lib/appIcons'

export default function SettingsPage({
  back,
  navigate,
}: {
  back: () => void
  navigate: (to: string) => void
}) {
  const { theme, setTheme, transactions, accounts, categories, recurring, toast, update } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [importing, setImporting] = useState(false)
  const [saveState, setSaveState] = useState<SaveState | null>(getLastSave())
  const [archives, setArchives] = useState<{ name: string; size: number; mtime: number }[]>([])
  const [showArchives, setShowArchives] = useState(false)
  const [dirLabel, setDirLabel] = useState(FILE_PATH_HINT)
  const [access, setAccess] = useState(true)
  const [showAi, setShowAi] = useState(false)
  const [aiCfg, setAiCfg] = useState<AiConfig>({
    apiKey: '',
    model: AI_MODELS[0].id,
    enabled: true,
  })

  useEffect(() => {
    void loadAiConfig().then(setAiCfg)
  }, [])

  useEffect(() => {
    const off = onSaved(setSaveState)
    void listArchives().then(setArchives)
    if (isNativePlatform) {
      void currentDirLabel().then(setDirLabel).catch(() => {})
      void hasFileAccess().then(setAccess)
    }
    return off
  }, [])

  const onCheckUpdate = () => {
    if (update.checking) return
    void update.refresh(true)
  }

  /** 立刻把当前数据写进手机文件，并刷新界面上的状态 */
  const saveNow = async () => {
    await flushSave()
    setSaveState(getLastSave())
    setArchives(await listArchives())
    toast('已保存到数据文件')
  }

  const exportJson = async () => {
    const data = await buildBackup()
    await saveTextFile(
      `随手记备份-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(data, null, 2),
      'application/json',
    )
    toast('已导出备份文件')
  }

  const exportCsv = async () => {
    const data = await buildBackup()
    await saveTextFile(
      `随手记明细-${new Date().toISOString().slice(0, 10)}.csv`,
      backupToCsv(data),
      'text/csv;charset=utf-8',
    )
    toast('已导出 CSV')
  }

  const doImport = async (file: File) => {
    try {
      setImporting(true)
      const text = await file.text()
      const data = parseBackup(text)
      if (!data) {
        toast('文件格式不正确')
        return
      }
      await applyBackup(data)
      await flushSave()
      toast(`已恢复 ${data.transactions.length} 笔记录`)
    } catch {
      toast('导入失败，请检查文件')
    } finally {
      setImporting(false)
    }
  }

  const restoreArchive = async (name: string) => {
    const data = await readArchive(name)
    if (!data) {
      toast('这份留档读不出来')
      return
    }
    await applyBackup(data)
    await flushSave()
    setShowArchives(false)
    toast(`已回滚到 ${name.replace('.json', '')} 的数据`)
  }

  const clearAll = async () => {
    await db.transactions.clear()
    await flushSave()
    setConfirmClear(false)
    toast('已清空全部记账')
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="row" style={{ gap: 4 }}>
          <button className="back-btn" onClick={back}>
            <IconChevronLeft size={18} />
          </button>
          <h1>设置</h1>
        </div>
      </header>

      <section>
        <div className="section-head">
          <h2>外观</h2>
        </div>
        <div className="card card-pad">
          <div className="segmented" style={{ width: '100%' }}>
            {(
              [
                ['auto', '跟随系统'],
                ['light', '浅色'],
                ['dark', '深色'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                className={theme === k ? 'active' : ''}
                style={{ flex: 1 }}
                onClick={() => setTheme(k)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>数据文件</h2>
        </div>
        <div className="card card-pad">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>
                {saveState ? `已存 ${saveState.count} 笔` : '还没有写入文件'}
              </div>
              <div className="small muted" style={{ marginTop: 3 }}>
                {saveState
                  ? `上次保存 ${new Date(saveState.at).toLocaleString('zh-CN', { hour12: false })}`
                  : '记一笔后会自动写入'}
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={saveNow}>
              立即保存
            </button>
          </div>
          <div
            className="mono small"
            style={{
              marginTop: 12,
              padding: '9px 11px',
              borderRadius: 12,
              background: 'var(--surface-3)',
              color: 'var(--text-2)',
              wordBreak: 'break-all',
              lineHeight: 1.5,
            }}
          >
            {dirLabel}
          </div>
          <div className="small muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
            每次记账都会自动写进这个文件；换手机、清应用数据都不会丢。
            手机上用「文件」App 就能看到，插电脑也能直接拷走。
          </div>
          {isNativePlatform && !access && (
            <div
              style={{
                marginTop: 12,
                padding: '11px 12px',
                borderRadius: 13,
                background: 'color-mix(in srgb, var(--negative) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--negative) 30%, transparent)',
              }}
            >
              <div style={{ fontSize: 13.5, color: 'var(--negative)', fontWeight: 600 }}>
                还没允许访问文件
              </div>
              <div className="small muted" style={{ marginTop: 4, lineHeight: 1.6 }}>
                没有这个权限，账本只能存在应用内部，清除数据后会读不回来。
              </div>
              <button
                className="btn btn-primary btn-sm"
                style={{ marginTop: 9 }}
                onClick={async () => {
                  await requestFileAccess()
                  const ok = await hasFileAccess()
                  if (ok) await retryAfterPermission()
                  setAccess(ok)
                  setDirLabel(await currentDirLabel())
                  toast(ok ? '已允许访问文件' : '请在系统设置里手动开启')
                }}
              >
                去开启
              </button>
            </div>
          )}
        </div>

        <button className="list-row card" style={{ marginTop: 10 }} onClick={async () => {
          setArchives(await listArchives())
          setShowArchives(true)
        }}>
          <span style={{ color: 'var(--text-2)' }}><IconDownload size={17} /></span>
          <span className="lbl">历史留档</span>
          <span className="val" style={{ fontFamily: 'var(--font-sans)' }}>{archives.length} 份</span>
          <IconChevronRight size={16} className="chev" />
        </button>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>数据</h2>
        </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          <button className="list-row" onClick={exportJson}>
            <span style={{ color: 'var(--accent-text)' }}><IconDownload size={17} /></span>
            <span className="lbl">导出备份（JSON）</span>
            <span className="val" style={{ fontFamily: 'var(--font-sans)' }}>{transactions.length} 笔</span>
            <IconChevronRight size={16} className="chev" />
          </button>
          <button className="list-row" onClick={exportCsv}>
            <span style={{ color: 'var(--positive)' }}><IconDownload size={17} /></span>
            <span className="lbl">导出表格（CSV）</span>
            <IconChevronRight size={16} className="chev" />
          </button>
          <button className="list-row" onClick={() => fileRef.current?.click()}>
            <span style={{ color: 'var(--text-2)' }}><IconUpload size={17} /></span>
            <span className="lbl">{importing ? '正在导入…' : '从备份恢复'}</span>
            <IconChevronRight size={16} className="chev" />
          </button>
          <button className="list-row" onClick={() => setConfirmClear(true)}>
            <span style={{ color: 'var(--negative)' }}><IconTrash size={17} /></span>
            <span className="lbl danger">清空全部记账</span>
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) doImport(f)
            e.target.value = ''
          }}
        />
        <div className="small muted" style={{ padding: '9px 4px 0' }}>
          恢复会覆盖当前全部数据，建议先导出备份。
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>管理</h2>
        </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          <button className="list-row" onClick={() => navigate('/categories')}>
            <AppIcon name="tags" size={18} color="var(--text-2)" />
            <span className="lbl">分类管理</span>
            <span className="val" style={{ fontFamily: 'var(--font-sans)' }}>{categories.length} 个</span>
            <IconChevronRight size={16} className="chev" />
          </button>
          <button className="list-row" onClick={() => navigate('/accounts')}>
            <AppIcon name="credit-card" size={18} color="var(--text-2)" />
            <span className="lbl">账户管理</span>
            <span className="val" style={{ fontFamily: 'var(--font-sans)' }}>{accounts.length} 个</span>
            <IconChevronRight size={16} className="chev" />
          </button>
          <button className="list-row" onClick={() => navigate('/recurring')}>
            <AppIcon name="calendar-clock" size={18} color="var(--text-2)" />
            <span className="lbl">周期账单</span>
            <span className="val" style={{ fontFamily: 'var(--font-sans)' }}>{recurring.length} 条</span>
            <IconChevronRight size={16} className="chev" />
          </button>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>AI 记账</h2>
          <span className="more">{aiReady(aiCfg) ? '已开启' : '未配置'}</span>
        </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          <button className="list-row" onClick={() => setShowAi(true)}>
            <span className="lbl">模型服务</span>
            <span className="val" style={{ fontFamily: 'var(--font-sans)' }}>
              {aiCfg.apiKey ? AI_MODELS.find((m) => m.id === aiCfg.model)?.label ?? aiCfg.model : '还没填 API Key'}
            </span>
            <IconChevronRight size={16} className="chev" />
          </button>
          <div className="list-row" style={{ alignItems: 'flex-start' }}>
            <span className="lbl">用途</span>
            <span
              className="val"
              style={{ fontFamily: 'var(--font-sans)', textAlign: 'right', lineHeight: 1.5, fontSize: 12 }}
            >
              只说「昨天午饭 25 微信」这类话，<br />
              帮你拆成分类和账户
            </span>
          </div>
        </div>
        <p className="small muted" style={{ padding: '8px 4px 0', lineHeight: 1.6 }}>
          Key 只存在这台手机上。聊天时会把当月支出汇总和分类账户名发给 DeepSeek，不发送单笔明细。
        </p>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>关于</h2>
        </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          <button className="list-row" onClick={onCheckUpdate} disabled={update.checking}>
            <span className="lbl">版本</span>
            <span className="val" style={{ fontFamily: 'var(--font-sans)' }}>
              {update.checking ? '检查中…' : __APP_VERSION__}
              {update.hasUpdate && (
                <span style={{ color: 'var(--accent-text)' }}> · 有新版本</span>
              )}
            </span>
            <IconChevronRight size={16} className="chev" />
          </button>
          <button className="list-row" onClick={() => void openExternal(RELEASES_URL)}>
            <span style={{ color: 'var(--text-2)' }}>
              <IconDownload size={17} />
            </span>
            <span className="lbl">打开发布页</span>
            <IconChevronRight size={16} className="chev" />
          </button>
          <div className="list-row">
            <span className="lbl">数据存储</span>
            <span className="val" style={{ fontFamily: 'var(--font-sans)' }}>
              {isNativePlatform ? '手机文件' : '本机 IndexedDB'}
            </span>
          </div>
          <div className="list-row">
            <span className="lbl">云端同步</span>
            <span className="val" style={{ fontFamily: 'var(--font-sans)' }}>未启用</span>
          </div>
        </div>
        <p className="small muted" style={{ padding: '8px 4px 0', lineHeight: 1.6 }}>
          打开 App 会自动检查一次更新，有新版本首页会直接提示。检查只读版本号，不发送记账数据。
        </p>
      </section>

      {showAi && (
        <AiSettings
          cfg={aiCfg}
          onChange={setAiCfg}
          onClose={() => setShowAi(false)}
        />
      )}

      {showArchives && (
        <Sheet title="历史留档" onClose={() => setShowArchives(false)}>
          <p style={{ color: 'var(--text-2)', fontSize: 13, padding: '0 4px 12px', lineHeight: 1.6 }}>
            每天第一次保存时的自动快照，回滚会覆盖当前数据。
          </p>
          {archives.length === 0 ? (
            <div className="small muted" style={{ padding: '8px 4px 20px' }}>
              还没有留档，明天开始就有了。
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden', maxHeight: 360, overflowY: 'auto' }}>
              {archives.map((a) => (
                <button key={a.name} className="list-row" onClick={() => restoreArchive(a.name)}>
                  <span className="lbl">{a.name.replace('.json', '')}</span>
                  <span className="val" style={{ fontFamily: 'var(--font-sans)' }}>
                    {(a.size / 1024).toFixed(0)} KB
                  </span>
                  <IconChevronRight size={16} className="chev" />
                </button>
              ))}
            </div>
          )}
        </Sheet>
      )}

      <div className="row" style={{ justifyContent: 'center', marginTop: 22 }}>
        <span className="small muted">记账 · 简单一点就好</span>
      </div>

      {confirmClear && (
        <Sheet title="清空全部记账？" onClose={() => setConfirmClear(false)}>
          <p style={{ color: 'var(--text-2)', fontSize: 14, padding: '0 4px 14px', lineHeight: 1.6 }}>
            将删除 <b style={{ color: 'var(--text)' }}>{transactions.length}</b> 笔记录。
            账户、分类和预算会保留。建议先导出备份。
          </p>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-ghost btn-block" onClick={exportJson}>
              先备份
            </button>
            <button
              className="btn btn-danger btn-block"
              onClick={clearAll}
            >
              确认清空
            </button>
          </div>
        </Sheet>
      )}

    </div>
  )
}

/* ------------------------------------------------------------------ */
/* AI 设置                                                              */
/* ------------------------------------------------------------------ */

function AiSettings({
  cfg,
  onChange,
  onClose,
}: {
  cfg: AiConfig
  onChange: (c: AiConfig) => void
  onClose: () => void
}) {
  const [key, setKey] = useState(cfg.apiKey)
  const [model, setModel] = useState(cfg.model)
  const [enabled, setEnabled] = useState(cfg.enabled)
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const dirty =
    key.trim() !== cfg.apiKey || model !== cfg.model || enabled !== cfg.enabled

  const persist = async (patch: Partial<AiConfig>) => {
    const next = await saveAiConfig(patch)
    onChange(next)
  }

  const save = async () => {
    await persist({ apiKey: key.trim(), model, enabled })
    onClose()
  }

  const runTest = async () => {
    if (!key.trim()) {
      setResult({ ok: false, text: '先填 API Key' })
      return
    }
    setTesting(true)
    setResult(null)
    try {
      const reply = await testAi({ apiKey: key.trim(), model, enabled: true })
      setResult({ ok: true, text: `连上了：${reply}` })
    } catch (e) {
      const text =
        e instanceof AiError
          ? e.kind === 'auth'
            ? 'Key 不对，检查一下有没有复制完整'
            : e.kind === 'quota'
              ? '账户余额不足'
              : e.kind === 'rate'
                ? '请求太频繁，等一下再试'
                : e.kind === 'network'
                  ? '网络连不上，或请求超时'
                  : e.message
          : '测试失败'
      setResult({ ok: false, text })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Sheet title="AI 记账" onClose={onClose}>
      <div className="field" style={{ marginBottom: 10 }}>
        <span className="lbl">API Key</span>
        <input
          type="password"
          placeholder="sk-…"
          value={key}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setKey(e.target.value)}
          style={{ textAlign: 'left', fontSize: 14 }}
        />
      </div>
      <p className="small muted" style={{ margin: '0 4px 14px', lineHeight: 1.6 }}>
        在 platform.deepseek.com 的「API Keys」里创建，只存在本机，不会上传到别处。
      </p>

      <div className="lbl" style={{ margin: '0 4px 8px', fontSize: 13 }}>模型</div>
      <div className="card" style={{ overflow: 'hidden', marginBottom: 12 }}>
        {AI_MODELS.length === 1 ? (
          <div className="list-row">
            <span className="lbl" style={{ color: 'var(--text)', fontWeight: 550 }}>
              {AI_MODELS[0].label}
            </span>
            <span className="val" style={{ fontFamily: 'var(--font-sans)', fontSize: 12 }}>
              {AI_MODELS[0].hint}
            </span>
          </div>
        ) : (
          AI_MODELS.map((m) => (
            <button
              key={m.id}
              className="list-row"
              onClick={() => setModel(m.id)}
              style={model === m.id ? { background: 'var(--accent-soft)' } : undefined}
            >
              <span className="lbl" style={{ color: 'var(--text)', fontWeight: 550 }}>{m.label}</span>
              <span className="val" style={{ fontFamily: 'var(--font-sans)', fontSize: 12 }}>
                {m.hint}
              </span>
              {model === m.id && <span className="chip">选中</span>}
            </button>
          ))
        )}
      </div>

      <button
        className="list-row card"
        onClick={() => setEnabled((v) => !v)}
        style={{ marginBottom: 12, width: '100%' }}
      >
        <span className="lbl">启用 AI</span>
        <span className="val" style={{ fontFamily: 'var(--font-sans)' }}>
          {enabled ? '开' : '关（只用本地识别）'}
        </span>
        <span className={'switch' + (enabled ? ' on' : '')} aria-hidden />
      </button>

      {result && (
        <div
          className="small"
          style={{
            margin: '0 4px 12px',
            padding: '10px 12px',
            borderRadius: 'var(--radius-sm)',
            background: result.ok ? 'color-mix(in srgb, var(--positive) 14%, transparent)' : 'color-mix(in srgb, var(--negative) 14%, transparent)',
            color: result.ok ? 'var(--positive)' : 'var(--negative)',
            lineHeight: 1.5,
          }}
        >
          {result.text}
        </div>
      )}

      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-ghost" onClick={runTest} disabled={testing}>
          {testing ? '测试中…' : '测试连接'}
        </button>
        <button className="btn btn-primary" onClick={save} disabled={!dirty && !result}>
          保存
        </button>
      </div>
    </Sheet>
  )
}
