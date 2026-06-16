import Link from 'next/link'
import { LogOut } from 'lucide-react'

interface NavbarProps {
  serverCount: number
  onLogout: () => void
  wsConnected: boolean
}

export function Navbar({ serverCount, onLogout, wsConnected }: NavbarProps) {
  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold text-gray-900">
              DDNS Dashboard
            </Link>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${wsConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              <span className={`w-2 h-2 rounded-full mr-1 ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
              {wsConnected ? 'WS Connected' : 'WS Disconnected'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {serverCount} servers connected
            </span>
            <button
              onClick={onLogout}
              className="inline-flex items-center px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900"
            >
              <LogOut className="h-4 w-4 mr-1" />
              退出
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
