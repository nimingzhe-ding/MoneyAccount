/**
 * 备份数据的读写。
 *
 * 手动导出、数据文件自动保存、从文件恢复都走这里，
 * 保证三条路用的是同一份格式，不会出现「导出的能读、自动存的读不了」。
 */
import { db } from '../db'
import { migrateLegacyIcon } from '../db/iconKeys'
import type { Account, Budget, Category, Recurring, Transaction } from '../db/types'

export const BACKUP_APP = 'money-account'
export const BACKUP_VERSION = 1

export type Backup = {
  app: typeof BACKUP_APP
  version: number
  exportedAt: string
  transactions: Transaction[]
  accounts: Account[]
  categories: Category[]
  budgets: Budget[]
  recurring: Recurring[]
}

export async function buildBackup(): Promise<Backup> {
  const [transactions, accounts, categories, budgets, recurring] = await Promise.all([
    db.transactions.toArray(),
    db.accounts.toArray(),
    db.categories.toArray(),
    db.budgets.toArray(),
    db.recurring.toArray(),
  ])
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    transactions,
    accounts,
    categories,
    budgets,
    recurring,
  }
}

/** 解析并校验备份文本，格式不对返回 null */
export function parseBackup(text: string): Backup | null {
  try {
    const data = JSON.parse(text) as Partial<Backup>
    if (data?.app !== BACKUP_APP || !Array.isArray(data.transactions)) return null
    // 旧账本里存的是 emoji 图标，读进来时顺手迁移成 Lucide key；
    // 认不出来的（用户自定义 emoji）原样保留。
    const accounts = (data.accounts ?? []).map((a) => ({
      ...a,
      icon: migrateLegacyIcon(a.id, a.icon),
    }))
    const categories = (data.categories ?? []).map((c) => ({
      ...c,
      icon: migrateLegacyIcon(c.id, c.icon),
    }))
    return {
      app: BACKUP_APP,
      version: data.version ?? BACKUP_VERSION,
      exportedAt: data.exportedAt ?? new Date().toISOString(),
      transactions: data.transactions,
      accounts,
      categories,
      budgets: data.budgets ?? [],
      recurring: data.recurring ?? [],
    }
  } catch {
    return null
  }
}

/**
 * 用备份覆盖本地数据。整体放在一个事务里，
 * 中途失败不会留下「分类新了、记账还是旧的」这种半吊子状态。
 */
export async function applyBackup(data: Backup): Promise<void> {
  await db.transaction(
    'rw',
    [db.transactions, db.accounts, db.categories, db.budgets, db.recurring],
    async () => {
      if (data.categories.length) {
        await db.categories.clear()
        await db.categories.bulkPut(data.categories)
      }
      if (data.accounts.length) {
        await db.accounts.clear()
        await db.accounts.bulkPut(data.accounts)
      }
      await db.transactions.clear()
      if (data.transactions.length) await db.transactions.bulkPut(data.transactions)
      await db.budgets.clear()
      if (data.budgets.length) await db.budgets.bulkPut(data.budgets)
      await db.recurring.clear()
      if (data.recurring.length) await db.recurring.bulkPut(data.recurring)
    },
  )
}

/** 导出成表格，Excel / Numbers 都能直接打开 */
export function backupToCsv(data: Backup): string {
  const cm = new Map(data.categories.map((c) => [c.id, c.name]))
  const am = new Map(data.accounts.map((a) => [a.id, a.name]))
  const header = '日期,时间,类型,分类,金额,账户,备注\n'
  const rows = [...data.transactions]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((t) => {
      const type = t.type === 'expense' ? '支出' : t.type === 'income' ? '收入' : '转账'
      const note = (t.note ?? '').replace(/,/g, '，')
      const amount = t.type === 'transfer' ? '' : (t.amount / 100).toFixed(2)
      return `${t.date},${t.time ?? ''},${type},${cm.get(t.categoryId) ?? ''},${amount},${am.get(t.accountId) ?? ''},${note}`
    })
    .join('\n')
  // BOM 开头，否则 Excel 打开中文是乱码
  return '\ufeff' + header + rows
}
