'use client'

import { useEffect, useState } from 'react'
import { getAllSkills, approveSkill, rejectSkill, createSkill, updateSkill, deleteSkill } from '@/actions/admin'
import { SkillStatus, SkillCategory } from '@prisma/client'
import { CheckCircle, XCircle, Clock, Users, Plus, Edit, Trash2, Search } from 'lucide-react'
import { SKILL_CATEGORY_ORDER, SKILL_CATEGORY_LABELS, SKILL_CATEGORY_BADGE_CLASSES } from '@/lib/skill-category'

interface SkillData {
  id: string
  name: string
  slug: string
  category: SkillCategory
  status: SkillStatus
  createdAt: Date
  _count: {
    users: number
  }
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [categoryFilter, setCategoryFilter] = useState<'all' | SkillCategory>('all')
  const [processingId, setProcessingId] = useState<string | null>(null)

  // Create Modal State
  const [isCreating, setIsCreating] = useState(false)
  const [createForm, setCreateForm] = useState<{ name: string; category: SkillCategory }>({
    name: '',
    category: SkillCategory.OTHER
  })
  const [isSavingCreate, setIsSavingCreate] = useState(false)

  // Edit Modal State
  const [editingSkill, setEditingSkill] = useState<SkillData | null>(null)
  const [editForm, setEditForm] = useState<{ name: string; category: SkillCategory; status: SkillStatus }>({
    name: '',
    category: SkillCategory.OTHER,
    status: 'PENDING' as SkillStatus
  })
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  useEffect(() => {
    loadSkills()
  }, [])

