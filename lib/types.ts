export type TransactionType = 'income' | 'expense'

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  category: string
  description: string
  date: string
  createdAt: number
}

export interface Budget {
  category: string
  limit: number
  month: string
}

export interface CategoryConfig {
  id: string
  name: string
  type: TransactionType
  color: string
  keywords: string[]
}

export interface MonthSummary {
  month: string
  totalIncome: number
  totalExpense: number
  savings: number
  savingsRate: number
  categoryBreakdown: CategoryAmount[]
}

export interface CategoryAmount {
  category: string
  categoryName: string
  amount: number
  color: string
  percentage: number
}

// ===== 会员积分系统类型定义 =====

export type MemberLevel = 'normal' | 'silver' | 'gold' | 'platinum' | 'diamond'

export interface UserAccount {
  id: string
  phone: string
  password: string
  createdAt: number
}

export interface PointsAccount {
  userId: string
  balance: number
  totalEarned: number
  level: MemberLevel
  updatedAt: number
}

export type PointsTransactionType = 'earn' | 'use' | 'expire' | 'adjust' | 'refund'

export interface PointsTransaction {
  id: string
  userId: string
  type: PointsTransactionType
  change: number
  source: string
  sourceId?: string
  createdAt: number
  expireAt?: number
  remark?: string
}

export interface PointsBatch {
  id: string
  userId: string
  amount: number
  remaining: number
  source: string
  sourceId?: string
  createdAt: number
  expireAt: number
}

export interface Product {
  id: string
  name: string
  category: string
  pointsPrice: number
  stock: number
  image?: string
  description?: string
  createdAt: number
}

export type OrderStatus = 'pending' | 'shipped' | 'completed' | 'cancelled'

export interface OrderItem {
  productId: string
  quantity: number
  pointsPrice: number
}

export interface Order {
  id: string
  userId: string
  items: OrderItem[]
  totalPoints: number
  addressId: string
  status: OrderStatus
  createdAt: number
}

export interface Address {
  id: string
  userId: string
  name: string
  phone: string
  region: string
  detail: string
  isDefault: boolean
  createdAt: number
}
