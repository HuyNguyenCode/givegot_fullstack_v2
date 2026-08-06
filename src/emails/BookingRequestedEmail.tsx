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

export interface BookingRequestedEmailProps {
  mentorName: string
  menteeName: string
  startTimeFormatted: string
  note?: string | null
  dashboardUrl: string
}

export default function BookingRequestedEmail({
  mentorName,
  menteeName,
  startTimeFormatted,
  note,
  dashboardUrl,
}: BookingRequestedEmailProps) {
  return (
    <Html lang="vi">
      <Head />
      <Preview>{menteeName} vừa gửi lời mời học cùng bạn trên GiveGot 🔔</Preview>
      <Tailwind>
        <Body className="m-0 bg-slate-100 px-4 py-8 font-sans">
          <Container className="mx-auto max-w-[520px] rounded-2xl bg-white p-8 shadow-sm">
            <Text className="m-0 text-3xl">🙌</Text>
            <Heading className="mb-3 mt-3 text-2xl font-bold text-slate-900">
              Có kèo chia sẻ kiến thức mới nè, {mentorName}!
            </Heading>
            <Text className="text-base leading-7 text-slate-600">
              <strong className="text-slate-900">{menteeName}</strong> vừa đặt một buổi học với
              bạn. Ghé dashboard xem lịch và phản hồi sớm để bạn ấy khỏi ngóng nha ✨
            </Text>

            <Section className="my-6 rounded-xl bg-violet-50 p-5">
              <Text className="m-0 text-xs font-bold uppercase tracking-wide text-violet-600">
                Thời gian buổi học
              </Text>
              <Text className="mb-0 mt-2 text-base font-bold text-slate-900">
                🕐 {startTimeFormatted}
              </Text>
              {note ? (
                <>
                  <Text className="mb-0 mt-4 text-xs font-bold uppercase tracking-wide text-violet-600">
                    Lời nhắn từ mentee
                  </Text>
                  <Text className="mb-0 mt-2 text-sm leading-6 text-slate-700">“{note}”</Text>
                </>
              ) : null}
            </Section>

            <Button
              href={dashboardUrl}
              className="box-border rounded-lg bg-violet-600 px-6 py-3 text-center text-sm font-bold text-white"
            >
              Xem và phản hồi
            </Button>

            <Hr className="my-6 border-slate-200" />
            <Text className="m-0 text-xs leading-5 text-slate-400">
              Email tự động từ GiveGot — nơi học sinh, sinh viên trao đổi kỹ năng bằng GivePoint 💜
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
