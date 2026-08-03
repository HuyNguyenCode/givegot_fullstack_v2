import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// ==========================================
// 🛠️ TẠO CUSTOM ADAPTER ĐỂ ÉP GHI LOG
// ==========================================
const customAdapter = PrismaAdapter(prisma);
const originalCreateUser = customAdapter.createUser;

customAdapter.createUser = async (profile) => {
  // 1. Gọi hàm gốc để tạo User vào DB trước
  const user = await originalCreateUser!(profile);

  // 2. Ép hệ thống ghi log ngay lập tức, block tiến trình cho đến khi ghi xong
  try {
    await prisma.transactionLog.create({
      data: {
        userId: user.id,
        amount: 3,
        type: 'INITIAL_BONUS', // ⚠️ Lưu ý: Sửa lại chữ này cho khớp với Enum trong schema.prisma của bạn nhé
        status: 'SUCCESS',
      },
    });
    console.log(`✅ [GiveGot Ledger] Đã nạp 3 điểm khởi nghiệp cho: ${user.email}`);
  } catch (error) {
    console.error(`❌ [GiveGot Ledger] Lỗi ghi log điểm (Hãy check lại Schema):`, error);
  }

  return user;
};

// 1. Tạo mảng Providers cơ bản (Dành cho Production)
const providers = [
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    allowDangerousEmailAccountLinking: true, // Link Google account to existing User with same email
  }),
  CredentialsProvider({
    name: 'Credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null
      }

      const user = await prisma.user.findUnique({
        where: { email: credentials.email as string },
      })

      if (!user || !user.password) {
        return null
      }

      const isPasswordValid = await bcrypt.compare(
        credentials.password as string,
        user.password
      )

      if (!isPasswordValid) {
        return null
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.avatarUrl,
      }
    },
  }),
]

// 2. TẠO CỬA HẬU: Chỉ thêm Provider này khi KHÔNG ở môi trường Production
// process.env.NEXT_PUBLIC_SHOW_DEV_BAR === 'true'
if (process.env.NODE_ENV !== 'production') {
  providers.push(
    CredentialsProvider({
      id: 'impersonate', // Đặt ID riêng để phân biệt với login thường
      name: 'Impersonate Dev',
      credentials: {
        userId: { label: 'User ID', type: 'text' },
      },
      async authorize(credentials) {
        // Bản chất: Chặn lại một lần nữa cho chắc ăn, nhỡ config lỗi
        if (process.env.NODE_ENV === 'production') return null;
        if (!credentials?.userId) return null;

        // Vượt rào: Lấy thẳng user từ Database bằng ID, không check password
        const user = await prisma.user.findUnique({
          where: { id: credentials.userId as string },
        });

        if (!user) return null;

        // Cấp luôn thẻ ra vào (session token)
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
        };
      },
    })
  );
}


export const { handlers, signIn, signOut, auth } = NextAuth({
  // PrismaAdapter enables auto-registration: new Google users are saved to User + Account tables
  adapter: customAdapter,

  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
  },
  providers: providers,

  callbacks: {
    // Anti-Scam Auto-Suspension: block sign-in entirely for accounts that are
    // suspended or have fallen below the platform's Trust Score safety floor.
    // Fails OPEN (allows sign-in) on lookup errors or brand-new/unrecognized
    // users so a transient DB hiccup can never lock everyone out.
    async signIn({ user, account }) {
      // The dev-only "impersonate" provider exists specifically so developers
      // can test flows (including suspended-user flows) — never block it here.
      if (account?.provider === 'impersonate') {
        return true
      }

      if (!user?.email) {
        return true
      }

      try {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { isSuspended: true, trustScore: true },
        })

        if (dbUser && (dbUser.isSuspended || dbUser.trustScore < 30)) {
          // return false
          return '/suspended'; // Hoặc '/auth/signin?error=suspended' tùy bạn setup router
        }
      } catch (error) {
        console.error('[Auth] signIn suspension check failed (failing open):', error)
      }

      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
})
