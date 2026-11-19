import type { Account, Category } from './types'
import { ACCOUNT_ICON_KEYS, CATEGORY_ICON_KEYS } from './iconKeys'

// 分类色板：都往暖里压了一档，饱和度收紧，和奶油底色放一起不打架。
// 相邻分类尽量拉开色相，这样环形图分得清又不刺眼。
export const EXPENSE_CATEGORIES: Omit<Category, 'type'>[] = [
  { id: 'c_food', name: '餐饮', icon: CATEGORY_ICON_KEYS.c_food, color: '#E8825A', order: 1 },
  { id: 'c_transport', name: '交通', icon: CATEGORY_ICON_KEYS.c_transport, color: '#6E92C4', order: 2 },
  { id: 'c_shopping', name: '购物', icon: CATEGORY_ICON_KEYS.c_shopping, color: '#D9708F', order: 3 },
  { id: 'c_daily', name: '日用', icon: CATEGORY_ICON_KEYS.c_daily, color: '#9C86C9', order: 4 },
  { id: 'c_fun', name: '娱乐', icon: CATEGORY_ICON_KEYS.c_fun, color: '#54A98C', order: 5 },
  { id: 'c_home', name: '居住', icon: CATEGORY_ICON_KEYS.c_home, color: '#DFA84F', order: 6 },
  { id: 'c_phone', name: '通讯', icon: CATEGORY_ICON_KEYS.c_phone, color: '#5FA8BC', order: 7 },
  { id: 'c_medical', name: '医疗', icon: CATEGORY_ICON_KEYS.c_medical, color: '#CE6E72', order: 8 },
  { id: 'c_study', name: '学习', icon: CATEGORY_ICON_KEYS.c_study, color: '#7A86C9', order: 9 },
  { id: 'c_gift', name: '人情', icon: CATEGORY_ICON_KEYS.c_gift, color: '#C4715F', order: 10 },
  { id: 'c_pet', name: '宠物', icon: CATEGORY_ICON_KEYS.c_pet, color: '#B98A5C', order: 11 },
  { id: 'c_travel', name: '旅行', icon: CATEGORY_ICON_KEYS.c_travel, color: '#5E9BB5', order: 12 },
  { id: 'c_beauty', name: '美容', icon: CATEGORY_ICON_KEYS.c_beauty, color: '#C287B4', order: 13 },
  { id: 'c_sport', name: '运动', icon: CATEGORY_ICON_KEYS.c_sport, color: '#8AA85C', order: 14 },
  { id: 'c_other_e', name: '其他', icon: CATEGORY_ICON_KEYS.c_other_e, color: '#A2968A', order: 99 },
]

export const INCOME_CATEGORIES: Omit<Category, 'type'>[] = [
  { id: 'c_salary', name: '工资', icon: CATEGORY_ICON_KEYS.c_salary, color: '#D99A3D', order: 1 },
  { id: 'c_bonus', name: '奖金', icon: CATEGORY_ICON_KEYS.c_bonus, color: '#DFA84F', order: 2 },
  { id: 'c_invest', name: '理财', icon: CATEGORY_ICON_KEYS.c_invest, color: '#54A98C', order: 3 },
  { id: 'c_parttime', name: '兼职', icon: CATEGORY_ICON_KEYS.c_parttime, color: '#6E92C4', order: 4 },
  { id: 'c_redpacket', name: '红包', icon: CATEGORY_ICON_KEYS.c_redpacket, color: '#C4715F', order: 5 },
  { id: 'c_reimburse', name: '报销', icon: CATEGORY_ICON_KEYS.c_reimburse, color: '#9C86C9', order: 6 },
  { id: 'c_other_i', name: '其他', icon: CATEGORY_ICON_KEYS.c_other_i, color: '#A2968A', order: 99 },
]

export function seedCategories(): Category[] {
  return [
    ...EXPENSE_CATEGORIES.map((c) => ({ ...c, type: 'expense' as const })),
    ...INCOME_CATEGORIES.map((c) => ({ ...c, type: 'income' as const })),
  ]
}

export function seedAccounts(): Account[] {
  return [
    { id: 'a_wechat', name: '微信', kind: 'ewallet', icon: ACCOUNT_ICON_KEYS.a_wechat, color: '#4E9E6B', initialBalance: 0, order: 1 },
    { id: 'a_alipay', name: '支付宝', kind: 'ewallet', icon: ACCOUNT_ICON_KEYS.a_alipay, color: '#4A86C7', initialBalance: 0, order: 2 },
    { id: 'a_bank', name: '储蓄卡', kind: 'bank', icon: ACCOUNT_ICON_KEYS.a_bank, color: '#C79A47', initialBalance: 0, order: 3 },
    { id: 'a_credit', name: '信用卡', kind: 'credit', icon: ACCOUNT_ICON_KEYS.a_credit, color: '#A77BBE', initialBalance: 0, order: 4 },
    { id: 'a_cash', name: '现金', kind: 'cash', icon: ACCOUNT_ICON_KEYS.a_cash, color: '#7FA85E', initialBalance: 0, order: 5 },
  ]
}
