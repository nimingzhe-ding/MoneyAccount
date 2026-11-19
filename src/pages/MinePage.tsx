import { useMemo } from 'react'
import dayjs from 'dayjs'
import { useApp } from '../lib/store'
import { moneySigned } from '../lib/format'
import {
  IconChevronRight,
  IconChart,
  IconRepeat,
  IconTransfer,
  IconWallet,
  IconGear,
} from '../components/Icons'
import { AppIcon } from '../lib/appIcons'

export default function MinePage({ navigate }: { navigate: (to: string) => void }) {
  const { transactions, accounts, accountBalances, categories, recurring } = useApp()

  const stats = useMemo(() => {
    const total = transactions.length
    const days = new Set(transactions.map((t) => t.date))
    const month = dayjs().format('YYYY-MM')
    let monthCount = 0
    transactions.forEach((t) => {
      if (t.date.startsWith(month)) monthCount++
    })
    let netWorth = 0
    accounts.forEach((a) => {
      netWorth += accountBalances.get(a.id) ?? 0
    })
    return { total, days: days.size, monthCount, netWorth }
  }, [transactions, accounts, accountBalances])

  const entries = [
    {
      icon: <AppIcon name="message-circle" size={18} />,
      label: '对话记账',
      value: '一句话入账',
      to: '/chat',
      color: '#D97F35',
    },
    {
      icon: <AppIcon name="calendar" size={18} />,
      label: '记账日历',
      value: '按月看每天',
      to: '/calendar',
      color: '#DFA84F',
    },
    {
      icon: <IconWallet size={18} />,
      label: '账户管理',
      value: `${accounts.length} 个账户`,
      to: '/accounts',
      color: '#4E9E6B',
    },
    {
      icon: <IconChart size={18} />,
      label: '预算管理',
      value: '',
      to: '/budget',
      color: '#D99A3D',
    },
    {
      icon: <IconRepeat size={18} />,
      label: '周期账单',
      value: `${recurring.filter((r) => r.enabled).length} 条启用`,
      to: '/recurring',
      color: '#6E92C4',
    },
    {
      icon: <AppIcon name="shapes" size={18} />,
      label: '分类管理',
      value: `${categories.length} 个`,
      to: '/categories',
      color: '#9C86C9',
    },
    {
      icon: <IconGear size={18} />,
      label: '设置',
      value: '',
      to: '/settings',
      color: '#A2968A',
    },
  ]

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>我的</h1>
          <div className="sub">数据保存在本机，安全私密</div>
        </div>
      </header>

      <div className="card card-pad" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 17,
            background: 'linear-gradient(145deg,#f5c463,#d8902c)',
            boxShadow: '0 8px 18px -10px rgba(208,144,44,.85)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <AppIcon name="piggy-bank" size={27} color="#3A2410" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>我的小金库</div>
          <div className="small muted">
            已记录 {stats.total} 笔 · 记账 {stats.days} 天
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="small muted" style={{ fontSize: 11 }}>净资产</div>
          <div className="big-num" style={{ fontSize: 16, fontWeight: 600 }}>
            {moneySigned(stats.netWorth)}
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 10 }}>
        <div className="card card-pad" style={{ padding: '13px 14px' }}>
          <div className="small muted">本月记录</div>
          <div className="big-num" style={{ fontSize: 20, fontWeight: 600, marginTop: 1 }}>
            {stats.monthCount}
            <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 3, fontWeight: 400 }}>笔</span>
          </div>
        </div>
        <div className="card card-pad" style={{ padding: '13px 14px' }}>
          <div className="small muted">累计记账</div>
          <div className="big-num" style={{ fontSize: 20, fontWeight: 600, marginTop: 1 }}>
            {stats.total}
            <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 3, fontWeight: 400 }}>笔</span>
          </div>
        </div>
      </div>

      <section className="section">
        <div className="card" style={{ overflow: 'hidden' }}>
          {entries.map((e, i) => (
            <button
              key={e.label}
              className="list-row"
              onClick={() => navigate(e.to)}
              style={{ borderTop: i === 0 ? 'none' : undefined }}
            >
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  display: 'grid',
                  placeItems: 'center',
                  background: e.color + '1a',
                  color: e.color,
                  fontSize: 16,
                }}
              >
                {e.icon}
              </span>
              <span className="lbl">{e.label}</span>
              <span className="val" style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-3)', fontSize: 12.5 }}>
                {e.value}
              </span>
              <IconChevronRight size={16} className="chev" />
            </button>
          ))}
        </div>
      </section>

      <div className="row" style={{ justifyContent: 'center', marginTop: 24, gap: 6, color: 'var(--text-3)', fontSize: 11 }}>
        <IconTransfer size={12} />
        随手记 v{__APP_VERSION__} · 数据仅存于本机
      </div>
    </div>
  )
}
