import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { LayoutDashboard, Users, AlertTriangle, CheckSquare, Home } from 'lucide-react'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Get current session
  const session = await auth()
  
  // If not authenticated, redirect to sign in
  if (!session?.user?.email) {
    redirect('/auth/signin?callbackUrl=/admin')
  }

  // Get user from database to check role
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, name: true, role: true }
  })

  // If user not found or not ADMIN, redirect to homepage
  if (!user || user.role !== 'ADMIN') {
    redirect('/homepage')
  }

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/reports', label: 'Reports', icon: AlertTriangle },
    { href: '/admin/skills', label: 'Skills', icon: CheckSquare },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <header className="bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Admin Panel</h1>
                <p className="text-sm text-red-100">GiveGot Time-Banking Platform</p>
              </div>
            </div>
            <Link
              href="/homepage"
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition"
            >
              <Home className="w-4 h-4" />
              <span className="text-sm font-medium">Back to Site</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <aside className="w-64 flex-shrink-0">
            <nav className="bg-white rounded-lg shadow-md p-4 sticky top-8">
              <div className="space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 transition group"
                    >
                      <Icon className="w-5 h-5 text-gray-600 group-hover:text-red-600 transition" />
                      <span className="font-medium text-gray-700 group-hover:text-red-600 transition">
                        {item.label}
                      </span>
                    </Link>
                  )
                })}
              </div>

              {/* Admin Info */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="text-xs text-gray-500 mb-2">Logged in as:</div>
                <div className="text-sm font-semibold text-gray-900 truncate">
                  {user.name || user.email}
                </div>
                <div className="text-xs text-red-600 font-bold mt-1">ADMIN</div>
              </div>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
