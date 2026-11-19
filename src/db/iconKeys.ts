/**
 * 分类 / 账户图标统一用 Lucide 的图标 key（如 'utensils'、'train-front'），
 * 不再往数据库里存 emoji。
 *
 * 老数据迁移：只把「仍然停留在默认 emoji」的记录换成新 key，
 * 用户自己改过的 emoji 原样保留，渲染层会继续按 emoji 显示。
 */

/** 预置分类的默认图标 */
export const CATEGORY_ICON_KEYS: Record<string, string> = {
  c_food: 'utensils',
  c_transport: 'train-front',
  c_shopping: 'shopping-bag',
  c_daily: 'spray-can',
  c_fun: 'gamepad-2',
  c_home: 'house',
  c_phone: 'smartphone',
  c_medical: 'pill',
  c_study: 'book-open',
  c_gift: 'gift',
  c_pet: 'paw-print',
  c_travel: 'plane',
  c_beauty: 'sparkles',
  c_sport: 'dumbbell',
  c_other_e: 'package',
  c_salary: 'banknote',
  c_bonus: 'party-popper',
  c_invest: 'trending-up',
  c_parttime: 'briefcase',
  c_redpacket: 'hand-coins',
  c_reimburse: 'receipt',
  c_other_i: 'package',
}

/** 预置账户的默认图标 */
export const ACCOUNT_ICON_KEYS: Record<string, string> = {
  a_wechat: 'message-circle',
  a_alipay: 'wallet',
  a_bank: 'landmark',
  a_credit: 'credit-card',
  a_cash: 'banknote',
}

/** v2 时代预置分类用过的 emoji，迁移时用来判断「用户没改过」 */
export const LEGACY_CATEGORY_EMOJI: Record<string, string> = {
  c_food: '🍜',
  c_transport: '🚇',
  c_shopping: '🛍️',
  c_daily: '🧴',
  c_fun: '🎮',
  c_home: '🏠',
  c_phone: '📱',
  c_medical: '💊',
  c_study: '📚',
  c_gift: '🎁',
  c_pet: '🐱',
  c_travel: '✈️',
  c_beauty: '💄',
  c_sport: '🏀',
  c_other_e: '📦',
  c_salary: '💰',
  c_bonus: '🎉',
  c_invest: '📈',
  c_parttime: '💼',
  c_redpacket: '🧧',
  c_reimburse: '🧾',
  c_other_i: '📦',
}

/** v2 时代预置账户用过的 emoji */
export const LEGACY_ACCOUNT_EMOJI: Record<string, string> = {
  a_wechat: '💬',
  a_alipay: '🅰️',
  a_bank: '🏦',
  a_credit: '💳',
  a_cash: '💵',
}

/**
 * 把旧版本预置的默认 emoji 换成 Lucide key。
 * - 已经是 key 的保持不动
 * - 用户自己改过、不在默认映射里的 emoji 原样返回（渲染层继续按 emoji 显示）
 */
export function migrateLegacyIcon(id: string, icon?: string): string {
  const next = CATEGORY_ICON_KEYS[id] ?? ACCOUNT_ICON_KEYS[id]
  const legacy = LEGACY_CATEGORY_EMOJI[id] ?? LEGACY_ACCOUNT_EMOJI[id]
  if (next && (!icon || icon === legacy)) return next
  return icon ?? next ?? 'package'
}

/** 分类编辑面板里可选的图标 */
export const PICKER_ICON_KEYS = [
  'utensils',
  'soup',
  'coffee',
  'sandwich',
  'pizza',
  'cake',
  'beer',
  'cup-soda',
  'shopping-bag',
  'shopping-cart',
  'spray-can',
  'gamepad-2',
  'house',
  'smartphone',
  'pill',
  'book-open',
  'gift',
  'paw-print',
  'plane',
  'sparkles',
  'dumbbell',
  'package',
  'package-open',
  'banknote',
  'party-popper',
  'trending-up',
  'briefcase',
  'receipt',
  'wallet',
  'credit-card',
  'landmark',
  'message-circle',
  'coins',
  'badge-dollar-sign',
  'bus',
  'train-front',
  'car',
  'bike',
  'fuel',
  'scissors',
  'heart',
  'baby',
  'film',
  'clapperboard',
  'trophy',
  'graduation-cap',
  'hand-coins',
  'guitar',
  'headphones',
  'camera',
  'shirt',
  'footprints',
  'droplets',
  'lightbulb',
  'wifi',
  'globe',
  'brush',
  'bath',
  'washing-machine',
  'wrench',
  'key',
  'bell',
  'calendar',
  'clock',
  'map-pin',
  'star',
  'sun',
  'moon',
  'zap',
  'flame',
  'leaf',
  'gem',
  'building',
  'store',
  'hospital',
  'book',
  'notebook-pen',
  'piggy-bank',
  'medal',
  'umbrella',
  'fish',
  'flower',
  'cherry',
  'carrot',
]

/** 分类编辑面板第一屏的 23 个常用图标 */
export const PRIMARY_ICON_KEYS = [
  'utensils',
  'soup',
  'coffee',
  'cake',
  'cup-soda',
  'shopping-cart',
  'shopping-bag',
  'shirt',
  'footprints',
  'train-front',
  'car',
  'plane',
  'house',
  'lightbulb',
  'smartphone',
  'gamepad-2',
  'book-open',
  'gift',
  'pill',
  'paw-print',
  'banknote',
  'trending-up',
  'briefcase',
]

/** 其余收进「更多图标」 */
export const EXTRA_ICON_KEYS = PICKER_ICON_KEYS.filter((k) => !PRIMARY_ICON_KEYS.includes(k))
