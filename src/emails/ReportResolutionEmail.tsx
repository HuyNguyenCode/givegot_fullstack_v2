import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from '@react-email/components'

export type ReportResolutionDecision = 'MENTEE_ABSENT' | 'MENTOR_ABSENT' | 'SYSTEM_ERROR'
export type ReportResolutionRecipientRole = 'MENTOR' | 'MENTEE'

export interface ReportResolutionEmailProps {
  recipientName: string
  otherPartyName: string
  recipientRole: ReportResolutionRecipientRole
  decision: ReportResolutionDecision
  trustPenalty: number
  sessionTimeFormatted: string
  adminNotes?: string | null
  dashboardUrl: string
}

interface ResolutionCopy {
  title: string
  conclusion: string
  prevailingParty: string
  givePointOutcome: string
  trustScoreOutcome: string
  panelClassName: string
}

function getResolutionCopy(
  decision: ReportResolutionDecision,
  recipientRole: ReportResolutionRecipientRole,
  recipientName: string,
  otherPartyName: string,
  trustPenalty: number
): ResolutionCopy {
  const isMentor = recipientRole === 'MENTOR'
  const mentorName = isMentor ? recipientName : otherPartyName
  const menteeName = isMentor ? otherPartyName : recipientName

  if (decision === 'MENTEE_ABSENT') {
    return {
      title: 'Quyết định cuối cùng: Mentee vắng mặt',
      conclusion: isMentor
        ? `GiveGot xác nhận ${menteeName} là bên vắng mặt trong buổi học. Khiếu nại đã được giải quyết có lợi cho bạn.`
        : 'GiveGot xác nhận bạn là bên vắng mặt trong buổi học. Quyết định này đã hoàn tất quá trình xem xét của Admin.',
      prevailingParty: `Mentor ${mentorName} là bên được xác nhận quyền lợi trong tranh chấp.`,
      givePointOutcome: `1 GivePoint đang bị đóng băng đã được thanh toán cho Mentor ${mentorName}.`,
      trustScoreOutcome: `Mentee ${menteeName} bị giảm ${trustPenalty} Trust Score, với mức điểm tối thiểu là 0. Mentor không bị trừ Trust Score.`,
      panelClassName: isMentor ? 'bg-emerald-50 text-emerald-950' : 'bg-red-50 text-red-950',
    }
  }

  if (decision === 'MENTOR_ABSENT') {
    return {
      title: 'Quyết định cuối cùng: Mentor vắng mặt',
      conclusion: isMentor
        ? 'GiveGot xác nhận bạn là bên vắng mặt trong buổi học. Quyết định này đã hoàn tất quá trình xem xét của Admin.'
        : `GiveGot xác nhận ${mentorName} là bên vắng mặt trong buổi học. Khiếu nại đã được giải quyết có lợi cho bạn.`,
      prevailingParty: `Mentee ${menteeName} là bên được xác nhận quyền lợi trong tranh chấp.`,
      givePointOutcome: `1 GivePoint đang bị đóng băng đã được hoàn lại đầy đủ cho Mentee ${menteeName}.`,
      trustScoreOutcome: `Mentor ${mentorName} bị giảm ${trustPenalty} Trust Score, với mức điểm tối thiểu là 0. Mentee không bị trừ Trust Score.`,
      panelClassName: isMentor ? 'bg-red-50 text-red-950' : 'bg-emerald-50 text-emerald-950',
    }
  }

  return {
    title: 'Quyết định cuối cùng: Lỗi hệ thống',
    conclusion: 'GiveGot xác định dữ liệu không đủ tin cậy do lỗi hệ thống. Không bên nào bị quy trách nhiệm vắng mặt.',
    prevailingParty: 'Không có bên thắng hoặc thua trong tranh chấp này.',
    givePointOutcome: `1 GivePoint đang bị đóng băng đã được hoàn lại đầy đủ cho Mentee ${menteeName}.`,
    trustScoreOutcome: 'Không có Trust Score nào bị khấu trừ đối với Mentor hoặc Mentee.',
    panelClassName: 'bg-blue-50 text-blue-950',
  }
}

export default function ReportResolutionEmail({
  recipientName,
  otherPartyName,
  recipientRole,
  decision,
  trustPenalty,
  sessionTimeFormatted,
  adminNotes,
  dashboardUrl,
}: ReportResolutionEmailProps) {
  const copy = getResolutionCopy(
    decision,
    recipientRole,
    recipientName,
    otherPartyName,
    trustPenalty
  )

  return (
    <Html lang="vi">
      <Head />
      <Preview>{copy.title} — thông báo chính thức từ Admin GiveGot</Preview>
      <Tailwind>
        <Body className="m-0 bg-slate-100 px-4 py-8 font-sans">
          <Container className="mx-auto max-w-[560px] rounded-2xl bg-white p-8 shadow-sm">
            <Text className="m-0 text-xs font-bold uppercase tracking-widest text-violet-700">
              GiveGot · Thông báo từ Admin
            </Text>
            <Heading className="mb-3 mt-3 text-2xl font-bold text-slate-950">
              {copy.title}
            </Heading>
            <Text className="text-base leading-7 text-slate-700">
              Xin chào {recipientName}. {copy.conclusion}
            </Text>

            <Section className={`my-6 rounded-xl p-5 ${copy.panelClassName}`}>
              <Text className="m-0 text-xs font-bold uppercase tracking-wide">Buổi học được xem xét</Text>
              <Text className="mb-0 mt-2 text-base font-bold text-slate-950">
                {sessionTimeFormatted}
              </Text>
              <Hr className="my-4 border-slate-300" />
              <Text className="m-0 text-sm font-bold">Kết luận tranh chấp</Text>
              <Text className="mb-0 mt-1 text-sm leading-6">{copy.prevailingParty}</Text>
              <Text className="mb-0 mt-4 text-sm font-bold">GivePoint bị đóng băng</Text>
              <Text className="mb-0 mt-1 text-sm leading-6">{copy.givePointOutcome}</Text>
              <Text className="mb-0 mt-4 text-sm font-bold">Trust Score</Text>
              <Text className="mb-0 mt-1 text-sm leading-6">{copy.trustScoreOutcome}</Text>
            </Section>

            {adminNotes ? (
              <Section className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <Text className="m-0 text-sm font-bold text-slate-900">Ghi chú của Admin</Text>
                <Text className="mb-0 mt-2 text-sm leading-6 text-slate-700">{adminNotes}</Text>
              </Section>
            ) : null}

            <Text className="text-sm leading-6 text-slate-600">
              Quyết định đã được ghi nhận vào hệ thống và các thay đổi GivePoint, Trust Score đã được
              áp dụng. Vui lòng truy cập dashboard để kiểm tra lịch sử tài khoản.
            </Text>
            <Button
              href={dashboardUrl}
              className="box-border rounded-lg bg-violet-700 px-6 py-3 text-center text-sm font-bold text-white"
            >
              Xem kết quả trên dashboard
            </Button>

            <Hr className="my-6 border-slate-200" />
            <Text className="m-0 text-xs leading-5 text-slate-500">
              Đây là thông báo chính thức được gửi sau khi Admin GiveGot hoàn tất việc xem xét tranh
              chấp. Email này được gửi cho cả Mentor và Mentee để bảo đảm minh bạch.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
