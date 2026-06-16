import Link from 'next/link'

export function Navbar({ serverCount }: { serverCount: number }) {
  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-gray-900">
              DDNS Dashboard
            </Link>
          </div>
          <div className="flex items-center">
            <span className="text-sm text-gray-500">
              {serverCount} servers connected
            </span>
          </div>
        </div>
      </div>
    </nav>
  )
}
