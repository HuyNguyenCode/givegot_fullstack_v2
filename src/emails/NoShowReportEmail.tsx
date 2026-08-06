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

export type NoShowReportVerdict = 'MENTOR_NO_SHOW' | 'FRAUD_DETECTED' | 'DISPUTED'
export type NoShowReportRecipientRole = 'MENTOR' | 'MENTEE'

export interface NoShowReportEmailProps {
  recipientName: string
  otherPartyName: string
  recipientRole: NoShowReportRecipientRole
  verdict: NoShowReportVerdict
  sessionTimeFormatted: string
  dashboardUrl: string
}

interface OutcomeCopy {
  emoji: string
  title: string
  intro: string
  givePointChange: string
  trustScoreChange: string
  nextStep: string
  panelClassName: string
}

function getOutcomeCopy(
  verdict: NoShowReportVerdict,
  recipientRole: NoShowReportRecipientRole,
  otherPartyName: string
): OutcomeCopy {
  const isMentor = recipientRole === 'MENTOR'

  if (verdict === 'MENTOR_NO_SHOW') {
    return isMentor
      ? {
          emoji: '⚠️',
          title: 'Báo cáo vắng mặt đã được xác minh',
          intro: `Dữ liệu tham dự xác nhận bạn không có mặt trong buổi học với ${otherPartyName}.`,
          givePointChange: 'Bạn không nhận GivePoint của buổi học; 1 GivePoint được hoàn lại cho mentee.',
          trustScoreChange: 'Trust Score của bạn giảm 20 điểm, với mức điểm tối thiểu là 0.',
          nextStep: 'Bạn có thể xem lại chi tiết trong dashboard. Nếu cho rằng kết quả chưa chính xác, hãy liên hệ đội ngũ hỗ trợ GiveGot.',
          panelClassName: 'bg-red-50 text-red-900',
        }
      : {
          emoji: '✅',
          title: 'Báo cáo của bạn đã được xác minh',
          intro: `Dữ liệu tham dự xác nhận ${otherPartyName} đã vắng mặt trong buổi học.`,
          givePointChange: '1 GivePoint đã được hoàn lại vào số dư của bạn.',
          trustScoreChange: 'Trust Score của bạn không thay đổi; mentor bị giảm 20 điểm, với mức tối thiểu là 0.',
          nextStep: 'Số dư mới đã được cập nhật. Cảm ơn bạn đã báo cáo để cộng đồng GiveGot an toàn và đáng tin cậy hơn.',
          panelClassName: 'bg-emerald-50 text-emerald-900',
        }
  }

  if (verdict === 'FRAUD_DETECTED') {
    return isMentor
      ? {
          emoji: '🛡️',
          title: 'Báo cáo vắng mặt đã được giải quyết',
          intro: `Dữ liệu tham dự xác nhận cả bạn và ${otherPartyName} đều có mặt trong buổi học.`,
          givePointChange: '1 GivePoint ký quỹ đã được chuyển vào số dư của bạn.',
          trustScoreChange: 'Trust Score của bạn không thay đổi; mentee bị giảm 30 điểm, với mức tối thiểu là 0.',
          nextStep: 'Buổi học đã được đánh dấu hoàn thành. Bạn không cần thực hiện thêm thao tác nào.',
          panelClassName: 'bg-blue-50 text-blue-900',
        }
      : {
          emoji: '⚠️',
          title: 'Báo cáo không khớp dữ liệu tham dự',
          intro: `Dữ liệu tham dự xác nhận cả bạn và ${otherPartyName} đều có mặt trong buổi học.`,
          givePointChange: '1 GivePoint đã ký quỹ được chuyển cho mentor; không có khoản hoàn lại.',
          trustScoreChange: 'Trust Score của bạn giảm 30 điểm, với mức điểm tối thiểu là 0.',
          nextStep: 'Chúng mình hiểu đây có thể là thông tin khó nhận. Bạn có thể xem chi tiết hoặc liên hệ hỗ trợ nếu cần được giải đáp.',
          panelClassName: 'bg-red-50 text-red-900',
        }
  }

  return {
    emoji: '🔎',
    title: 'Báo cáo đang được xem xét',
    intro: `Dữ liệu tham dự của buổi học với ${otherPartyName} chưa đủ để đưa ra kết luận tự động.`,
    givePointChange: isMentor
      ? 'GivePoint của buổi học đang bị đóng băng; chưa có GivePoint nào được cộng vào số dư của bạn.'
      : '1 GivePoint đã ký quỹ vẫn đang bị đóng băng; chưa được hoàn lại hoặc chuyển cho mentor.',
    trustScoreChange: 'Trust Score của cả hai bên chưa thay đổi.',
    nextStep: 'Đội ngũ GiveGot sẽ xem xét thủ công. Bạn sẽ nhận được cập nhật khi có kết quả chính thức.',
    panelClassName: 'bg-amber-50 text-amber-900',
  }
}

export default function NoShowReportEmail({
  recipientName,
  otherPartyName,
  recipientRole,
  verdict,
  sessionTimeFormatted,
  dashboardUrl,
}: NoShowReportEmailProps) {
  const copy = getOutcomeCopy(verdict, recipientRole, otherPartyName)

  return (
    <Html lang="vi">
      <Head />
      <Preview>{copy.title} — cập nhật báo cáo no-show trên GiveGot</Preview>
      <Tailwind>
        <Body className="m-0 bg-slate-100 px-4 py-8 font-sans">
          <Container className="mx-auto max-w-[540px] rounded-2xl bg-white p-8 shadow-sm">
            <Text className="m-0 text-3xl">{copy.emoji}</Text>
            <Heading className="mb-3 mt-3 text-2xl font-bold text-slate-900">
              {recipientName} ơi, {copy.title.toLowerCase()}
            </Heading>
            <Text className="text-base leading-7 text-slate-600">{copy.intro}</Text>

            <Section className={`my-6 rounded-xl p-5 ${copy.panelClassName}`}>
              <Text className="m-0 text-xs font-bold uppercase tracking-wide">Buổi học</Text>
              <Text className="mb-0 mt-2 text-base font-bold text-slate-900">
                🕐 {sessionTimeFormatted}
              </Text>
              <Hr className="my-4 border-slate-200" />
              <Text className="m-0 text-sm font-bold">GivePoint</Text>
              <Text className="mb-0 mt-1 text-sm leading-6">{copy.givePointChange}</Text>
              <Text className="mb-0 mt-4 text-sm font-bold">Trust Score</Text>
              <Text className="mb-0 mt-1 text-sm leading-6">{copy.trustScoreChange}</Text>
            </Section>

            <Text className="text-sm leading-6 text-slate-600">{copy.nextStep}</Text>
            <Button
              href={dashboardUrl}
              className="box-border rounded-lg bg-violet-600 px-6 py-3 text-center text-sm font-bold text-white"
            >
              Xem chi tiết báo cáo
            </Button>

            <Hr className="my-6 border-slate-200" />
            <Text className="m-0 text-xs leading-5 text-slate-400">
              Đây là email tự động về một báo cáo no-show trên GiveGot. Chúng mình luôn cố gắng xử lý
              mọi trường hợp minh bạch và công bằng cho cả hai bên.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
