import type { Metadata } from 'next'
import '@/styles/globals.css'
import { Navbar } from '@/components/Navbar'
import { ServerDashboard } from '@/components/ServerDashboard'

export const metadata: Metadata = {
  title: 'DDNS Dashboard',
  description: 'DDNS Agent Management Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
