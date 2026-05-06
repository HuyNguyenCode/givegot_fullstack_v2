import { google } from 'googleapis';
import * as readline from 'readline';
import 'dotenv/config'; // Tự động đọc file .env

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Lấy Redirect URI từ .env. Thường anh em dùng NextAuth hay để localhost:3000/api/auth/callback/google
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/google';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("🔥 LỖI: Không tìm thấy GOOGLE_CLIENT_ID hoặc GOOGLE_CLIENT_SECRET trong file .env");
  process.exit(1);
}

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// Quyền duy nhất chúng ta cần: Được phép can thiệp vào Lịch (để tạo Meet)
const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline', // Bắt buộc để lấy được Refresh Token
  prompt: 'consent',      // Ép Google phải hỏi lại quyền để nhả Token mới
  scope: SCOPES,
});

console.log('====================================================');
console.log('🚀 BƯỚC 1: Hãy copy link dưới đây và dán vào trình duyệt:');
console.log('====================================================\n');
console.log(authUrl);
console.log('\n====================================================');
console.log('🚀 BƯỚC 2: Đăng nhập bằng tài khoản Google mà bạn muốn dùng làm "Máy chủ" tạo Meet.');
console.log('🚀 BƯỚC 3: Chọn "Tiếp tục" / "Allow" để cấp quyền.');
console.log('🚀 BƯỚC 4: Trình duyệt sẽ chuyển hướng (có thể báo lỗi trang web không hoạt động, ĐỪNG QUAN TÂM).');
console.log('🚀 BƯỚC 5: Nhìn lên thanh địa chỉ (URL), copy ĐOẠN MÃ đằng sau chữ "?code="');
console.log('====================================================\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('👉 Dán đoạn mã code bạn vừa copy vào đây và bấm Enter: ', async (code) => {
  try {
    // Đổi cái mã vừa copy lấy Refresh Token
    const { tokens } = await oAuth2Client.getToken(decodeURIComponent(code));
    
    console.log('\n🎉 THÀNH CÔNG RỰC RỠ! Hãy copy dòng dưới đây và dán vào file .env của bạn:\n');
    console.log(`GOOGLE_REFRESH_TOKEN="${tokens.refresh_token}"\n`);
    
  } catch (error) {
    console.error('\n❌ Lỗi khi lấy token. Có thể mã code bị sai, thiếu, hoặc hết hạn:', error);
  }
  rl.close();
});