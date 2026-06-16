import Link from 'next/link'
import { LogOut } from 'lucide-react'

interface NavbarProps {
  serverCount: number
  onLogout: () => void
  isLoggedIn: boolean
}

export function Navbar({ serverCount, onLogout, isLoggedIn }: NavbarProps) {
  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-gray-900">
              DDNS Dashboard
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {serverCount} servers connected
            </span>
            {isLoggedIn && (
              <button
                onClick={onLogout}
                className="inline-flex items-center px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900"
              >
                <LogOut className="h-4 w-4 mr-1" />
                退出
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
