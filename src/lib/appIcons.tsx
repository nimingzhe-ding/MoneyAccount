import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRight,
  Baby,
  BadgeDollarSign,
  Banknote,
  Bath,
  Beer,
  Bell,
  Bike,
  Book,
  BookOpen,
  Briefcase,
  Brush,
  Building,
  Bus,
  Cake,
  Calendar,
  CalendarClock,
  Camera,
  Car,
  Carrot,
  Cherry,
  Clapperboard,
  Clock,
  Coffee,
  Coins,
  CupSoda,
  CreditCard,
  Droplets,
  Dumbbell,
  Film,
  Fish,
  Flame,
  Flower,
  Footprints,
  Fuel,
  Gamepad2,
  Gem,
  Gift,
  Globe,
  GraduationCap,
  Guitar,
  HandCoins,
  Headphones,
  Heart,
  Hospital,
  House,
  Key,
  Landmark,
  Leaf,
  Lightbulb,
  MapPin,
  Medal,
  MessageCircle,
  Moon,
  NotebookPen,
  Package,
  PackageOpen,
  PartyPopper,
  PawPrint,
  PiggyBank,
  Pill,
  Pizza,
  Plane,
  Receipt,
  Salad,
  Sandwich,
  Scissors,
  Search,
  Shapes,
  ShoppingBag,
  ShoppingCart,
  Shirt,
  Smartphone,
  Soup,
  Sparkles,
  SprayCan,
  Star,
  Store,
  Sun,
  Tags,
  Target,
  TrainFront,
  TrendingUp,
  Trophy,
  Umbrella,
  Utensils,
  Wallet,
  WashingMachine,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react'

/** 数据库里存的 icon key → Lucide 组件 */
const ICONS: Record<string, LucideIcon> = {
  'arrow-left-right': ArrowLeftRight,
  utensils: Utensils,
  soup: Soup,
  coffee: Coffee,
  'cup-soda': CupSoda,
  sandwich: Sandwich,
  salad: Salad,
  pizza: Pizza,
  cake: Cake,
  beer: Beer,
  'shopping-bag': ShoppingBag,
  'shopping-cart': ShoppingCart,
  'spray-can': SprayCan,
  'gamepad-2': Gamepad2,
  house: House,
  smartphone: Smartphone,
  pill: Pill,
  'book-open': BookOpen,
  gift: Gift,
  'paw-print': PawPrint,
  plane: Plane,
  sparkles: Sparkles,
  dumbbell: Dumbbell,
  package: Package,
  'package-open': PackageOpen,
  banknote: Banknote,
  'party-popper': PartyPopper,
  'trending-up': TrendingUp,
  briefcase: Briefcase,
  receipt: Receipt,
  wallet: Wallet,
  'credit-card': CreditCard,
  landmark: Landmark,
  'message-circle': MessageCircle,
  coins: Coins,
  'badge-dollar-sign': BadgeDollarSign,
  bus: Bus,
  'train-front': TrainFront,
  car: Car,
  bike: Bike,
  fuel: Fuel,
  scissors: Scissors,
  shapes: Shapes,
  heart: Heart,
  baby: Baby,
  film: Film,
  clapperboard: Clapperboard,
  trophy: Trophy,
  'graduation-cap': GraduationCap,
  'hand-coins': HandCoins,
  guitar: Guitar,
  headphones: Headphones,
  camera: Camera,
  shirt: Shirt,
  footprints: Footprints,
  droplets: Droplets,
  lightbulb: Lightbulb,
  wifi: Wifi,
  globe: Globe,
  brush: Brush,
  bath: Bath,
  'washing-machine': WashingMachine,
  wrench: Wrench,
  key: Key,
  bell: Bell,
  calendar: Calendar,
  'calendar-clock': CalendarClock,
  clock: Clock,
  'map-pin': MapPin,
  search: Search,
  star: Star,
  sun: Sun,
  moon: Moon,
  zap: Zap,
  flame: Flame,
  leaf: Leaf,
  gem: Gem,
  building: Building,
  store: Store,
  tags: Tags,
  target: Target,
  hospital: Hospital,
  book: Book,
  'notebook-pen': NotebookPen,
  'piggy-bank': PiggyBank,
  medal: Medal,
  umbrella: Umbrella,
  fish: Fish,
  flower: Flower,
  cherry: Cherry,
  carrot: Carrot,
}

export function isIconKey(name: string | undefined | null): boolean {
  return !!name && name in ICONS
}

/**
 * 统一的图标渲染入口。
 *
 * 新数据存的是 Lucide 的 key；老数据里可能还是 emoji（用户自己改过的），
 * 认不出来就原样按 emoji 渲染，保证升级后不会出现空白。
 */
export function AppIcon({
  name,
  size = 18,
  strokeWidth = 1.8,
  color,
  className,
}: {
  name: string
  size?: number
  strokeWidth?: number
  color?: string
  className?: string
}) {
  const Icon = ICONS[name]
  if (Icon) {
    return (
      <Icon
        size={size}
        strokeWidth={strokeWidth}
        color={color}
        className={className}
        aria-hidden="true"
      />
    )
  }
  return (
    <span
      className={className}
      style={{ fontSize: size * 0.92, lineHeight: 1, color }}
      aria-hidden="true"
    >
      {name}
    </span>
  )
}
