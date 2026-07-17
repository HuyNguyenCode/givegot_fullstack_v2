'use client'

import { useEffect, useState } from 'react'
import { getAllUsers, updateUser, deleteUser, toggleUserSuspension, adjustUserPoints } from '@/actions/admin'
import { UserRole } from '@prisma/client'
import Image from 'next/image'
import { Shield, Coins, AlertTriangle, Edit, Trash2, Search, Ban, CheckCircle } from 'lucide-react'

interface UserData {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  role: UserRole
  givePoints: number
  isSuspended: boolean
  createdAt: Date
  _count: {
    mentoring: number
    learning: number
    reportsReceived: number
  }
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all')
  
  // Edit Modal State
  const [editingUser, setEditingUser] = useState<UserData | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    role: 'USER' as UserRole,
    givePoints: 0,
    isSuspended: false
  })
  const [isSaving, setIsSaving] = useState(false)

  // Points Adjustment Modal State
  const [adjustingUser, setAdjustingUser] = useState<UserData | null>(null)
  const [pointsAdjustment, setPointsAdjustment] = useState(0)
  const [isAdjusting, setIsAdjusting] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setIsLoading(true)
    try {
      const data = await getAllUsers()
      setUsers(data as UserData[])
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const openEditModal = (user: UserData) => {
    setEditingUser(user)
    setEditForm({
      name: user.name || '',
      role: user.role,
      givePoints: user.givePoints,
      isSuspended: user.isSuspended
    })
  }

  const handleSaveUser = async () => {
    if (!editingUser) return

    setIsSaving(true)
    const result = await updateUser(editingUser.id, {
      name: editForm.name || undefined,
      role: editForm.role,
      givePoints: editForm.givePoints,
      isSuspended: editForm.isSuspended
    })

    if (result.success) {
      alert(result.message)
      setEditingUser(null)
      loadUsers()
    } else {
      alert(result.message)
    }
    setIsSaving(false)
  }

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn XÓA người dùng "${userName}"? Hành động này không thể hoàn tác.`)) {
      return
    }

    const result = await deleteUser(userId)
    if (result.success) {
      alert(result.message)
      loadUsers()
    } else {
      alert(result.message)
    }
  }

  const handleToggleSuspension = async (userId: string, currentStatus: boolean) => {
    const action = currentStatus ? 'kích hoạt' : 'khóa'
    if (!confirm(`Bạn có chắc chắn muốn ${action} người dùng này?`)) return

    const result = await toggleUserSuspension(userId, !currentStatus)
    if (result.success) {
      alert(result.message)
      loadUsers()
    } else {
      alert(result.message)
    }
  }

  const handlePointsAdjustment = async () => {
    if (!adjustingUser || pointsAdjustment === 0) return

    setIsAdjusting(true)
    const result = await adjustUserPoints(
      adjustingUser.id,
      pointsAdjustment,
      'Admin adjustment'
    )

    if (result.success) {
      alert(result.message)
      setAdjustingUser(null)
      setPointsAdjustment(0)
      loadUsers()
    } else {
      alert(result.message)
    }
    setIsAdjusting(false)
  }

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesRole = 
      roleFilter === 'all' ||
      (roleFilter === 'user' && user.role === 'USER') ||
      (roleFilter === 'admin' && user.role === 'ADMIN')
    
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && !user.isSuspended) ||
      (statusFilter === 'suspended' && user.isSuspended)

    return matchesSearch && matchesRole && matchesStatus
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Quản lý người dùng</h2>
        <p className="text-gray-600">Quản lý đầy đủ (thêm/sửa/xóa) tài khoản người dùng</p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-sm text-gray-600">Tổng số người dùng</div>
          <div className="text-2xl font-bold text-blue-600">{users.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-sm text-gray-600">Quản trị viên</div>
          <div className="text-2xl font-bold text-red-600">
            {users.filter(u => u.role === 'ADMIN').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-sm text-gray-600">Người dùng hoạt động</div>
          <div className="text-2xl font-bold text-green-600">
            {users.filter(u => !u.isSuspended).length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-sm text-gray-600">Đã khóa</div>
          <div className="text-2xl font-bold text-orange-600">
            {users.filter(u => u.isSuspended).length}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên hoặc email..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          >
            <option value="all">Tất cả vai trò</option>
            <option value="user">Chỉ người dùng</option>
            <option value="admin">Chỉ quản trị viên</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Chỉ đang hoạt động</option>
            <option value="suspended">Chỉ bị khóa</option>
          </select>
        </div>

        <div className="mt-3 text-sm text-gray-600">
          Hiển thị {filteredUsers.length} trong số {users.length} người dùng
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Người dùng
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vai trò
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Điểm
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hoạt động
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      {user.avatarUrl && (
                        <Image
                          src={user.avatarUrl}
                          alt={user.name || 'Người dùng'}
                          width={40}
                          height={40}
                          className="rounded-full"
                        />
                      )}
                      <div>
                        <div className="font-semibold text-gray-900">
                          {user.name || 'Người dùng ẩn danh'}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        user.role === 'ADMIN'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-purple-600" />
                      <span className="font-semibold text-purple-600">
                        {user.givePoints}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.isSuspended ? (
                      <span className="flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold">
                        <Ban className="w-3 h-3" />
                        Đã khóa
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                        <CheckCircle className="w-3 h-3" />
                        Đang hoạt động
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">
                      <div>Đang dạy: {user._count.mentoring}</div>
                      <div>Đang học: {user._count.learning}</div>
                      {user._count.reportsReceived > 0 && (
                        <div className="text-red-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Báo cáo: {user._count.reportsReceived}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(user)}
                        className="text-blue-600 hover:text-blue-800 p-1"
                        title="Sửa người dùng"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setAdjustingUser(user)}
                        className="text-purple-600 hover:text-purple-800 p-1"
                        title="Điều chỉnh điểm"
                      >
                        <Coins className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleSuspension(user.id, user.isSuspended)}
                        className="text-orange-600 hover:text-orange-800 p-1"
                        title={user.isSuspended ? 'Kích hoạt' : 'Khóa'}
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id, user.name || user.email)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Xóa người dùng"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Sửa người dùng: {editingUser.name || editingUser.email}
            </h3>
            
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tên
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Tên người dùng"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vai trò
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="USER">Người dùng</option>
                  <option value="ADMIN">Quản trị viên</option>
                </select>
              </div>

              {/* GivePoints */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Số dư GivePoints
                </label>
                <input
                  type="number"
                  value={editForm.givePoints}
                  onChange={(e) => setEditForm({ ...editForm, givePoints: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              {/* Suspension Status */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="suspended"
                  checked={editForm.isSuspended}
                  onChange={(e) => setEditForm({ ...editForm, isSuspended: e.target.checked })}
                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <label htmlFor="suspended" className="text-sm font-medium text-gray-700">
                  Khóa tài khoản
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingUser(null)}
                disabled={isSaving}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveUser}
                disabled={isSaving}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 transition disabled:bg-gray-300"
              >
                {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Points Adjustment Modal */}
      {adjustingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Điều chỉnh điểm: {adjustingUser.name || adjustingUser.email}
            </h3>
            
            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-2">Số dư hiện tại:</div>
              <div className="text-3xl font-bold text-purple-600">
                {adjustingUser.givePoints} điểm
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Số điểm điều chỉnh
              </label>
              <input
                type="number"
                value={pointsAdjustment}
                onChange={(e) => setPointsAdjustment(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="Nhập số điểm (dương hoặc âm)"
              />
              <div className="text-sm text-gray-500 mt-2">
                Số dư mới: {adjustingUser.givePoints + pointsAdjustment} điểm
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setAdjustingUser(null)
                  setPointsAdjustment(0)
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Hủy
              </button>
              <button
                onClick={handlePointsAdjustment}
                disabled={isAdjusting || pointsAdjustment === 0}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 transition disabled:bg-gray-300"
              >
                {isAdjusting ? 'Đang xử lý...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
