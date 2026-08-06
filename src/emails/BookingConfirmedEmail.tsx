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

export interface BookingConfirmedEmailProps {
  menteeName: string
  mentorName: string
  startTimeFormatted: string
  meetingUrl?: string | null
  dashboardUrl: string
}

export default function BookingConfirmedEmail({
  menteeName,
  mentorName,
  startTimeFormatted,
  meetingUrl,
  dashboardUrl,
}: BookingConfirmedEmailProps) {
  return (
    <Html lang="vi">
      <Head />
      <Preview>{mentorName} đã xác nhận buổi học của bạn 🎉</Preview>
      <Tailwind>
        <Body className="m-0 bg-slate-100 px-4 py-8 font-sans">
          <Container className="mx-auto max-w-[520px] rounded-2xl bg-white p-8 shadow-sm">
            <Text className="m-0 text-3xl">🎉</Text>
            <Heading className="mb-3 mt-3 text-2xl font-bold text-slate-900">
              Chốt kèo thành công rồi, {menteeName} ơi!
            </Heading>
            <Text className="text-base leading-7 text-slate-600">
              Mentor <strong className="text-slate-900">{mentorName}</strong> đã nhận lời buổi học
              của bạn. Chuẩn bị câu hỏi và tinh thần học hết mình thôi nào 🚀
            </Text>

            <Section className="my-6 rounded-xl bg-emerald-50 p-5">
              <Text className="m-0 text-xs font-bold uppercase tracking-wide text-emerald-700">
                Lịch đã xác nhận
              </Text>
              <Text className="mb-0 mt-2 text-base font-bold text-slate-900">
                🕐 {startTimeFormatted}
              </Text>
              {meetingUrl ? (
                <Text className="mb-0 mt-4 text-sm leading-6 text-emerald-800">
                  🔗 Link Google Meet đã sẵn sàng trong dashboard của bạn.
                </Text>
              ) : (
                <Text className="mb-0 mt-4 text-sm leading-6 text-emerald-800">
                  Vào dashboard trước giờ học để xem thông tin tham gia nhé.
                </Text>
              )}
            </Section>

            <Button
              href={dashboardUrl}
              className="box-border rounded-lg bg-violet-600 px-6 py-3 text-center text-sm font-bold text-white"
            >
              Xem chi tiết buổi học
            </Button>

            <Hr className="my-6 border-slate-200" />
            <Text className="m-0 text-xs leading-5 text-slate-400">
              Email tự động từ GiveGot — nhớ vào lớp đúng giờ để buổi học thật trọn vẹn nha 💜
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
