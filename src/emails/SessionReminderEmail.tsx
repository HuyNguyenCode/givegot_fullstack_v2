import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from '@react-email/components'

export interface SessionReminderEmailProps {
  recipientName: string
  otherPartyName: string
  startTimeFormatted: string
  meetingUrl?: string | null
  dashboardUrl: string
}

export default function SessionReminderEmail({
  recipientName,
  otherPartyName,
  startTimeFormatted,
  meetingUrl,
  dashboardUrl,
}: SessionReminderEmailProps) {
  const actionUrl = meetingUrl || dashboardUrl

  return (
    <Html lang="vi">
      <Head />
      <Preview>Buổi học với {otherPartyName} sắp bắt đầu rồi — vào lớp thôi! ⚡</Preview>
      <Tailwind>
        <Body className="m-0 bg-slate-100 px-4 py-8 font-sans">
          <Container className="mx-auto max-w-[520px] rounded-2xl bg-white p-8 shadow-sm">
            <Text className="m-0 text-3xl">⏰</Text>
            <Heading className="mb-3 mt-3 text-2xl font-bold text-slate-950">
              Sắp tới giờ vào lớp rồi, {recipientName} ơi!
            </Heading>
            <Text className="text-base leading-7 text-slate-600">
              Buổi học của bạn với <strong className="text-slate-950">{otherPartyName}</strong> sẽ
              bắt đầu trong ít phút nữa. Chuẩn bị tài liệu, nước uống và tinh thần học hết mình nha! 🚀
            </Text>

            <Section className="my-6 rounded-xl bg-violet-50 p-5">
              <Text className="m-0 text-xs font-bold uppercase tracking-wide text-violet-700">
                Thời gian bắt đầu
              </Text>
              <Text className="mb-0 mt-2 text-lg font-bold text-slate-950">
                🕐 {startTimeFormatted}
              </Text>

              <Hr className="my-4 border-violet-200" />

              <Text className="m-0 text-xs font-bold uppercase tracking-wide text-violet-700">
                Học cùng
              </Text>
              <Text className="mb-0 mt-2 text-base font-bold text-slate-950">
                👋 {otherPartyName}
              </Text>

              <Hr className="my-4 border-violet-200" />

              <Text className="m-0 text-xs font-bold uppercase tracking-wide text-violet-700">
                Link Google Meet
              </Text>
              {meetingUrl ? (
                <Link
                  href={meetingUrl}
                  className="mt-2 block break-all text-sm font-semibold text-violet-700 underline"
                >
                  {meetingUrl}
                </Link>
              ) : (
                <Text className="mb-0 mt-2 text-sm leading-6 text-slate-600">
                  Link Google Meet chưa khả dụng. Vui lòng kiểm tra dashboard trước giờ học.
                </Text>
              )}
            </Section>

            <Button
              href={actionUrl}
              className="box-border rounded-lg bg-violet-700 px-6 py-3 text-center text-sm font-bold text-white"
            >
              {meetingUrl ? 'Vào Google Meet ngay' : 'Mở dashboard'}
            </Button>

            <Hr className="my-6 border-slate-200" />
            <Text className="m-0 text-xs leading-5 text-slate-400">
              Email nhắc lịch tự động từ GiveGot. Vào lớp đúng giờ là một cách siêu xịn để giữ Trust
              Score và tạo trải nghiệm tốt cho cả hai bên đó 💜
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
