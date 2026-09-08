// BR-11: approval is a moderation decision, READY is publication readiness.
export const PUBLISHED_SKILL_WHERE = {
  status: 'APPROVED',
  embeddingStatus: 'READY',
} as const

export function skillPublicationLabel(skill: { status: string; embeddingStatus: string }): string {
  if (skill.status === 'PENDING') return 'Chờ admin duyệt — chưa xuất hiện trong tìm kiếm'
  if (skill.status === 'REJECTED') return 'Đã từ chối — không xuất hiện trong tìm kiếm'
  if (skill.embeddingStatus === 'READY') return 'Đã duyệt · Sẵn sàng tìm kiếm'
  if (skill.embeddingStatus === 'FAILED') return 'Đã duyệt · Lỗi chuẩn bị tìm kiếm'
  if (skill.embeddingStatus === 'PROCESSING') return 'Đã duyệt · Đang chuẩn bị tìm kiếm'
  return 'Đã duyệt · Chờ chuẩn bị tìm kiếm'
}
