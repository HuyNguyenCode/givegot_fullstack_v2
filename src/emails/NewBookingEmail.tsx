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

export interface NewBookingEmailProps {
  mentorName: string
  menteeName: string
  startTimeFormatted: string
  note?: string | null
  dashboardUrl: string
}

export default function NewBookingEmail({
  mentorName,
  menteeName,
  startTimeFormatted,
  note,
  dashboardUrl,
}: NewBookingEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{menteeName} vừa gửi yêu cầu đặt lịch với bạn trên GiveGot! 🔔</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto my-10 max-w-[480px] rounded-2xl bg-white p-8 shadow-sm">
            <Text className="m-0 text-2xl">🎓</Text>
            <Heading className="mt-2 mb-4 text-xl font-bold text-gray-900">
              Có người muốn học cùng bạn nè, {mentorName}!
            </Heading>
            <Text className="text-base leading-6 text-gray-700">
              <strong>{menteeName}</strong> vừa gửi một yêu cầu đặt lịch buổi học mới trên{' '}
              <strong>GiveGot</strong>. Chốt lịch nhanh để không bỏ lỡ cơ hội chia sẻ kiến thức nha! ⚡
            </Text>

            <Section className="my-5 rounded-xl bg-purple-50 p-4">
              <Text className="m-0 text-sm font-semibold text-purple-700">🕐 Thời gian đề xuất</Text>
              <Text className="m-0 mt-1 text-base font-bold text-gray-900">{startTimeFormatted}</Text>
              {note ? (
                <>
                  <Text className="m-0 mt-3 text-sm font-semibold text-purple-700">💬 Lời nhắn từ mentee</Text>
                  <Text className="m-0 mt-1 text-sm text-gray-700">{note}</Text>
                </>
              ) : null}
            </Section>

            <Button
              href={dashboardUrl}
              className="box-border rounded-lg bg-purple-600 px-6 py-3 text-center text-sm font-semibold text-white"
            >
              Xem &amp; Phản hồi ngay
            </Button>

            <Hr className="my-6 border-gray-200" />
            <Text className="text-xs text-gray-400">
              Bạn nhận được email này vì đang là mentor trên GiveGot. Đừng để mentee đợi lâu nhé — phản hồi
              sớm giúp bạn giữ Trust Score cao hơn đó! 💜
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
