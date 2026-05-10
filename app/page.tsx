'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type Role = 'guest' | 'user' | 'admin'
type View = 'landing' | 'adminAuth' | 'userAuth' | 'adminPanel' | 'menu'

type Dish = {
  id: number
  time: string
  location: string
  name: string
  createdBy: string
}

type Suggestion = {
  id: number
  userName: string
  content: string
  createdAt: string
}

type AccountBook = Record<string, string>

type PersistedData = {
  adminAccounts: AccountBook
  userAccounts: AccountBook
  dishes: Dish[]
  suggestions: Suggestion[]
}

const STORAGE_KEY = 'smart-canteen-data-v1'

export default function SmartCanteenApp() {
  const [view, setView] = useState<View>('landing')
  const [role, setRole] = useState<Role>('guest')

  const [adminAccounts, setAdminAccounts] = useState<AccountBook>({ admin: '123456' })
  const [userAccounts, setUserAccounts] = useState<AccountBook>({})

  const [currentAdmin, setCurrentAdmin] = useState('')
  const [currentUser, setCurrentUser] = useState('')

  const [adminName, setAdminName] = useState('')
  const [adminPassword, setAdminPassword] = useState('')

  const [userName, setUserName] = useState('')
  const [userPassword, setUserPassword] = useState('')

  const [dishTime, setDishTime] = useState('')
  const [dishLocation, setDishLocation] = useState('')
  const [dishName, setDishName] = useState('')

  const [suggestionInput, setSuggestionInput] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [dishes, setDishes] = useState<Dish[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    try {
      const data = JSON.parse(raw) as PersistedData
      setAdminAccounts(data.adminAccounts ?? { admin: '123456' })
      setUserAccounts(data.userAccounts ?? {})
      setDishes(data.dishes ?? [])
      setSuggestions(data.suggestions ?? [])
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    const data: PersistedData = { adminAccounts, userAccounts, dishes, suggestions }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [adminAccounts, userAccounts, dishes, suggestions])

  const isLoggedInUser = role === 'user' && currentUser.trim() !== ''

  const sortedDishes = useMemo(() => [...dishes].sort((a, b) => b.id - a.id), [dishes])

  const resetAuthForms = () => {
    setAdminName('')
    setAdminPassword('')
    setUserName('')
    setUserPassword('')
  }

  const handleAdminLogin = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setNotice('')

    if (!adminName.trim() || !adminPassword.trim()) {
      setError('请输入管理员用户名和密码。')
      return
    }

    const savedPassword = adminAccounts[adminName]
    if (savedPassword) {
      if (savedPassword !== adminPassword) {
        setError('管理员密码错误。')
        return
      }
      setNotice('管理员登录成功。')
    } else {
      setAdminAccounts((prev) => ({ ...prev, [adminName]: adminPassword }))
      setNotice('新管理员注册成功并已登录。')
    }

    setCurrentAdmin(adminName)
    setRole('admin')
    setView('adminPanel')
    resetAuthForms()
  }

  const handleUserLogin = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setNotice('')

    if (!userName.trim() || !userPassword.trim()) {
      setError('请输入用户名和密码。')
      return
    }

    const savedPassword = userAccounts[userName]
    if (savedPassword) {
      if (savedPassword !== userPassword) {
        setError('用户密码错误。')
        return
      }
      setNotice('用户登录成功。')
    } else {
      setUserAccounts((prev) => ({ ...prev, [userName]: userPassword }))
      setNotice('新用户注册成功并已登录。')
    }

    setCurrentUser(userName)
    setRole('user')
    setView('menu')
    resetAuthForms()
  }

  const handleUploadDish = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setNotice('')

    if (!dishTime.trim() || !dishLocation.trim() || !dishName.trim()) {
      setError('请完整填写时间、地点和菜品。')
      return
    }

    const dish: Dish = {
      id: Date.now(),
      time: dishTime,
      location: dishLocation,
      name: dishName,
      createdBy: currentAdmin || '未知管理员',
    }

    setDishes((prev) => [dish, ...prev])
    setDishTime('')
    setDishLocation('')
    setDishName('')
    setNotice('菜品上传成功。')
  }

  const handleSubmitSuggestion = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setNotice('')

    if (!isLoggedInUser) {
      setView('userAuth')
      setError('游客请先登录后再提交建议。')
      return
    }

    if (!suggestionInput.trim()) {
      setError('建议内容不能为空。')
      return
    }

    const newSuggestion: Suggestion = {
      id: Date.now(),
      userName: currentUser,
      content: suggestionInput.trim(),
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    }

    setSuggestions((prev) => [newSuggestion, ...prev])
    setSuggestionInput('')
    setNotice('建议提交成功。')
  }

  const goToGuestMenu = () => {
    setRole('guest')
    setCurrentUser('')
    setCurrentAdmin('')
    setView('menu')
    setError('')
    setNotice('当前为游客模式。')
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <h1 className="text-3xl font-bold text-slate-900">智慧食堂系统</h1>

        {notice && (
          <Card className="border-emerald-300 bg-emerald-50">
            <CardContent className="p-4 text-sm text-emerald-700">{notice}</CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
          </Card>
        )}

        {view === 'landing' && (
          <Card>
            <CardHeader>
              <CardTitle>请选择进入方式</CardTitle>
              <CardDescription>支持用户登录、管理方登录和游客浏览。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <Button onClick={() => { setError(''); setNotice(''); setView('userAuth') }}>用户登录</Button>
              <Button variant="secondary" onClick={() => { setError(''); setNotice(''); setView('adminAuth') }}>管理方登录</Button>
              <Button variant="outline" onClick={goToGuestMenu}>浏览（游客模式）</Button>
            </CardContent>
          </Card>
        )}

        {(view === 'adminAuth' || view === 'userAuth') && (
          <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/45 p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>{view === 'adminAuth' ? '管理方登录 / 注册' : '用户登录 / 注册'}</CardTitle>
                <CardDescription>新账号首次登录将自动注册。</CardDescription>
              </CardHeader>
              <CardContent>
                {view === 'adminAuth' ? (
                  <form onSubmit={handleAdminLogin} className="space-y-3">
                    <Input placeholder="用户名（窗口名）" value={adminName} onChange={(e) => setAdminName(e.target.value)} />
                    <Input type="password" placeholder="密码" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
                    <div className="flex gap-3">
                      <Button type="submit">进入管理页</Button>
                      <Button type="button" variant="outline" onClick={() => setView('landing')}>取消</Button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleUserLogin} className="space-y-3">
                    <Input placeholder="用户名" value={userName} onChange={(e) => setUserName(e.target.value)} />
                    <Input type="password" placeholder="密码" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} />
                    <div className="flex gap-3">
                      <Button type="submit">登录</Button>
                      <Button type="button" variant="outline" onClick={() => setView('landing')}>取消</Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {view === 'adminPanel' && (
          <Card>
            <CardHeader>
              <CardTitle>管理方菜品上传</CardTitle>
              <CardDescription>当前管理员：{currentAdmin || '未登录'}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUploadDish} className="grid gap-3 md:grid-cols-3">
                <Input placeholder="时间（如 12:00）" value={dishTime} onChange={(e) => setDishTime(e.target.value)} />
                <Input placeholder="地点（如 A 区食堂）" value={dishLocation} onChange={(e) => setDishLocation(e.target.value)} />
                <Input placeholder="菜品（如 红烧排骨）" value={dishName} onChange={(e) => setDishName(e.target.value)} />
                <div className="md:col-span-3 flex gap-3">
                  <Button type="submit">上传菜品</Button>
                  <Button type="button" variant="secondary" onClick={() => setView('menu')}>查看菜品页</Button>
                  <Button type="button" variant="outline" onClick={() => setView('landing')}>返回首页</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {view === 'menu' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>今日菜品</CardTitle>
                <CardDescription>{role === 'guest' ? '当前为游客模式，可浏览菜品。' : '可查看管理方上传的菜品信息。'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {sortedDishes.length === 0 ? (
                  <p className="text-sm text-slate-500">暂无菜品，请等待管理方上传。</p>
                ) : (
                  sortedDishes.map((dish) => (
                    <div key={dish.id} className="rounded-lg border p-3 text-sm">
                      <p><span className="font-medium">时间：</span>{dish.time}</p>
                      <p><span className="font-medium">地点：</span>{dish.location}</p>
                      <p><span className="font-medium">菜品：</span>{dish.name}</p>
                      <p className="text-xs text-slate-500">上传管理员：{dish.createdBy}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>公开建议区</CardTitle>
                <CardDescription>游客点击提交建议会自动跳转到用户登录界面。</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitSuggestion} className="space-y-3">
                  <Input
                    placeholder={isLoggedInUser ? '请输入建议内容' : '游客需先登录后提交建议'}
                    value={suggestionInput}
                    onChange={(e) => setSuggestionInput(e.target.value)}
                  />
                  <div className="flex gap-3">
                    <Button type="submit">提交建议</Button>
                    {!isLoggedInUser && (
                      <Button type="button" variant="outline" onClick={() => setView('userAuth')}>去用户登录</Button>
                    )}
                    <Button type="button" variant="ghost" onClick={() => setView('landing')}>返回首页</Button>
                  </div>
                </form>

                <div className="mt-4 space-y-2">
                  {suggestions.length === 0 ? (
                    <p className="text-sm text-slate-500">暂无公开建议。</p>
                  ) : (
                    suggestions.map((item) => (
                      <div key={item.id} className="rounded-lg border bg-white p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{item.userName}</p>
                          <p className="text-xs text-slate-500">{item.createdAt}</p>
                        </div>
                        <p className="text-slate-700">{item.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  )
}
