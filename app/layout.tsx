import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '智慧食堂系统',
  description: '支持用户登录、管理方登录和游客浏览的智慧食堂原型系统。',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
