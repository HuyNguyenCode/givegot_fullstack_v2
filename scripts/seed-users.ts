import { PrismaClient, SkillType } from '@prisma/client'

const prisma = new PrismaClient()

// --- 1. THÙNG NGUYÊN LIỆU ĐỂ RÁP USER TỰ ĐỘNG ---
const firstNames = ["Huy", "Nam", "An", "Bình", "Châu", "Duy", "Hải", "Linh", "Mai", "Ngọc", "Tuấn", "Thảo", "Hùng", "Lan", "Phong"]
const lastNames = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ"]

const sampleSkills = [
  { name: "Lập trình React", slug: "lap-trinh-react", category: "IT" },
  { name: "Thiết kế UI/UX", slug: "thiet-ke-ui-ux", category: "Design" },
  { name: "Tiếng Anh Giao Tiếp", slug: "tieng-anh-giao-tiep", category: "Language" },
  { name: "IELTS 7.0", slug: "ielts-7-0", category: "Language" },
  { name: "Nấu Ăn Cơ Bản", slug: "nau-an-co-ban", category: "Lifestyle" },
  { name: "Yoga", slug: "yoga", category: "Health" },
  { name: "Đệm đàn Guitar", slug: "dem-dan-guitar", category: "Music" },
  { name: "Quản lý Tài chính", slug: "quan-ly-tai-chinh", category: "Business" },
  { name: "Chạy bộ Marathon", slug: "chay-bo", category: "Health" },
  { name: "Digital Marketing", slug: "digital-marketing", category: "Business" }
]

// Hàm tiện ích: Bốc ngẫu nhiên N phần tử trong một mảng
function getRandomItems(arr: any[], count: number) {
  const shuffled = [...arr].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

async function main() {
  console.log('🚀 Bắt đầu khởi động nhà máy sản xuất 100 Users...')

  // --- 2. BƯỚC ĐỆM: Đảm bảo các Kỹ năng (Skill) đã tồn tại trong DB ---
  // Phải có Skill trước thì User mới có cái mà đăng ký học/dạy
  for (const s of sampleSkills) {
    await prisma.skill.upsert({
      where: { slug: s.slug },
      update: {}, 
      create: { 
        name: s.name, 
        slug: s.slug, 
        category: s.category, 
        status: "APPROVED" // Cấp quyền tự động qua ải Admin luôn
      }
    })
  }
  console.log('✅ Đã nạp xong danh sách Kỹ năng gốc.')

  // --- 3. TIẾN HÀNH BƠM 100 USER ---
  let successCount = 0;

  for (let i = 1; i <= 100; i++) {
    // Quay xổ số Tên và Họ
    const fName = firstNames[Math.floor(Math.random() * firstNames.length)]
    const lName = lastNames[Math.floor(Math.random() * lastNames.length)]
    const fullName = `${lName} ${fName}`
    
    // Tạo email ảo dựa trên ID và tên (VD: user1_huy@givegot.local)
    const email = `user${i}_${fName.toLowerCase()}@givegot.local`
    
    // Lấy link avatar xịn sò, dùng email làm hạt giống để mỗi người 1 mặt khác nhau
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`

    // Bốc ngẫu nhiên 4 kỹ năng khác nhau cho user này
    const userSkills = getRandomItems(sampleSkills, 4)
    const giveSkills = userSkills.slice(0, 2) // 2 cái đầu làm GIVE
    const wantSkills = userSkills.slice(2, 4) // 2 cái sau làm WANT

    try {
      // Upsert: Có rồi thì thôi, chưa có thì tạo mới
      await prisma.user.upsert({
        where: { email: email },
        update: {}, // BẢO VỆ DỮ LIỆU CŨ: Không thay đổi gì nếu email đã tồn tại
        create: {
          email: email,
          name: fullName,
          avatarUrl: avatarUrl,
          bio: `Xin chào! Tôi là ${fName}, rất vui được tham gia nền tảng GiveGot để chia sẻ và học hỏi.`,
          role: "USER",
          // Xử lý bản lề UserSkill theo đúng Schema của bạn
          skills: {
            create: [
              ...giveSkills.map(skill => ({
                skill: { connect: { slug: skill.slug } },
                type: SkillType.GIVE // Map thẳng vào Enum SkillType
              })),
              ...wantSkills.map(skill => ({
                skill: { connect: { slug: skill.slug } },
                type: SkillType.WANT // Map thẳng vào Enum SkillType
              }))
            ]
          }
        }
      })
      successCount++;
      // Chỉ in log mỗi 10 user để đỡ rác màn hình terminal
      if (i % 10 === 0) console.log(`⏳ Đang bơm... (${i}/100)`)
      
    } catch (error) {
      console.error(`❌ Lỗi ở User ${email}:`, error)
    }
  }

  console.log(`🎉 HOÀN TẤT! Đã kiểm tra/bơm thành công ${successCount} Users. Dữ liệu cũ của bạn vẫn an toàn 100%.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })