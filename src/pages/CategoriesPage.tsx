import { useCallback, useMemo, useState } from 'react'
import { db } from '../db'
import { useApp } from '../lib/store'
import { useDragReorder } from '../lib/dragReorder'
import { IconChevronLeft, IconPlus } from '../components/Icons'
import CategoryEditor from '../components/CategoryEditor'
import { AppIcon } from '../lib/appIcons'
import type { Category } from '../db/types'

/** 拖动柄：两列小圆点，只在这里按下才能排序，避免整行拖动时和页面滚动打架 */
function GripIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="6" cy="3" r="1.3" />
      <circle cx="10" cy="3" r="1.3" />
      <circle cx="6" cy="8" r="1.3" />
      <circle cx="10" cy="8" r="1.3" />
      <circle cx="6" cy="13" r="1.3" />
      <circle cx="10" cy="13" r="1.3" />
    </svg>
  )
}

export default function CategoriesPage({ back }: { back: () => void }) {
  const { categories, toast } = useApp()
  const [tab, setTab] = useState<'expense' | 'income'>('expense')
  const [editing, setEditing] = useState<Category | 'new' | null>(null)

  const list = useMemo(() => categories.filter((c) => c.type === tab), [categories, tab])
  const ids = useMemo(() => list.map((c) => c.id), [list])

  const commitOrder = useCallback(async (order: string[]) => {
    await db.transaction('rw', db.categories, async () => {
      for (let i = 0; i < order.length; i += 1) {
        await db.categories.update(order[i], { order: i + 1 })
      }
    })
  }, [])

  const { order, dragId, onPointerDown, wasDragging } = useDragReorder({
    ids,
    onCommit: commitOrder,
  })

  const ordered = useMemo(() => {
    const byId = new Map(list.map((c) => [c.id, c]))
    const arr: Category[] = []
    order.forEach((id) => {
      const c = byId.get(id)
      if (c) {
        arr.push(c)
        byId.delete(id)
      }
    })
    byId.forEach((c) => arr.push(c))
    return arr
  }, [list, order])

  return (
    <div className="page">
      <header className="topbar">
        <div className="row" style={{ gap: 4 }}>
          <button className="back-btn" onClick={back}>
            <IconChevronLeft size={18} />
          </button>
          <h1>分类</h1>
        </div>
        <button className="icon-btn" onClick={() => setEditing('new')} aria-label="新建分类">
          <IconPlus size={19} />
        </button>
      </header>

      <div className="segmented" style={{ marginBottom: 12 }}>
        <button className={tab === 'expense' ? 'active' : ''} onClick={() => setTab('expense')}>
          支出分类
        </button>
        <button className={tab === 'income' ? 'active' : ''} onClick={() => setTab('income')}>
          收入分类
        </button>
      </div>

      <div className="small muted" style={{ padding: '0 6px 8px' }}>
        拖动右侧的手柄可以调整顺序
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {ordered.map((c, i) => (
          <div
            key={c.id}
            className={'list-row' + (dragId === c.id ? ' dragging' : '')}
            data-drag-id={c.id}
            style={{ borderTop: i === 0 ? 'none' : undefined, cursor: 'pointer' }}
            onClick={() => {
              if (wasDragging()) return
              setEditing(c)
            }}
          >
            <span className="cat-icon" style={{ background: c.color + '1f' }}>
              <AppIcon name={c.icon} size={18} color={c.color} />
            </span>
            <span className="lbl">{c.name}</span>
            <button
              className="drag-handle"
              aria-label={`拖动 ${c.name} 排序`}
              onPointerDown={(e) => {
                e.stopPropagation()
                onPointerDown(c.id, e)
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <GripIcon />
            </button>
          </div>
        ))}
      </div>

      {editing && (
        <CategoryEditor
          cat={editing === 'new' ? null : editing}
          type={tab}
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
