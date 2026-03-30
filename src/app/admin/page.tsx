import { getAdminStats } from '@/actions/admin'
import { Users, Calendar, Coins, AlertCircle, CheckSquare } from 'lucide-react'

export default async function AdminDashboard() {
  const stats = await getAdminStats()

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600'
    },
    {
      title: 'Total Bookings',
      value: stats.totalBookings,
      icon: Calendar,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600'
    },
    {
      title: 'Circulating GivePoints',
      value: stats.totalGivePoints,
      icon: Coins,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600'
    },
    {
      title: 'Pending Skills',
      value: stats.pendingSkills,
      icon: CheckSquare,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600'
    },
    {
      title: 'Pending Reports',
      value: stats.pendingReports,
      icon: AlertCircle,
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
      textColor: 'text-red-600'
    }
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Dashboard Overview</h2>
        <p className="text-gray-600">Monitor key metrics and platform statistics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.title}
              className="bg-white rounded-lg shadow-md p-6 border-l-4 border-gray-200 hover:shadow-lg transition"
              style={{ borderLeftColor: stat.color.replace('bg-', '') }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600">{stat.title}</h3>
                <div className={`${stat.bgColor} p-3 rounded-lg`}>
                  <Icon className={`w-6 h-6 ${stat.textColor}`} />
                </div>
              </div>
              <div className={`text-4xl font-bold ${stat.textColor}`}>
                {stat.value.toLocaleString()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="/admin/users"
            className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition group"
          >
            <Users className="w-6 h-6 text-gray-600 group-hover:text-blue-600 transition" />
            <div>
              <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition">
                Manage Users
              </div>
              <div className="text-sm text-gray-500">View and edit user accounts</div>
            </div>
          </a>

          <a
            href="/admin/skills"
            className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition group"
          >
            <CheckSquare className="w-6 h-6 text-gray-600 group-hover:text-orange-600 transition" />
            <div>
              <div className="font-semibold text-gray-900 group-hover:text-orange-600 transition">
                Review Skills
              </div>
              <div className="text-sm text-gray-500">
                {stats.pendingSkills > 0 
                  ? `${stats.pendingSkills} pending approval` 
                  : 'All skills reviewed'}
              </div>
            </div>
          </a>

          <a
            href="/admin/reports"
            className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-red-500 hover:bg-red-50 transition group"
          >
            <AlertCircle className="w-6 h-6 text-gray-600 group-hover:text-red-600 transition" />
            <div>
              <div className="font-semibold text-gray-900 group-hover:text-red-600 transition">
                Handle Reports
              </div>
              <div className="text-sm text-gray-500">
                {stats.pendingReports > 0 
                  ? `${stats.pendingReports} reports pending` 
                  : 'No pending reports'}
              </div>
            </div>
          </a>

          <a
            href="/homepage"
            className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition group"
          >
            <Users className="w-6 h-6 text-gray-600 group-hover:text-purple-600 transition" />
            <div>
              <div className="font-semibold text-gray-900 group-hover:text-purple-600 transition">
                View as User
              </div>
              <div className="text-sm text-gray-500">Switch to user interface</div>
            </div>
          </a>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg shadow-md p-6 border-2 border-green-200">
        <div className="flex items-center gap-3">
          <div className="bg-green-500 p-2 rounded-full">
            <CheckSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">System Status: Operational</h3>
            <p className="text-sm text-gray-600">All services running normally</p>
          </div>
        </div>
      </div>
    </div>
  )
}
