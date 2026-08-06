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

export type BookingCancellationKind = 'CANCELLED' | 'DECLINED'

export interface BookingCancelledEmailProps {
  recipientName: string
  cancellerName: string
  kind: BookingCancellationKind
  startTimeFormatted: string
  detailMessage?: string | null
  actionUrl: string
}

export default function BookingCancelledEmail({
  recipientName,
  cancellerName,
  kind,
  startTimeFormatted,
  detailMessage,
  actionUrl,
}: BookingCancelledEmailProps) {
  const isDeclined = kind === 'DECLINED'
  const title = isDeclined ? 'Yêu cầu đặt lịch chưa được nhận' : 'Buổi học vừa được hủy'
  const intro = isDeclined
    ? `${cancellerName} hiện chưa thể nhận buổi học này.`
    : `${cancellerName} vừa hủy buổi học đã lên lịch với bạn.`

  return (
    <Html lang="vi">
      <Head />
      <Preview>{title} — xem cập nhật mới nhất từ GiveGot</Preview>
      <Tailwind>
        <Body className="m-0 bg-slate-100 px-4 py-8 font-sans">
          <Container className="mx-auto max-w-[520px] rounded-2xl bg-white p-8 shadow-sm">
            <Text className="m-0 text-3xl">{isDeclined ? '🌱' : '📅'}</Text>
            <Heading className="mb-3 mt-3 text-2xl font-bold text-slate-900">
              {recipientName} ơi, {title.toLowerCase()}
            </Heading>
            <Text className="text-base leading-7 text-slate-600">
              {intro} Hơi tiếc một xíu, nhưng không sao — vẫn còn nhiều kèo học hay đang chờ bạn
              trên GiveGot nha.
            </Text>

            <Section className="my-6 rounded-xl bg-amber-50 p-5">
              <Text className="m-0 text-xs font-bold uppercase tracking-wide text-amber-700">
                Buổi học được cập nhật
              </Text>
              <Text className="mb-0 mt-2 text-base font-bold text-slate-900">
                🕐 {startTimeFormatted}
              </Text>
              {detailMessage ? (
                <Text className="mb-0 mt-4 text-sm leading-6 text-amber-900">{detailMessage}</Text>
              ) : null}
            </Section>

            <Button
              href={actionUrl}
              className="box-border rounded-lg bg-violet-600 px-6 py-3 text-center text-sm font-bold text-white"
            >
              {isDeclined ? 'Tìm mentor khác' : 'Xem lịch sử đặt lịch'}
            </Button>

            <Hr className="my-6 border-slate-200" />
            <Text className="m-0 text-xs leading-5 text-slate-400">
              Email tự động từ GiveGot. Mọi cập nhật GivePoint và Trust Score đều có trong tài khoản của
              bạn 💜
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
