import Dexie, { type Table } from 'dexie'
import type { Account, Budget, Category, Recurring, Setting, Transaction } from './types'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, seedAccounts, seedCategories } from './seed'
import { migrateLegacyIcon } from './iconKeys'

// v1 用的那套高饱和色，v2 换成更柔和的暖色板。
// 只改还停留在旧默认色的分类，用户自己调过的颜色不动。
const V1_COLORS: Record<string, string> = {
  c_food: '#FF8A5B',
  c_transport: '#5B9BFF',
  c_shopping: '#FF6FA5',
  c_daily: '#8B7CF6',
  c_fun: '#4FC3A1',
  c_home: '#F2B84B',
  c_phone: '#56C0E0',
  c_medical: '#F5748B',
  c_study: '#6C8CF5',
  c_gift: '#E8756B',
  c_pet: '#D9965B',
  c_travel: '#48B0D8',
  c_beauty: '#EE7FC0',
  c_sport: '#7FC24B',
  c_other_e: '#9A938C',
  c_salary: '#E8A33D',
  c_bonus: '#F2B84B',
  c_invest: '#4FC3A1',
  c_parttime: '#5B9BFF',
  c_redpacket: '#E8756B',
  c_reimburse: '#8B7CF6',
  c_other_i: '#9A938C',
  a_wechat: '#3EB575',
  a_alipay: '#2E8BEF',
  a_bank: '#D9A441',
  a_credit: '#B06BD6',
  a_cash: '#6FBF73',
}

const NEW_COLORS: Record<string, string> = Object.fromEntries(
  [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...seedAccounts()].map((x) => [x.id, x.color]),
)

class MoneyDB extends Dexie {
  transactions!: Table<Transaction, string>
  accounts!: Table<Account, string>
  categories!: Table<Category, string>
  budgets!: Table<Budget, string>
  recurring!: Table<Recurring, string>
  settings!: Table<Setting, string>

  constructor() {
    super('money-account')
    this.version(1).stores({
      transactions: 'id, date, type, categoryId, accountId, createdAt',
      accounts: 'id, order',
      categories: 'id, type, order',
      budgets: 'id, month',
      recurring: 'id, enabled',
      settings: 'key',
    })
    this.on('populate', () => {
      this.categories.bulkAdd(seedCategories())
      this.accounts.bulkAdd(seedAccounts())
    })

    // v2：只换配色，不动表结构
    this.version(2)
      .stores({
        transactions: 'id, date, type, categoryId, accountId, createdAt',
        accounts: 'id, order',
        categories: 'id, type, order',
        budgets: 'id, month',
        recurring: 'id, enabled',
        settings: 'key',
      })
      .upgrade(async (tx) => {
        const recolor = async (table: string) => {
          await tx.table(table).toCollection().modify((row: { id: string; color: string }) => {
            const old = V1_COLORS[row.id]
            const next = NEW_COLORS[row.id]
            if (old && next && row.color === old) row.color = next
          })
        }
        await recolor('categories')
        await recolor('accounts')
      })

    // v3：分类/账户图标从 emoji 换成 Lucide 的 key。
    // 只替换「还是默认 emoji」的记录，用户自己改过的图标保留，渲染层会继续按 emoji 显示。
    this.version(3)
      .stores({
        transactions: 'id, date, type, categoryId, accountId, createdAt',
        accounts: 'id, order',
        categories: 'id, type, order',
        budgets: 'id, month',
        recurring: 'id, enabled',
        settings: 'key',
      })
      .upgrade(async (tx) => {
        const migrateIcons = async (table: string) => {
          await tx.table(table).toCollection().modify((row: { id: string; icon?: string }) => {
            row.icon = migrateLegacyIcon(row.id, row.icon)
          })
        }
        await migrateIcons('categories')
        await migrateIcons('accounts')
      })
  }
}

export const db = new MoneyDB()

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  return row ? (row.value as T) : fallback
}

export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value })
}
