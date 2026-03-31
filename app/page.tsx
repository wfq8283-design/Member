'use client'

import { useEffect, useMemo, useState } from 'react'
import { Home, ShoppingBag, ClipboardList, User as UserIcon, LogOut, MapPin, Plus, X, ChevronRight, Star, Crown, Diamond, Gift, Clock, CheckCircle, Truck, Package, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import {
  type UserAccount,
  type PointsAccount,
  type PointsBatch,
  type PointsTransaction,
  type MemberLevel,
  type Product,
  type Order,
  type Address,
  type OrderStatus,
} from '@/lib/types'
import {
  initializeLoyaltyData,
  loadUsers,
  saveUsers,
  loadPointsAccounts,
  savePointsAccounts,
  loadPointsBatches,
  savePointsBatches,
  loadPointsTransactions,
  savePointsTransactions,
  loadProducts,
  saveProducts,
  loadOrders,
  saveOrders,
  loadAddresses,
  saveAddresses,
} from '@/lib/storage'
import { generateId } from '@/lib/utils'

type TabKey = 'home' | 'mall' | 'orders' | 'profile' | 'orderConfirm'

const POINTS_PER_YUAN = 10
const POINTS_EXPIRE_DAYS = 365
const EXPIRE_REMIND_DAYS = 30

// ===== 工具函数 =====

function validatePhone(phone: string): boolean {
  return /^1\d{10}$/.test(phone)
}

function validatePassword(password: string): { ok: boolean; message?: string } {
  if (password.length < 8) {
    return { ok: false, message: '密码至少需要 8 位' }
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return { ok: false, message: '密码必须包含字母和数字' }
  }
  return { ok: true }
}

function getLevelLabel(level: MemberLevel): string {
  switch (level) {
    case 'silver': return '白银会员'
    case 'gold': return '黄金会员'
    case 'platinum': return '铂金会员'
    case 'diamond': return '钻石会员'
    default: return '普通会员'
  }
}

function getLevelCardClass(level: MemberLevel): string {
  switch (level) {
    case 'silver': return 'bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500'
    case 'gold': return 'bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600'
    case 'platinum': return 'bg-gradient-to-br from-cyan-300 via-cyan-400 to-cyan-600'
    case 'diamond': return 'bg-gradient-to-br from-indigo-400 via-purple-500 to-pink-500'
    default: return 'bg-gradient-to-br from-gray-200 via-gray-300 to-gray-400'
  }
}

function getLevelIcon(level: MemberLevel) {
  switch (level) {
    case 'silver': return <Star className="w-8 h-8 text-white drop-shadow-lg" />
    case 'gold': return <Crown className="w-8 h-8 text-white drop-shadow-lg" />
    case 'platinum': return <Diamond className="w-8 h-8 text-white drop-shadow-lg" />
    case 'diamond': return <Gift className="w-8 h-8 text-white drop-shadow-lg" />
    default: return <UserIcon className="w-8 h-8 text-white drop-shadow-lg" />
  }
}

function computeMemberLevel(totalEarned: number): MemberLevel {
  if (totalEarned >= 400000) return 'diamond'
  if (totalEarned >= 300000) return 'platinum'
  if (totalEarned >= 200000) return 'gold'
  if (totalEarned >= 100000) return 'silver'
  return 'normal'
}

function getNextLevelThreshold(totalEarned: number): { nextLevel: MemberLevel | null; threshold: number; current: number } {
  if (totalEarned < 100000) return { nextLevel: 'silver', threshold: 100000, current: totalEarned }
  if (totalEarned < 200000) return { nextLevel: 'gold', threshold: 200000, current: totalEarned }
  if (totalEarned < 300000) return { nextLevel: 'platinum', threshold: 300000, current: totalEarned }
  if (totalEarned < 400000) return { nextLevel: 'diamond', threshold: 400000, current: totalEarned }
  return { nextLevel: null, threshold: totalEarned, current: totalEarned }
}

function nowMs(): number {
  return Date.now()
}

function daysToMs(days: number): number {
  return days * 24 * 60 * 60 * 1000
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateTime(timestamp: number): string {
  const d = new Date(timestamp)
  return `${formatDate(timestamp)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function maskPhone(phone: string): string {
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

function getOrderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case 'pending': return '待发货'
    case 'shipped': return '已发货'
    case 'completed': return '已完成'
    case 'cancelled': return '已取消'
    default: return status
  }
}

// ===== 过期积分处理 =====

function processExpiredPoints(
  account: PointsAccount,
  batches: PointsBatch[],
  transactions: PointsTransaction[]
): { account: PointsAccount; batches: PointsBatch[]; transactions: PointsTransaction[] } {
  const now = nowMs()
  let totalExpired = 0
  const updatedBatches = batches.map(batch => {
    if (batch.expireAt <= now && batch.remaining > 0) {
      totalExpired += batch.remaining
      return { ...batch, remaining: 0 }
    }
    return batch
  })

  if (totalExpired > 0) {
    const expireTx: PointsTransaction = {
      id: generateId(),
      userId: account.userId,
      type: 'expire',
      change: -totalExpired,
      source: '积分过期',
      createdAt: now,
      remark: `${formatDate(now)} 积分过期清零`,
    }
    const updatedAccount: PointsAccount = {
      ...account,
      balance: Math.max(0, account.balance - totalExpired),
      updatedAt: now,
    }
    return {
      account: updatedAccount,
      batches: updatedBatches,
      transactions: [...transactions, expireTx],
    }
  }

  return { account, batches, transactions }
}

// ===== 主组件 =====

export default function LoyaltyApp() {
  const [tab, setTab] = useState<TabKey>('home')
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null)
  const [pointsAccount, setPointsAccount] = useState<PointsAccount | null>(null)
  const [batches, setBatches] = useState<PointsBatch[]>([])
  const [transactions, setTransactions] = useState<PointsTransaction[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [addresses, setAddresses] = useState<Address[]>([])

  // 登录/注册表单状态
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)

  // 消费获得积分
  const [consumptionAmount, setConsumptionAmount] = useState('')
  const [consumptionError, setConsumptionError] = useState<string | null>(null)

  // 商品详情 & 兑换
  const [selectedCategory, setSelectedCategory] = useState<string>('全部')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [redeemQuantity, setRedeemQuantity] = useState(1)
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [showAddressSelectSheet, setShowAddressSelectSheet] = useState(false)

  // 地址管理
  const [showAddressSheet, setShowAddressSheet] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)
  const [addressForm, setAddressForm] = useState({
    name: '',
    phone: '',
    region: '',
    detail: '',
    isDefault: false,
  })

  // 订单详情
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  // Toast 提示
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // 初始化商品数据
  useEffect(() => {
    const { products: initialProducts } = initializeLoyaltyData()
    const storedProducts = loadProducts()
    setProducts(storedProducts.length ? storedProducts : initialProducts)
  }, [])

  // 登录后加载数据
  useEffect(() => {
    if (!currentUser) {
      setPointsAccount(null)
      setBatches([])
      setTransactions([])
      setOrders([])
      setAddresses([])
      return
    }

    const allAccounts = loadPointsAccounts()
    let account = allAccounts.find(a => a.userId === currentUser.id) || null
    if (!account) {
      account = {
        userId: currentUser.id,
        balance: 0,
        totalEarned: 0,
        level: 'normal',
        updatedAt: nowMs(),
      }
      savePointsAccounts([...allAccounts, account])
    }

    const allBatches = loadPointsBatches().filter(b => b.userId === currentUser.id)
    const allTx = loadPointsTransactions().filter(t => t.userId === currentUser.id)
    const userOrders = loadOrders().filter(o => o.userId === currentUser.id)
    const userAddresses = loadAddresses().filter(a => a.userId === currentUser.id)

    // 处理过期积分
    const { account: processedAccount, batches: processedBatches, transactions: processedTx } =
      processExpiredPoints(account, allBatches, allTx)

    // 更新存储
    if (processedAccount !== account) {
      const updatedAccounts = loadPointsAccounts().map(a =>
        a.userId === currentUser.id ? processedAccount : a
      )
      savePointsAccounts(updatedAccounts)
    }
    savePointsBatches(processedBatches)
    savePointsTransactions(processedTx)

    setPointsAccount(processedAccount)
    setBatches(processedBatches)
    setTransactions(processedTx)
    setOrders(userOrders)
    setAddresses(userAddresses)
  }, [currentUser])

  // 计算即将过期积分
  const expiringPoints = useMemo(() => {
    const now = nowMs()
    const remindThreshold = now + daysToMs(EXPIRE_REMIND_DAYS)
    return batches
      .filter(b => b.expireAt > now && b.expireAt <= remindThreshold && b.remaining > 0)
      .reduce((sum, b) => sum + b.remaining, 0)
  }, [batches])

  // 商品分类
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category))
    return ['全部', ...Array.from(cats)]
  }, [products])

  const filteredProducts = useMemo(() => {
    if (selectedCategory === '全部') return products
    return products.filter(p => p.category === selectedCategory)
  }, [products, selectedCategory])

  // Toast
  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message })
    setTimeout(() => setToast(null), 2500)
  }

  // 注册/登录
  function handleAuth() {
    setAuthError(null)

    if (!validatePhone(phone)) {
      setAuthError('请输入合法的 11 位手机号')
      return
    }

    if (authMode === 'register') {
      const pwdCheck = validatePassword(password)
      if (!pwdCheck.ok) {
        setAuthError(pwdCheck.message || '密码不符合安全要求')
        return
      }
      if (password !== confirmPassword) {
        setAuthError('两次输入的密码不一致')
        return
      }
      const users = loadUsers()
      if (users.some(u => u.phone === phone)) {
        setAuthError('该手机号已注册，请直接登录')
        return
      }
      const newUser: UserAccount = {
        id: generateId(),
        phone,
        password,
        createdAt: nowMs(),
      }
      saveUsers([...users, newUser])
      setCurrentUser(newUser)
      showToast('success', '注册成功')
      return
    }

    // 登录
    const users = loadUsers()
    const user = users.find(u => u.phone === phone && u.password === password)
    if (!user) {
      setAuthError('手机号或密码错误')
      return
    }
    setCurrentUser(user)
    showToast('success', '登录成功')
  }

  function handleLogout() {
    setCurrentUser(null)
    setPhone('')
    setPassword('')
    setConfirmPassword('')
    setAuthMode('login')
    setTab('home')
  }

  // 消费获得积分
  function handleEarnPoints() {
    setConsumptionError(null)
    const amount = parseFloat(consumptionAmount)
    if (isNaN(amount) || amount <= 0) {
      setConsumptionError('请输入正确的消费金额')
      return
    }

    const points = Math.floor(amount * POINTS_PER_YUAN)
    const now = nowMs()
    const expireAt = now + daysToMs(POINTS_EXPIRE_DAYS)

    const newBatch: PointsBatch = {
      id: generateId(),
      userId: currentUser!.id,
      amount: points,
      remaining: points,
      source: '消费获得',
      createdAt: now,
      expireAt,
    }

    const newTx: PointsTransaction = {
      id: generateId(),
      userId: currentUser!.id,
      type: 'earn',
      change: points,
      source: '消费获得',
      createdAt: now,
      expireAt,
      remark: `消费 ¥${amount.toFixed(2)} 获得 ${points} 积分`,
    }

    const updatedBatches = [...batches, newBatch]
    const updatedTx = [...transactions, newTx]
    const newTotalEarned = pointsAccount!.totalEarned + points
    const updatedAccount: PointsAccount = {
      ...pointsAccount!,
      balance: pointsAccount!.balance + points,
      totalEarned: newTotalEarned,
      level: computeMemberLevel(newTotalEarned),
      updatedAt: now,
    }

    savePointsBatches(updatedBatches)
    savePointsTransactions(updatedTx)
    const allAccounts = loadPointsAccounts()
    savePointsAccounts(allAccounts.map(a => a.userId === currentUser!.id ? updatedAccount : a))

    setBatches(updatedBatches)
    setTransactions(updatedTx)
    setPointsAccount(updatedAccount)
    setConsumptionAmount('')
    showToast('success', `成功获得 ${points} 积分`)
  }

  // 进入订单确认页
  function goToOrderConfirm(product: Product) {
    if (product.stock === 0) {
      showToast('error', '商品已售罄')
      return
    }
    setSelectedProduct(product)
    setRedeemQuantity(1)
    // 默认选中默认地址或第一个地址
    const defaultAddr = addresses.find(a => a.isDefault) || addresses[0]
    setSelectedAddressId(defaultAddr?.id || null)
    setTab('orderConfirm')
  }

  // 兑换商品
  function handleRedeem() {
    if (!selectedProduct || !pointsAccount) return

    const totalPoints = selectedProduct.pointsPrice * redeemQuantity
    if (pointsAccount.balance < totalPoints) {
      showToast('error', '积分不足')
      return
    }
    if (selectedProduct.stock < redeemQuantity) {
      showToast('error', '库存不足')
      return
    }

    // 检查是否选择了地址
    if (!selectedAddressId) {
      showToast('error', '请选择收货地址')
      return
    }

    const now = nowMs()

    // 扣减积分（FIFO）
    let remainingToDeduct = totalPoints
    const updatedBatches = batches.map(batch => {
      if (remainingToDeduct <= 0 || batch.remaining <= 0) return batch
      const deduct = Math.min(batch.remaining, remainingToDeduct)
      remainingToDeduct -= deduct
      return { ...batch, remaining: batch.remaining - deduct }
    })

    const newTx: PointsTransaction = {
      id: generateId(),
      userId: currentUser!.id,
      type: 'use',
      change: -totalPoints,
      source: '商品兑换',
      sourceId: selectedProduct.id,
      createdAt: now,
      remark: `兑换 ${selectedProduct.name} x${redeemQuantity}`,
    }

    const newOrder: Order = {
      id: generateId(),
      userId: currentUser!.id,
      items: [{
        productId: selectedProduct.id,
        quantity: redeemQuantity,
        pointsPrice: selectedProduct.pointsPrice,
      }],
      totalPoints,
      addressId: selectedAddressId,
      status: 'pending',
      createdAt: now,
    }

    const updatedProducts = products.map(p =>
      p.id === selectedProduct.id ? { ...p, stock: p.stock - redeemQuantity } : p
    )

    const updatedAccount: PointsAccount = {
      ...pointsAccount,
      balance: pointsAccount.balance - totalPoints,
      updatedAt: now,
    }

    const updatedOrders = [...orders, newOrder]

    savePointsBatches(updatedBatches)
    savePointsTransactions([...transactions, newTx])
    saveProducts(updatedProducts)
    saveOrders(updatedOrders)
    const allAccounts = loadPointsAccounts()
    savePointsAccounts(allAccounts.map(a => a.userId === currentUser!.id ? updatedAccount : a))

    setBatches(updatedBatches)
    setTransactions([...transactions, newTx])
    setProducts(updatedProducts)
    setPointsAccount(updatedAccount)
    setOrders(updatedOrders)
    setSelectedProduct(null)
    setRedeemQuantity(1)
    setSelectedAddressId(null)
    setTab('orders')
    showToast('success', '兑换成功')
  }

  // 地址管理
  function handleSaveAddress() {
    if (!addressForm.name.trim()) {
      showToast('error', '请输入收件人姓名')
      return
    }
    if (!validatePhone(addressForm.phone)) {
      showToast('error', '请输入正确的手机号')
      return
    }
    if (!addressForm.region.trim() || !addressForm.detail.trim()) {
      showToast('error', '请填写完整地址')
      return
    }

    const now = nowMs()
    let updatedAddresses: Address[]

    if (editingAddress) {
      updatedAddresses = addresses.map(a => {
        if (a.id === editingAddress.id) {
          return {
            ...a,
            name: addressForm.name,
            phone: addressForm.phone,
            region: addressForm.region,
            detail: addressForm.detail,
            isDefault: addressForm.isDefault,
          }
        }
        if (addressForm.isDefault) {
          return { ...a, isDefault: false }
        }
        return a
      })
    } else {
      const newAddress: Address = {
        id: generateId(),
        userId: currentUser!.id,
        name: addressForm.name,
        phone: addressForm.phone,
        region: addressForm.region,
        detail: addressForm.detail,
        isDefault: addressForm.isDefault || addresses.length === 0,
        createdAt: now,
      }
      updatedAddresses = addressForm.isDefault
        ? addresses.map(a => ({ ...a, isDefault: false })).concat(newAddress)
        : [...addresses, newAddress]
    }

    saveAddresses(updatedAddresses)
    setAddresses(updatedAddresses)
    setShowAddressSheet(false)
    setEditingAddress(null)
    setAddressForm({ name: '', phone: '', region: '', detail: '', isDefault: false })
    showToast('success', editingAddress ? '地址已更新' : '地址已添加')
  }

  function handleDeleteAddress(id: string) {
    const updatedAddresses = addresses.filter(a => a.id !== id)
    saveAddresses(updatedAddresses)
    setAddresses(updatedAddresses)
    showToast('success', '地址已删除')
  }

  function openEditAddress(address: Address) {
    setEditingAddress(address)
    setAddressForm({
      name: address.name,
      phone: address.phone,
      region: address.region,
      detail: address.detail,
      isDefault: address.isDefault,
    })
    setShowAddressSheet(true)
  }

  // 取消订单
  function handleCancelOrder(order: Order) {
    const now = nowMs()
    const updatedOrders = orders.map(o => {
      if (o.id === order.id) {
        return { ...o, status: 'cancelled' as OrderStatus }
      }
      return o
    })

    // 返还积分
    const refundTx: PointsTransaction = {
      id: generateId(),
      userId: currentUser!.id,
      type: 'refund',
      change: order.totalPoints,
      source: '订单取消',
      sourceId: order.id,
      createdAt: now,
      remark: `订单取消返还 ${order.totalPoints} 积分`,
    }

    const updatedAccount: PointsAccount = {
      ...pointsAccount!,
      balance: pointsAccount!.balance + order.totalPoints,
      updatedAt: now,
    }

    saveOrders(updatedOrders)
    savePointsTransactions([...transactions, refundTx])
    const allAccounts = loadPointsAccounts()
    savePointsAccounts(allAccounts.map(a => a.userId === currentUser!.id ? updatedAccount : a))

    setOrders(updatedOrders)
    setTransactions([...transactions, refundTx])
    setPointsAccount(updatedAccount)
    setSelectedOrder(null)
    showToast('success', '订单已取消，积分已返还')
  }

  // ===== 渲染 =====

  // 未登录：登录/注册页
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Gift className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">会员积分系统</h1>
            <p className="text-gray-500 mt-2">消费得积分，积分兑好礼</p>
          </div>

          <Card className="p-6 shadow-lg border-0">
            <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
              <button
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                  authMode === 'login' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
                }`}
                onClick={() => { setAuthMode('login'); setAuthError(null) }}
              >
                登录
              </button>
              <button
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                  authMode === 'register' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
                }`}
                onClick={() => { setAuthMode('register'); setAuthError(null) }}
              >
                注册
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">手机号</label>
                <Input
                  type="tel"
                  placeholder="请输入 11 位手机号"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="h-12"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
                <Input
                  type="password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="h-12"
                />
                {authMode === 'register' && (
                  <p className="text-xs text-gray-400 mt-1">密码至少 8 位，需包含字母和数字</p>
                )}
              </div>

              {authMode === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">确认密码</label>
                  <Input
                    type="password"
                    placeholder="请再次输入密码"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="h-12"
                  />
                </div>
              )}

              {authError && (
                <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  {authError}
                </div>
              )}

              <Button
                className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                onClick={handleAuth}
              >
                {authMode === 'login' ? '登录' : '注册'}
              </Button>

              {/* 测试账号快速登录 */}
              {authMode === 'login' && (
                <Button
                  variant="outline"
                  className="w-full h-12 mt-3 border-dashed border-gray-300 text-gray-600"
                  onClick={() => {
                    const users = loadUsers()
                    const testUser = users.find(u => u.phone === '13800138000')
                    if (testUser) {
                      setCurrentUser(testUser)
                      showToast('success', '测试账号登录成功')
                    } else {
                      // 创建测试账号
                      const newTestUser: UserAccount = {
                        id: generateId(),
                        phone: '13800138000',
                        password: 'test1234',
                        createdAt: nowMs(),
                      }
                      saveUsers([...users, newTestUser])
                      
                      // 创建测试账号的积分数据
                      const testAccount: PointsAccount = {
                        userId: newTestUser.id,
                        balance: 50000,
                        totalEarned: 50000,
                        level: 'normal',
                        updatedAt: nowMs(),
                      }
                      const allAccounts = loadPointsAccounts()
                      savePointsAccounts([...allAccounts, testAccount])
                      
                      // 创建测试积分批次
                      const testBatch: PointsBatch = {
                        id: generateId(),
                        userId: newTestUser.id,
                        amount: 50000,
                        remaining: 50000,
                        source: '测试数据',
                        createdAt: nowMs(),
                        expireAt: nowMs() + daysToMs(POINTS_EXPIRE_DAYS),
                      }
                      savePointsBatches([...loadPointsBatches(), testBatch])
                      
                      // 创建测试积分流水
                      const testTx: PointsTransaction = {
                        id: generateId(),
                        userId: newTestUser.id,
                        type: 'earn',
                        change: 50000,
                        source: '测试数据',
                        createdAt: nowMs(),
                        expireAt: nowMs() + daysToMs(POINTS_EXPIRE_DAYS),
                        remark: '测试账号初始积分',
                      }
                      savePointsTransactions([...loadPointsTransactions(), testTx])
                      
                      setCurrentUser(newTestUser)
                      showToast('success', '测试账号已创建并登录')
                    }
                  }}
                >
                  使用测试账号快速体验
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg text-white text-sm ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}>
            {toast.message}
          </div>
        )}
      </div>
    )
  }

  // 已登录：主界面
  const levelInfo = getNextLevelThreshold(pointsAccount?.totalEarned || 0)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg text-white text-sm z-50 ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {toast.message}
        </div>
      )}

      {/* 首页 */}
      {tab === 'home' && (
        <div className="p-4 space-y-4">
          {/* 会员等级卡片 */}
          <div className={`${getLevelCardClass(pointsAccount?.level || 'normal')} rounded-2xl p-5 text-white shadow-lg relative overflow-hidden`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                {getLevelIcon(pointsAccount?.level || 'normal')}
              </div>
              <div className="flex-1">
                <div className="text-white/80 text-sm">{maskPhone(currentUser.phone)}</div>
                <div className="text-xl font-bold mt-1">{getLevelLabel(pointsAccount?.level || 'normal')}</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-sm text-white/80 mb-1">
                <span>成长值 {pointsAccount?.totalEarned.toLocaleString()}</span>
                {levelInfo.nextLevel && <span>{levelInfo.threshold.toLocaleString()} 升级</span>}
              </div>
              {levelInfo.nextLevel && (
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all"
                    style={{ width: `${(levelInfo.current / levelInfo.threshold) * 100}%` }}
                  />
                </div>
              )}
              {!levelInfo.nextLevel && (
                <div className="text-sm text-white/80">已达到最高等级</div>
              )}
            </div>
          </div>

          {/* 积分总览 */}
          <Card className="p-5 shadow-sm border-0">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-500 text-sm">可用积分</div>
                <div className="text-3xl font-bold text-gray-900 mt-1">
                  {pointsAccount?.balance.toLocaleString() || 0}
                </div>
              </div>
              <div className="text-right">
                <div className="text-gray-500 text-sm">累计获得</div>
                <div className="text-lg font-semibold text-gray-700 mt-1">
                  {pointsAccount?.totalEarned.toLocaleString() || 0}
                </div>
              </div>
            </div>
            {expiringPoints > 0 && (
              <div className="mt-4 bg-amber-50 rounded-lg p-3 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                <span className="text-sm text-amber-700">
                  {expiringPoints.toLocaleString()} 积分即将在 30 天内过期
                </span>
              </div>
            )}
          </Card>

          {/* 消费获得积分 */}
          <Card className="p-5 shadow-sm border-0">
            <h3 className="font-semibold text-gray-900 mb-4">模拟消费获得积分</h3>
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  type="number"
                  placeholder="输入消费金额（元）"
                  value={consumptionAmount}
                  onChange={e => setConsumptionAmount(e.target.value)}
                  className="h-12"
                />
                {consumptionError && (
                  <p className="text-red-500 text-xs mt-1">{consumptionError}</p>
                )}
              </div>
              <Button
                className="h-12 px-6 bg-gradient-to-r from-blue-500 to-purple-600"
                onClick={handleEarnPoints}
              >
                获得
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-2">1 元 = {POINTS_PER_YUAN} 积分，有效期 {POINTS_EXPIRE_DAYS} 天</p>
          </Card>

          {/* 快捷入口 */}
          <div className="grid grid-cols-2 gap-3">
            <Card
              className="p-4 shadow-sm border-0 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setTab('mall')}
            >
              <ShoppingBag className="w-8 h-8 text-blue-500 mb-2" />
              <div className="font-medium text-gray-900">积分商城</div>
              <div className="text-xs text-gray-500 mt-1">用积分兑换好礼</div>
            </Card>
            <Card
              className="p-4 shadow-sm border-0 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setTab('orders')}
            >
              <ClipboardList className="w-8 h-8 text-purple-500 mb-2" />
              <div className="font-medium text-gray-900">我的订单</div>
              <div className="text-xs text-gray-500 mt-1">查看兑换记录</div>
            </Card>
          </div>
        </div>
      )}

      {/* 积分商城 */}
      {tab === 'mall' && (
        <div className="p-4">
          {/* 分类筛选 */}
          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat}
                className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-600 border border-gray-200'
                }`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* 商品列表 */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            {filteredProducts.map(product => (
              <Card
                key={product.id}
                className="overflow-hidden shadow-sm border-0 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => goToOrderConfirm(product)}
              >
                <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <Gift className="w-12 h-12 text-gray-400" />
                </div>
                <div className="p-3">
                  <div className="font-medium text-gray-900 text-sm line-clamp-2">{product.name}</div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-blue-600 font-bold">{product.pointsPrice.toLocaleString()} 积分</span>
                    <span className={`text-xs ${product.stock > 0 ? 'text-gray-400' : 'text-red-400'}`}>
                      {product.stock > 0 ? `库存 ${product.stock}` : '售罄'}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              暂无商品
            </div>
          )}
        </div>
      )}

      {/* 订单确认页 */}
      {tab === 'orderConfirm' && selectedProduct && (
        <div className="min-h-screen bg-gray-50 pb-24">
          {/* 顶部导航 */}
          <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
            <div className="flex items-center justify-between p-4">
              <button onClick={() => { setTab('mall'); setSelectedProduct(null) }} className="text-gray-600">
                <X className="w-6 h-6" />
              </button>
              <h1 className="font-bold text-gray-900">确认订单</h1>
              <div className="w-6" />
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* 收货地址 */}
            <Card className="p-4 shadow-sm border-0 relative">
              {addresses.length > 0 ? (
                <>
                  {selectedAddressId ? (
                    (() => {
                      const addr = addresses.find(a => a.id === selectedAddressId)
                      if (!addr) return <div className="text-gray-400">请选择收货地址</div>
                      return (
                        <div onClick={() => setShowAddressSelectSheet(true)}>
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="w-5 h-5 text-blue-500" />
                            <span className="font-medium text-gray-900">{addr.name}</span>
                            <span className="text-gray-500">{maskPhone(addr.phone)}</span>
                            {addr.isDefault && (
                              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">默认</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 ml-7">{addr.region} {addr.detail}</div>
                        </div>
                      )
                    })()
                  ) : (
                    <div className="flex items-center gap-3 text-gray-400" onClick={() => setShowAddressSelectSheet(true)}>
                      <MapPin className="w-5 h-5" />
                      <span>请选择收货地址</span>
                    </div>
                  )}
                  <ChevronRight className="w-5 h-5 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2" />
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-amber-600 mb-3">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm">请先添加收货地址</span>
                  </div>
                  <Input
                    placeholder="收件人姓名"
                    value={addressForm.name}
                    onChange={e => setAddressForm({ ...addressForm, name: e.target.value })}
                    className="h-12"
                  />
                  <Input
                    placeholder="手机号"
                    value={addressForm.phone}
                    onChange={e => setAddressForm({ ...addressForm, phone: e.target.value })}
                    className="h-12"
                  />
                  <Input
                    placeholder="省市区（如：广东省深圳市南山区）"
                    value={addressForm.region}
                    onChange={e => setAddressForm({ ...addressForm, region: e.target.value })}
                    className="h-12"
                  />
                  <Input
                    placeholder="详细地址"
                    value={addressForm.detail}
                    onChange={e => setAddressForm({ ...addressForm, detail: e.target.value })}
                    className="h-12"
                  />
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={addressForm.isDefault}
                      onChange={e => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-600">设为默认地址</span>
                  </label>
                </div>
              )}
            </Card>

            {/* 商品信息 */}
            <Card className="p-4 shadow-sm border-0">
              <div className="flex gap-4">
                <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Gift className="w-10 h-10 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 line-clamp-2">{selectedProduct.name}</div>
                  <div className="text-blue-600 font-bold mt-1">
                    {selectedProduct.pointsPrice.toLocaleString()} 积分
                  </div>
                </div>
              </div>
            </Card>

            {/* 数量选择 */}
            <Card className="p-4 shadow-sm border-0">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">兑换数量</span>
                <div className="flex items-center gap-4">
                  <button
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-lg"
                    onClick={() => setRedeemQuantity(Math.max(1, redeemQuantity - 1))}
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-medium">{redeemQuantity}</span>
                  <button
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-lg"
                    onClick={() => setRedeemQuantity(Math.min(selectedProduct.stock, redeemQuantity + 1))}
                  >
                    +
                  </button>
                </div>
              </div>
            </Card>

            {/* 积分信息 */}
            <Card className="p-4 shadow-sm border-0">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-600">商品积分</span>
                <span className="text-gray-900">{(selectedProduct.pointsPrice * redeemQuantity).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-600">可用积分</span>
                <span className="text-gray-900">{pointsAccount?.balance.toLocaleString() || 0}</span>
              </div>
              <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                <span className="font-medium text-gray-900">需支付积分</span>
                <span className="text-blue-600 font-bold text-lg">
                  {(selectedProduct.pointsPrice * redeemQuantity).toLocaleString()}
                </span>
              </div>
            </Card>
          </div>

          {/* 底部提交栏 */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-600">合计</span>
              <span className="text-blue-600 font-bold text-xl">
                {(selectedProduct.pointsPrice * redeemQuantity).toLocaleString()} 积分
              </span>
            </div>
            {addresses.length === 0 ? (
              <Button
                className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600"
                onClick={() => {
                  // 验证并保存地址
                  if (!addressForm.name.trim()) {
                    showToast('error', '请输入收件人姓名')
                    return
                  }
                  if (!validatePhone(addressForm.phone)) {
                    showToast('error', '请输入正确的手机号')
                    return
                  }
                  if (!addressForm.region.trim() || !addressForm.detail.trim()) {
                    showToast('error', '请填写完整地址')
                    return
                  }
                  
                  const now = nowMs()
                  const newAddress: Address = {
                    id: generateId(),
                    userId: currentUser!.id,
                    name: addressForm.name,
                    phone: addressForm.phone,
                    region: addressForm.region,
                    detail: addressForm.detail,
                    isDefault: true,
                    createdAt: now,
                  }
                  const updatedAddresses = [newAddress]
                  saveAddresses(updatedAddresses)
                  setAddresses(updatedAddresses)
                  setSelectedAddressId(newAddress.id)
                  setAddressForm({ name: '', phone: '', region: '', detail: '', isDefault: false })
                  showToast('success', '地址已添加')
                }}
              >
                保存地址并兑换
              </Button>
            ) : (
              <Button
                className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600"
                onClick={handleRedeem}
                disabled={selectedProduct.stock === 0 || !selectedAddressId || (pointsAccount?.balance || 0) < selectedProduct.pointsPrice * redeemQuantity}
              >
                {selectedProduct.stock === 0 ? '已售罄' :
                 !selectedAddressId ? '请选择地址' :
                 (pointsAccount?.balance || 0) < selectedProduct.pointsPrice * redeemQuantity ? '积分不足' :
                 '确认兑换'}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 地址选择弹窗 */}
      {showAddressSelectSheet && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAddressSelectSheet(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[70vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <h3 className="text-lg font-bold">选择收货地址</h3>
              <button onClick={() => setShowAddressSelectSheet(false)}>
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[50vh]">
              {addresses.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-4">暂无收货地址</p>
                  <Button
                    onClick={() => {
                      setShowAddressSelectSheet(false)
                      setEditingAddress(null)
                      setAddressForm({ name: '', phone: '', region: '', detail: '', isDefault: false })
                      setShowAddressSheet(true)
                    }}
                  >
                    添加地址
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map(addr => (
                    <Card
                      key={addr.id}
                      className={`p-4 cursor-pointer border-2 transition-all ${
                        selectedAddressId === addr.id ? 'border-blue-500 bg-blue-50' : 'border-transparent'
                      }`}
                      onClick={() => {
                        setSelectedAddressId(addr.id)
                        setShowAddressSelectSheet(false)
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900">{addr.name}</span>
                            <span className="text-gray-500 text-sm">{maskPhone(addr.phone)}</span>
                            {addr.isDefault && (
                              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">默认</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">{addr.region} {addr.detail}</div>
                        </div>
                        <button
                          className="text-blue-500 text-sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowAddressSelectSheet(false)
                            openEditAddress(addr)
                          }}
                        >
                          编辑
                        </button>
                      </div>
                    </Card>
                  ))}
                  <Button
                    variant="outline"
                    className="w-full h-12 mt-2"
                    onClick={() => {
                      setShowAddressSelectSheet(false)
                      setEditingAddress(null)
                      setAddressForm({ name: '', phone: '', region: '', detail: '', isDefault: false })
                      setShowAddressSheet(true)
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    新增收货地址
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 订单 */}
      {tab === 'orders' && (
        <div className="p-4 space-y-3">
          <h2 className="text-lg font-bold text-gray-900">我的订单</h2>

          {orders.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              暂无订单
            </div>
          ) : (
            orders.sort((a, b) => b.createdAt - a.createdAt).map(order => {
              const product = products.find(p => p.id === order.items[0]?.productId)
              return (
                <Card
                  key={order.id}
                  className="p-4 shadow-sm border-0 cursor-pointer"
                  onClick={() => setSelectedOrder(order)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Gift className="w-8 h-8 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {product?.name || '未知商品'}
                        {order.items.length > 1 && ` 等 ${order.items.length} 件`}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {order.totalPoints.toLocaleString()} 积分
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        order.status === 'completed' ? 'bg-green-100 text-green-600' :
                        order.status === 'cancelled' ? 'bg-gray-100 text-gray-500' :
                        order.status === 'shipped' ? 'bg-blue-100 text-blue-600' :
                        'bg-amber-100 text-amber-600'
                      }`}>
                        {getOrderStatusLabel(order.status)}
                      </span>
                    </div>
                  </div>
                </Card>
              )
            })
          )}
        </div>
      )}

      {/* 我的 */}
      {tab === 'profile' && (
        <div className="p-4 space-y-4">
          {/* 会员卡片 */}
          <div className={`${getLevelCardClass(pointsAccount?.level || 'normal')} rounded-2xl p-5 text-white shadow-lg`}>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                {getLevelIcon(pointsAccount?.level || 'normal')}
              </div>
              <div>
                <div className="text-xl font-bold">{getLevelLabel(pointsAccount?.level || 'normal')}</div>
                <div className="text-white/80 text-sm mt-1">{maskPhone(currentUser.phone)}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-center">
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-2xl font-bold">{pointsAccount?.balance.toLocaleString() || 0}</div>
                <div className="text-xs text-white/80 mt-1">可用积分</div>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-2xl font-bold">{pointsAccount?.totalEarned.toLocaleString() || 0}</div>
                <div className="text-xs text-white/80 mt-1">累计积分</div>
              </div>
            </div>
          </div>

          {/* 积分明细 */}
          <Card className="shadow-sm border-0">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <span className="font-semibold text-gray-900">积分明细</span>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {transactions.length === 0 ? (
                <div className="p-4 text-center text-gray-400 text-sm">暂无记录</div>
              ) : (
                transactions.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 10).map(tx => (
                  <div key={tx.id} className="p-4 border-b border-gray-50 last:border-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900 text-sm">{tx.source}</div>
                        <div className="text-xs text-gray-400 mt-1">{formatDateTime(tx.createdAt)}</div>
                      </div>
                      <span className={`font-bold ${tx.change > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {tx.change > 0 ? '+' : ''}{tx.change.toLocaleString()}
                      </span>
                    </div>
                    {tx.remark && <div className="text-xs text-gray-400 mt-1">{tx.remark}</div>}
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* 收货地址 */}
          <Card className="shadow-sm border-0">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <span className="font-semibold text-gray-900">收货地址</span>
              <button
                className="text-blue-500 text-sm"
                onClick={() => {
                  setEditingAddress(null)
                  setAddressForm({ name: '', phone: '', region: '', detail: '', isDefault: false })
                  setShowAddressSheet(true)
                }}
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            {addresses.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-sm">暂无地址</div>
            ) : (
              addresses.map(addr => (
                <div key={addr.id} className="p-4 border-b border-gray-50 last:border-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{addr.name}</span>
                        <span className="text-gray-500 text-sm">{maskPhone(addr.phone)}</span>
                        {addr.isDefault && (
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">默认</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">{addr.region} {addr.detail}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="text-blue-500 text-sm"
                        onClick={() => openEditAddress(addr)}
                      >
                        编辑
                      </button>
                      <button
                        className="text-red-500 text-sm"
                        onClick={() => handleDeleteAddress(addr.id)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </Card>

          {/* 退出登录 */}
          <Button
            variant="outline"
            className="w-full h-12 text-red-500 border-red-200 hover:bg-red-50"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            退出登录
          </Button>
        </div>
      )}

      {/* 底部导航 - 订单确认页不显示 */}
      {tab !== 'orderConfirm' && (
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-40">
        <div className="flex justify-around">
          {[
            { key: 'home' as TabKey, icon: Home, label: '首页' },
            { key: 'mall' as TabKey, icon: ShoppingBag, label: '商城' },
            { key: 'orders' as TabKey, icon: ClipboardList, label: '订单' },
            { key: 'profile' as TabKey, icon: UserIcon, label: '我的' },
          ].map(item => (
            <button
              key={item.key}
              className={`flex flex-col items-center py-1 px-4 ${
                tab === item.key ? 'text-blue-500' : 'text-gray-400'
              }`}
              onClick={() => setTab(item.key)}
            >
              <item.icon className="w-6 h-6" />
              <span className="text-xs mt-1">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
      )}

      {/* 商品详情/兑换弹窗 - 已移除，改为订单确认页 */}

      {/* 地址编辑弹窗 */}
      {showAddressSheet && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAddressSheet(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-6 animate-slide-up">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{editingAddress ? '编辑地址' : '新增地址'}</h3>
              <button onClick={() => setShowAddressSheet(false)}>
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <Input
                placeholder="收件人姓名"
                value={addressForm.name}
                onChange={e => setAddressForm({ ...addressForm, name: e.target.value })}
                className="h-12"
              />
              <Input
                placeholder="手机号"
                value={addressForm.phone}
                onChange={e => setAddressForm({ ...addressForm, phone: e.target.value })}
                className="h-12"
              />
              <Input
                placeholder="省市区（如：广东省深圳市南山区）"
                value={addressForm.region}
                onChange={e => setAddressForm({ ...addressForm, region: e.target.value })}
                className="h-12"
              />
              <Input
                placeholder="详细地址"
                value={addressForm.detail}
                onChange={e => setAddressForm({ ...addressForm, detail: e.target.value })}
                className="h-12"
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={addressForm.isDefault}
                  onChange={e => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-600">设为默认地址</span>
              </label>
              <Button
                className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600"
                onClick={handleSaveAddress}
              >
                保存
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 订单详情弹窗 */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedOrder(null)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-6 animate-slide-up max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">订单详情</h3>
              <button onClick={() => setSelectedOrder(null)}>
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {selectedOrder.status === 'pending' && <Clock className="w-5 h-5 text-amber-500" />}
                {selectedOrder.status === 'shipped' && <Truck className="w-5 h-5 text-blue-500" />}
                {selectedOrder.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-500" />}
                {selectedOrder.status === 'cancelled' && <X className="w-5 h-5 text-gray-400" />}
                <span className={`font-medium ${
                  selectedOrder.status === 'completed' ? 'text-green-600' :
                  selectedOrder.status === 'cancelled' ? 'text-gray-500' :
                  selectedOrder.status === 'shipped' ? 'text-blue-600' :
                  'text-amber-600'
                }`}>
                  {getOrderStatusLabel(selectedOrder.status)}
                </span>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <div className="text-sm text-gray-500 mb-2">订单商品</div>
                {selectedOrder.items.map((item, idx) => {
                  const product = products.find(p => p.id === item.productId)
                  return (
                    <div key={idx} className="flex items-center gap-3 py-2">
                      <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                        <Package className="w-6 h-6 text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{product?.name || '未知商品'}</div>
                        <div className="text-xs text-gray-400">x{item.quantity}</div>
                      </div>
                      <div className="text-sm text-gray-600">{item.pointsPrice.toLocaleString()} 积分</div>
                    </div>
                  )
                })}
              </div>

              <div className="border-t border-gray-100 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">订单编号</span>
                  <span className="text-gray-900">{selectedOrder.id}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-gray-500">下单时间</span>
                  <span className="text-gray-900">{formatDateTime(selectedOrder.createdAt)}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-gray-500">消耗积分</span>
                  <span className="text-blue-600 font-medium">{selectedOrder.totalPoints.toLocaleString()}</span>
                </div>
              </div>

              {selectedOrder.status === 'pending' && (
                <Button
                  variant="outline"
                  className="w-full h-12 text-red-500 border-red-200"
                  onClick={() => handleCancelOrder(selectedOrder)}
                >
                  取消订单
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
