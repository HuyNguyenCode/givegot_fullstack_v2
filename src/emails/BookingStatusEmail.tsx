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

export type BookingStatusKind = 'ACCEPTED' | 'DECLINED' | 'CANCELLED'

export interface BookingStatusEmailProps {
  menteeName: string
  mentorName: string
  status: BookingStatusKind
  startTimeFormatted: string
  meetingUrl?: string | null
  extraMessage?: string | null
  dashboardUrl: string
}

const STATUS_COPY: Record<
  BookingStatusKind,
  { emoji: string; title: string; intro: string; accent: string; buttonLabel: string }
> = {
  ACCEPTED: {
    emoji: '🎉',
    title: 'Yay, lịch học của bạn đã được xác nhận!',
    intro: 'đã đồng ý nhận buổi học với bạn. Chuẩn bị tinh thần lên lớp thôi nào!',
    accent: 'bg-green-50 text-green-700',
    buttonLabel: 'Xem chi tiết buổi học',
  },
  DECLINED: {
    emoji: '😥',
    title: 'Lịch học của bạn đã bị từ chối',
    intro: 'hiện không thể nhận buổi học này. Đừng buồn, GivePoint của bạn đã được hoàn lại rồi!',
    accent: 'bg-red-50 text-red-700',
    buttonLabel: 'Tìm mentor khác',
  },
  CANCELLED: {
    emoji: '📅',
    title: 'Buổi học của bạn vừa bị hủy',
    intro: 'vừa hủy buổi học đã lên lịch. Xem chi tiết để biết thêm về GivePoint & Trust Score nha.',
    accent: 'bg-amber-50 text-amber-700',
    buttonLabel: 'Xem chi tiết',
  },
}

export default function BookingStatusEmail({
  menteeName,
  mentorName,
  status,
  startTimeFormatted,
  meetingUrl,
  extraMessage,
  dashboardUrl,
}: BookingStatusEmailProps) {
  const copy = STATUS_COPY[status]

  return (
    <Html>
      <Head />
      <Preview>{copy.title}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto my-10 max-w-[480px] rounded-2xl bg-white p-8 shadow-sm">
            <Text className="m-0 text-2xl">{copy.emoji}</Text>
            <Heading className="mt-2 mb-4 text-xl font-bold text-gray-900">
              Hi {menteeName}, {copy.title.toLowerCase()}
            </Heading>
            <Text className="text-base leading-6 text-gray-700">
              Mentor <strong>{mentorName}</strong> {copy.intro}
            </Text>

            <Section className={`my-5 rounded-xl p-4 ${copy.accent}`}>
              <Text className="m-0 text-sm font-semibold">🕐 Buổi học</Text>
              <Text className="m-0 mt-1 text-base font-bold text-gray-900">{startTimeFormatted}</Text>
              {meetingUrl ? (
                <Text className="m-0 mt-3 text-sm">
                  🔗 Link Google Meet: <strong>{meetingUrl}</strong>
                </Text>
              ) : null}
              {extraMessage ? <Text className="m-0 mt-3 text-sm">{extraMessage}</Text> : null}
            </Section>

            <Button
              href={dashboardUrl}
              className="box-border rounded-lg bg-purple-600 px-6 py-3 text-center text-sm font-semibold text-white"
            >
              {copy.buttonLabel}
            </Button>

            <Hr className="my-6 border-gray-200" />
            <Text className="text-xs text-gray-400">
              Đây là email tự động từ GiveGot — nền tảng trao đổi kỹ năng dành cho học sinh, sinh viên. 💜
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
