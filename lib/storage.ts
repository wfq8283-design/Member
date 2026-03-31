import { type Transaction, type Budget, type UserAccount, type PointsAccount, type PointsBatch, type PointsTransaction, type Product, type Order, type Address } from './types'
import { getCurrentMonth, generateId } from './utils'

const TRANSACTIONS_KEY = 'moneypulse_transactions'
const BUDGETS_KEY = 'moneypulse_budgets'
const INIT_KEY = 'moneypulse_initialized'

export function loadTransactions(): Transaction[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(TRANSACTIONS_KEY)
  return data ? JSON.parse(data) : []
}

export function saveTransactions(transactions: Transaction[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions))
}

export function loadBudgets(): Budget[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(BUDGETS_KEY)
  return data ? JSON.parse(data) : []
}

export function saveBudgets(budgets: Budget[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets))
}

export function exportToCSV(transactions: Transaction[]): string {
  const headers = ['日期', '类型', '分类', '描述', '金额']
  const rows = transactions.map(t => [
    t.date,
    t.type === 'income' ? '收入' : '支出',
    t.category,
    `"${t.description}"`,
    t.amount.toString()
  ])
  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
}

export function downloadCSV(csv: string, filename: string) {
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function generateSampleData(): Transaction[] {
  const month = getCurrentMonth()
  const [y, m] = month.split('-')
  const d = (day: number) => `${y}-${m}-${String(day).padStart(2, '0')}`

  return [
    { id: generateId(), type: 'income', amount: 18000, category: 'salary', description: '3月工资', date: d(1), createdAt: Date.now() - 86400000 * 9 },
    { id: generateId(), type: 'expense', amount: 38, category: 'food', description: '午餐外卖', date: d(1), createdAt: Date.now() - 86400000 * 9 },
    { id: generateId(), type: 'expense', amount: 4200, category: 'housing', description: '3月房租', date: d(1), createdAt: Date.now() - 86400000 * 9 },
    { id: generateId(), type: 'expense', amount: 52, category: 'transport', description: '滴滴打车', date: d(2), createdAt: Date.now() - 86400000 * 8 },
    { id: generateId(), type: 'expense', amount: 268, category: 'shopping', description: '淘宝衣服', date: d(2), createdAt: Date.now() - 86400000 * 8 },
    { id: generateId(), type: 'expense', amount: 45, category: 'food', description: '咖啡奶茶', date: d(3), createdAt: Date.now() - 86400000 * 7 },
    { id: generateId(), type: 'expense', amount: 89, category: 'food', description: '晚餐火锅', date: d(3), createdAt: Date.now() - 86400000 * 7 },
    { id: generateId(), type: 'expense', amount: 150, category: 'entertainment', description: '电影+零食', date: d(4), createdAt: Date.now() - 86400000 * 6 },
    { id: generateId(), type: 'expense', amount: 200, category: 'utilities', description: '手机话费+宽带', date: d(4), createdAt: Date.now() - 86400000 * 6 },
    { id: generateId(), type: 'expense', amount: 35, category: 'transport', description: '地铁充值', date: d(5), createdAt: Date.now() - 86400000 * 5 },
    { id: generateId(), type: 'expense', amount: 480, category: 'health', description: '体检费用', date: d(5), createdAt: Date.now() - 86400000 * 5 },
    { id: generateId(), type: 'income', amount: 2500, category: 'freelance', description: '设计外包项目', date: d(5), createdAt: Date.now() - 86400000 * 5 },
    { id: generateId(), type: 'expense', amount: 129, category: 'education', description: '在线课程续费', date: d(6), createdAt: Date.now() - 86400000 * 4 },
    { id: generateId(), type: 'expense', amount: 66, category: 'food', description: '超市买菜', date: d(7), createdAt: Date.now() - 86400000 * 3 },
    { id: generateId(), type: 'expense', amount: 320, category: 'shopping', description: '日用品采购', date: d(7), createdAt: Date.now() - 86400000 * 3 },
    { id: generateId(), type: 'expense', amount: 42, category: 'food', description: '早午餐', date: d(8), createdAt: Date.now() - 86400000 * 2 },
    { id: generateId(), type: 'expense', amount: 15, category: 'transport', description: '公交出行', date: d(8), createdAt: Date.now() - 86400000 * 2 },
    { id: generateId(), type: 'income', amount: 500, category: 'investment', description: '基金收益', date: d(9), createdAt: Date.now() - 86400000 * 1 },
    { id: generateId(), type: 'expense', amount: 58, category: 'food', description: '下午茶', date: d(9), createdAt: Date.now() - 86400000 * 1 },
    { id: generateId(), type: 'expense', amount: 1200, category: 'shopping', description: '京东数码配件', date: d(10), createdAt: Date.now() },
  ]
}

export function generateSampleBudgets(): Budget[] {
  const month = getCurrentMonth()
  return [
    { category: 'food', limit: 2000, month },
    { category: 'transport', limit: 800, month },
    { category: 'shopping', limit: 1500, month },
    { category: 'entertainment', limit: 1000, month },
    { category: 'utilities', limit: 500, month },
    { category: 'health', limit: 600, month },
    { category: 'education', limit: 500, month },
    { category: 'housing', limit: 5000, month },
  ]
}

export function initializeData(): { transactions: Transaction[], budgets: Budget[] } {
  if (typeof window === 'undefined') return { transactions: [], budgets: [] }

  const initialized = localStorage.getItem(INIT_KEY)
  if (!initialized) {
    const transactions = generateSampleData()
    const budgets = generateSampleBudgets()
    saveTransactions(transactions)
    saveBudgets(budgets)
    localStorage.setItem(INIT_KEY, 'true')
    return { transactions, budgets }
  }
  return { transactions: loadTransactions(), budgets: loadBudgets() }
}

// ===== 会员积分系统存储 =====

const USERS_KEY = 'loyalty_users'
const POINTS_ACCOUNTS_KEY = 'loyalty_points_accounts'
const POINTS_BATCHES_KEY = 'loyalty_points_batches'
const POINTS_TRANSACTIONS_KEY = 'loyalty_points_transactions'
const PRODUCTS_KEY = 'loyalty_products'
const ORDERS_KEY = 'loyalty_orders'
const ADDRESSES_KEY = 'loyalty_addresses'
const LOYALTY_INIT_KEY = 'loyalty_initialized'

export function loadUsers(): UserAccount[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(USERS_KEY)
  return data ? JSON.parse(data) : []
}

export function saveUsers(users: UserAccount[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export function loadPointsAccounts(): PointsAccount[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(POINTS_ACCOUNTS_KEY)
  return data ? JSON.parse(data) : []
}

export function savePointsAccounts(accounts: PointsAccount[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(POINTS_ACCOUNTS_KEY, JSON.stringify(accounts))
}

export function loadPointsBatches(): PointsBatch[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(POINTS_BATCHES_KEY)
  return data ? JSON.parse(data) : []
}

export function savePointsBatches(batches: PointsBatch[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(POINTS_BATCHES_KEY, JSON.stringify(batches))
}

export function loadPointsTransactions(): PointsTransaction[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(POINTS_TRANSACTIONS_KEY)
  return data ? JSON.parse(data) : []
}

export function savePointsTransactions(transactions: PointsTransaction[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(POINTS_TRANSACTIONS_KEY, JSON.stringify(transactions))
}

export function loadProducts(): Product[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(PRODUCTS_KEY)
  return data ? JSON.parse(data) : []
}

export function saveProducts(products: Product[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products))
}

export function loadOrders(): Order[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(ORDERS_KEY)
  return data ? JSON.parse(data) : []
}

export function saveOrders(orders: Order[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders))
}

export function loadAddresses(): Address[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(ADDRESSES_KEY)
  return data ? JSON.parse(data) : []
}

export function saveAddresses(addresses: Address[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(ADDRESSES_KEY, JSON.stringify(addresses))
}

function generateSampleProducts(): Product[] {
  const now = Date.now()
  return [
    {
      id: generateId(),
      name: '精品咖啡礼盒',
      category: '美食饮品',
      pointsPrice: 12000,
      stock: 50,
      image: '',
      description: '精选咖啡豆组合，适合送礼与自用。',
      createdAt: now,
    },
    {
      id: generateId(),
      name: '人体工学办公椅',
      category: '居家好物',
      pointsPrice: 68000,
      stock: 20,
      image: '',
      description: '提升久坐舒适度，保护腰椎健康。',
      createdAt: now,
    },
    {
      id: generateId(),
      name: '无线降噪耳机',
      category: '数码设备',
      pointsPrice: 52000,
      stock: 35,
      image: '',
      description: '主动降噪，沉浸音乐与专注工作。',
      createdAt: now,
    },
    {
      id: generateId(),
      name: '高端酒店双人自助餐券',
      category: '生活体验',
      pointsPrice: 36000,
      stock: 100,
      image: '',
      description: '城市高端酒店自助餐体验券，节假日通用。',
      createdAt: now,
    },
    {
      id: generateId(),
      name: '智能手环',
      category: '数码设备',
      pointsPrice: 28000,
      stock: 60,
      image: '',
      description: '运动健康监测，24小时续航。',
      createdAt: now,
    },
    {
      id: generateId(),
      name: '品牌保温杯',
      category: '居家好物',
      pointsPrice: 8000,
      stock: 200,
      image: '',
      description: '304不锈钢内胆，保温12小时。',
      createdAt: now,
    },
  ]
}

export function initializeLoyaltyData(): { products: Product[] } {
  if (typeof window === 'undefined') return { products: [] }

  const initialized = localStorage.getItem(LOYALTY_INIT_KEY)
  if (!initialized) {
    const products = generateSampleProducts()
    saveProducts(products)
    localStorage.setItem(LOYALTY_INIT_KEY, 'true')
    return { products }
  }

  return { products: loadProducts() }
}
