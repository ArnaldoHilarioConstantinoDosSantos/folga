import {
  Baby, Banknote, Bike, BookOpen, Briefcase, Building2, Car, CarTaxiFront, Clapperboard, Cloud, Coffee,
  Coins, CreditCard, Droplets, Dumbbell, Ellipsis, FileText, Fuel, Gamepad2, Gift, GraduationCap,
  HeartPulse, House, KeyRound, Landmark, MapPin, Music, Package, PartyPopper, PawPrint, PiggyBank, Pill,
  Plane, Receipt, Shield, Shirt, ShoppingBag, ShoppingCart, Smartphone, Sofa, Sparkles, Stethoscope,
  Target, Ticket, TrendingUp, Tv, Umbrella, Utensils, Wallet, Wifi, Wine, Wrench, Zap,
  type LucideIcon,
} from 'lucide-react'

/**
 * Ícones disponíveis para categorias, contas e metas. No banco fica só a chave
 * (ex.: "house"); importar um a um mantém o pacote final pequeno.
 */
export const ICONS: Record<string, LucideIcon> = {
  house: House, building: Building2, zap: Zap, droplets: Droplets, wifi: Wifi, key: KeyRound, wrench: Wrench,
  utensils: Utensils, cart: ShoppingCart, bike: Bike, coffee: Coffee, wine: Wine,
  car: Car, fuel: Fuel, taxi: CarTaxiFront, shield: Shield, file: FileText, pin: MapPin,
  heart: HeartPulse, pill: Pill, stethoscope: Stethoscope, dumbbell: Dumbbell,
  party: PartyPopper, film: Clapperboard, gamepad: Gamepad2, plane: Plane, ticket: Ticket,
  tv: Tv, music: Music, package: Package, cloud: Cloud,
  bag: ShoppingBag, shirt: Shirt, smartphone: Smartphone, sofa: Sofa, gift: Gift,
  trending: TrendingUp, graduation: GraduationCap, book: BookOpen, dots: Ellipsis,
  briefcase: Briefcase, coins: Coins, banknote: Banknote, piggy: PiggyBank, wallet: Wallet,
  landmark: Landmark, card: CreditCard, receipt: Receipt, target: Target, umbrella: Umbrella,
  baby: Baby, paw: PawPrint, sparkles: Sparkles,
}

export const ICON_KEYS = Object.keys(ICONS)

export const iconOf = (key: string | null | undefined): LucideIcon => ICONS[key ?? ''] ?? Ellipsis
