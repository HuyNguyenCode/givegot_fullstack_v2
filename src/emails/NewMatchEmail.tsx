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

export interface NewMatchEmailProps {
  userName: string
  skillName: string
  discoverUrl: string
}

export default function NewMatchEmail({ userName, skillName, discoverUrl }: NewMatchEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Tin hot: đã có mentor dạy &quot;{skillName}&quot; cho bạn rồi nè! ✨</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto my-10 max-w-[480px] rounded-2xl bg-white p-8 shadow-sm">
            <Text className="m-0 text-2xl">✨</Text>
            <Heading className="mt-2 mb-4 text-xl font-bold text-gray-900">
              Chào {userName}, có match mới cho bạn nè!
            </Heading>
            <Text className="text-base leading-6 text-gray-700">
              AI của GiveGot vừa tìm thấy mentor phù hợp với kỹ năng bạn đang muốn học. Đừng chần chừ, book
              ngay trước khi hết slot ngon nha! 🚀
            </Text>

            <Section className="my-5 rounded-xl bg-blue-50 p-4">
              <Text className="m-0 text-sm font-semibold text-blue-700">📚 Kỹ năng bạn quan tâm</Text>
              <Text className="m-0 mt-1 text-base font-bold text-gray-900">{skillName}</Text>
            </Section>

            <Button
              href={discoverUrl}
              className="box-border rounded-lg bg-purple-600 px-6 py-3 text-center text-sm font-semibold text-white"
            >
              Khám phá Mentor ngay
            </Button>

            <Hr className="my-6 border-gray-200" />
            <Text className="text-xs text-gray-400">
              Bạn nhận được email này vì đã thêm &quot;{skillName}&quot; vào danh sách kỹ năng muốn học trên
              GiveGot. 💜
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