  const loadSkills = async () => {
    setIsLoading(true)
    try {
      const data = await getAllSkills()
      setSkills(data as SkillData[])
    } catch (error) {
      console.error('Failed to load skills:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const openCreateModal = () => {
    setCreateForm({ name: '', category: SkillCategory.OTHER })
    setIsCreating(true)
  }

  const handleCreateSkill = async () => {
    if (!createForm.name.trim()) {
      alert('Vui lòng nhập tên kỹ năng')
      return
    }

    setIsSavingCreate(true)
    const result = await createSkill({
      name: createForm.name.trim(),
      category: createForm.category,
      status: 'APPROVED' // Master skills are pre-approved
    })

    if (result.success) {
      alert(result.message)
      setIsCreating(false)
      loadSkills()
    } else {
      alert(result.message)
    }
    setIsSavingCreate(false)
  }

  const openEditModal = (skill: SkillData) => {
    setEditingSkill(skill)
    setEditForm({
      name: skill.name,
      category: skill.category,
      status: skill.status
    })
  }

  const handleUpdateSkill = async () => {
    if (!editingSkill) return

    setIsSavingEdit(true)
    const result = await updateSkill(editingSkill.id, {
      name: editForm.name.trim(),
      category: editForm.category,
      status: editForm.status
    })

    if (result.success) {
      alert(result.message)
      setEditingSkill(null)
      loadSkills()
    } else {
      alert(result.message)
    }
    setIsSavingEdit(false)
  }

  const handleDeleteSkill = async (skillId: string, skillName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn XÓA kỹ năng "${skillName}"? Hành động này không thể hoàn tác.`)) {
      return
    }

    const result = await deleteSkill(skillId)
    if (result.success) {
      alert(result.message)
      loadSkills()
    } else {
      alert(result.message)
    }
  }

  const handleApprove = async (skillId: string) => {
    setProcessingId(skillId)
    const result = await approveSkill(skillId)
    if (result.success) {
      alert(result.message)
      loadSkills()
    } else {
      alert(result.message)
    }
    setProcessingId(null)
  }

  const handleReject = async (skillId: string) => {
    if (!confirm('Bạn có chắc chắn muốn từ chối kỹ năng này?')) return

    setProcessingId(skillId)
    const result = await rejectSkill(skillId)
    if (result.success) {
      alert(result.message)
      loadSkills()
    } else {
      alert(result.message)
    }
    setProcessingId(null)
  }

  // Filter skills
  const filteredSkills = skills.filter(skill => {
    const matchesSearch = 
      skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.slug.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'pending' && skill.status === 'PENDING') ||
      (statusFilter === 'approved' && skill.status === 'APPROVED') ||
      (statusFilter === 'rejected' && skill.status === 'REJECTED')
    
    const matchesCategory =
      categoryFilter === 'all' || skill.category === categoryFilter

    return matchesSearch && matchesStatus && matchesCategory
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Quản lý kỹ năng</h2>
          <p className="text-gray-600">Quản lý đầy đủ (thêm/sửa/xóa) các kỹ năng trên nền tảng</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition shadow-md"
        >
          <Plus className="w-5 h-5" />
          Tạo kỹ năng chuẩn
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-sm text-gray-600">Tổng số kỹ năng</div>
          <div className="text-2xl font-bold text-gray-900">{skills.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-sm text-gray-600">Đang chờ duyệt</div>
          <div className="text-2xl font-bold text-orange-600">
            {skills.filter(s => s.status === 'PENDING').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-sm text-gray-600">Đã duyệt</div>
          <div className="text-2xl font-bold text-green-600">
            {skills.filter(s => s.status === 'APPROVED').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-sm text-gray-600">Đã từ chối</div>
          <div className="text-2xl font-bold text-red-600">
            {skills.filter(s => s.status === 'REJECTED').length}
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
                placeholder="Tìm kiếm kỹ năng..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="pending">Đang chờ duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="rejected">Đã từ chối</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'all' | SkillCategory)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          >
            <option value="all">Tất cả danh mục</option>
            {SKILL_CATEGORY_ORDER.map(cat => (
              <option key={cat} value={cat}>{SKILL_CATEGORY_LABELS[cat]}</option>
            ))}
          </select>
        </div>

        <div className="mt-3 text-sm text-gray-600">
          Hiển thị {filteredSkills.length} trong số {skills.length} kỹ năng
        </div>
      </div>

      {/* Skills Table */}
      {filteredSkills.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Không tìm thấy kỹ năng nào</h3>
          <p className="text-gray-600">Hãy thử điều chỉnh bộ lọc hoặc tạo kỹ năng mới</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tên kỹ năng
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Danh mục
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trạng thái
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Người dùng
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ngày tạo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSkills.map((skill) => (
                  <tr key={skill.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-gray-900">{skill.name}</div>
                      <div className="text-sm text-gray-500">{skill.slug}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-sm font-medium ${SKILL_CATEGORY_BADGE_CLASSES[skill.category]}`}>
                        {SKILL_CATEGORY_LABELS[skill.category]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {skill.status === 'PENDING' && (
                          <>
                            <Clock className="w-4 h-4 text-orange-600" />
                            <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold">
                              Đang chờ duyệt
                            </span>
                          </>
                        )}
                        {skill.status === 'APPROVED' && (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                              Đã duyệt
                            </span>
                          </>
                        )}
                        {skill.status === 'REJECTED' && (
                          <>
                            <XCircle className="w-4 h-4 text-red-600" />
                            <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
                              Đã từ chối
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Users className="w-4 h-4" />
                        <span>{skill._count.users}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(skill.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        {skill.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleApprove(skill.id)}
                              disabled={processingId === skill.id}
                              className="text-green-600 hover:text-green-800 p-1"
                              title="Duyệt"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleReject(skill.id)}
                              disabled={processingId === skill.id}
                              className="text-red-600 hover:text-red-800 p-1"
                              title="Từ chối"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => openEditModal(skill)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="Sửa kỹ năng"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSkill(skill.id, skill.name)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Xóa kỹ năng"
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
      )}

      {/* Create Skill Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Tạo kỹ năng chuẩn
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Kỹ năng chuẩn được duyệt sẵn và có thể sử dụng ngay cho tất cả người dùng.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tên kỹ năng *
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Ví dụ: Lập trình React nâng cao"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Danh mục *
                </label>
                <select
                  value={createForm.category}
                  onChange={(e) => setCreateForm({ ...createForm, category: e.target.value as SkillCategory })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  {SKILL_CATEGORY_ORDER.map(cat => (
                    <option key={cat} value={cat}>{SKILL_CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIsCreating(false)}
                disabled={isSavingCreate}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateSkill}
                disabled={isSavingCreate}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 transition disabled:bg-gray-300"
              >
                {isSavingCreate ? 'Đang tạo...' : 'Tạo kỹ năng'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Skill Modal */}
      {editingSkill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Sửa kỹ năng: {editingSkill.name}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tên kỹ năng *
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Danh mục *
                </label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value as SkillCategory })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  {SKILL_CATEGORY_ORDER.map(cat => (
                    <option key={cat} value={cat}>{SKILL_CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trạng thái duyệt *
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as SkillStatus })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="PENDING">Đang chờ duyệt</option>
                  <option value="APPROVED">Đã duyệt</option>
                  <option value="REJECTED">Đã từ chối</option>
                </select>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-xs text-blue-800">
                  <strong>Đang sử dụng:</strong> {editingSkill._count.users} người dùng đang dạy/học kỹ năng này
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingSkill(null)}
                disabled={isSavingEdit}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Hủy
              </button>
              <button
                onClick={handleUpdateSkill}
                disabled={isSavingEdit}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 transition disabled:bg-gray-300"
              >
                {isSavingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
