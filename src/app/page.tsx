'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, FormEvent } from 'react'
import { Search, Sparkles, Shield, Users, TrendingUp, Code, Palette, Globe, MessageSquare, Camera, Music, ArrowRight, CheckCircle, Clock, Award } from 'lucide-react'

export default function LandingPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    if (searchTerm.trim()) {
      router.push(`/discover?search=${encodeURIComponent(searchTerm.trim())}`)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* NAVIGATION */}
      <nav className="absolute top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">GiveGot</span>
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/discover" className="text-sm font-medium text-gray-700 hover:text-purple-600 transition">
                Khám phá
              </Link>
              <Link href="/dashboard" className="text-sm font-medium text-gray-700 hover:text-purple-600 transition">
                Bảng điều khiển
              </Link>
              <Link
                href="/auth/signin"
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-blue-700 transition shadow-md"
              >
                Đăng nhập
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-blue-50 pt-16">
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Content */}
            <div className="space-y-8">
              <div className="space-y-4">
                <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight leading-tight">
                  Trao đổi Kỹ năng,
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
                    Không cần Tiền.
                  </span>
                </h1>
                <p className="text-xl text-gray-600 leading-relaxed max-w-xl">
                  Tham gia cuộc cách mạng time-banking. Dạy điều bạn biết, học điều bạn cần. Mỗi giờ bạn cho đi sẽ đổi lại một giờ bạn nhận được.
                </p>
              </div>

              {/* Search Bar */}
              <form onSubmit={handleSearch} className="flex gap-3 max-w-2xl">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Hôm nay bạn muốn học gì?"
                    className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-gray-900 placeholder:text-gray-400"
                  />
                </div>
                <button 
                  type="submit"
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl"
                >
                  Tìm kiếm
                </button>
              </form>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/discover"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                  Khám phá Mentor
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-white text-purple-600 font-semibold rounded-xl border-2 border-purple-600 hover:bg-purple-50 transition-all"
                >
                  Bắt đầu Miễn phí
                </Link>
              </div>
            </div>

            {/* Right: Hero Visual */}
            <div className="relative">
              <div className="relative aspect-square max-w-lg mx-auto">
                {/* Glassmorphism Cards */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-full h-full">
                    {/* Center Circle */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full shadow-2xl flex items-center justify-center">
                      <Sparkles className="w-16 h-16 text-white" />
                    </div>

                    {/* Floating Cards */}
                    <div className="absolute top-12 left-8 bg-white/80 backdrop-blur-lg rounded-2xl p-4 shadow-xl border border-white/20 hover:-translate-y-2 transition-transform">
                      <Code className="w-8 h-8 text-purple-600 mb-2" />
                      <p className="text-sm font-semibold text-gray-900">Lập trình</p>
                    </div>

                    <div className="absolute top-8 right-12 bg-white/80 backdrop-blur-lg rounded-2xl p-4 shadow-xl border border-white/20 hover:-translate-y-2 transition-transform">
                      <Palette className="w-8 h-8 text-blue-600 mb-2" />
                      <p className="text-sm font-semibold text-gray-900">Thiết kế</p>
                    </div>

                    <div className="absolute bottom-16 left-16 bg-white/80 backdrop-blur-lg rounded-2xl p-4 shadow-xl border border-white/20 hover:-translate-y-2 transition-transform">
                      <Globe className="w-8 h-8 text-green-600 mb-2" />
                      <p className="text-sm font-semibold text-gray-900">Ngoại ngữ</p>
                    </div>

                    <div className="absolute bottom-12 right-8 bg-white/80 backdrop-blur-lg rounded-2xl p-4 shadow-xl border border-white/20 hover:-translate-y-2 transition-transform">
                      <MessageSquare className="w-8 h-8 text-pink-600 mb-2" />
                      <p className="text-sm font-semibold text-gray-900">Marketing</p>
                    </div>

                    <div className="absolute top-1/2 right-4 bg-white/80 backdrop-blur-lg rounded-2xl p-4 shadow-xl border border-white/20 hover:-translate-y-2 transition-transform">
                      <Camera className="w-8 h-8 text-orange-600 mb-2" />
                      <p className="text-sm font-semibold text-gray-900">Nhiếp ảnh</p>
                    </div>

                    <div className="absolute top-1/2 left-4 bg-white/80 backdrop-blur-lg rounded-2xl p-4 shadow-xl border border-white/20 hover:-translate-y-2 transition-transform">
                      <Music className="w-8 h-8 text-red-600 mb-2" />
                      <p className="text-sm font-semibold text-gray-900">Âm nhạc</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST & STATS BANNER */}
      <section className="bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <Sparkles className="w-10 h-10 text-purple-400" />
              <div>
                <p className="text-2xl font-bold text-white">Ghép đôi bằng AI</p>
                <p className="text-gray-400 mt-1">Tìm mentor phù hợp ngay lập tức</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-3">
              <Shield className="w-10 h-10 text-blue-400" />
              <div>
                <p className="text-2xl font-bold text-white">100% Miễn phí</p>
                <p className="text-gray-400 mt-1">Không cần thẻ tín dụng, không phí đăng ký</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-3">
              <Users className="w-10 h-10 text-green-400" />
              <div>
                <p className="text-2xl font-bold text-white">Mentor đã xác minh</p>
                <p className="text-gray-400 mt-1">Cộng đồng chuyên gia đáng tin cậy</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 tracking-tight mb-4">
              Cách Hoạt Động
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Ba bước đơn giản để bắt đầu hành trình học tập của bạn
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="group relative bg-gradient-to-br from-purple-50 to-white rounded-2xl p-8 border-2 border-purple-100 hover:border-purple-300 hover:-translate-y-2 transition-all duration-300 shadow-lg hover:shadow-2xl">
              <div className="absolute -top-6 left-8 w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                1
              </div>
              <div className="mt-6">
                <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Search className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  Chia sẻ Kỹ năng của Bạn
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Tạo hồ sơ và liệt kê những kỹ năng bạn có thể dạy. Từ lập trình đến nấu ăn, mọi kỹ năng đều có giá trị.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="group relative bg-gradient-to-br from-blue-50 to-white rounded-2xl p-8 border-2 border-blue-100 hover:border-blue-300 hover:-translate-y-2 transition-all duration-300 shadow-lg hover:shadow-2xl">
              <div className="absolute -top-6 left-8 w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                2
              </div>
              <div className="mt-6">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Clock className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  Đặt Lịch Học
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Tìm mentor và đặt lịch buổi học 1 giờ. Mỗi giờ bạn dạy sẽ giúp bạn kiếm điểm để học điều mới.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="group relative bg-gradient-to-br from-green-50 to-white rounded-2xl p-8 border-2 border-green-100 hover:border-green-300 hover:-translate-y-2 transition-all duration-300 shadow-lg hover:shadow-2xl">
              <div className="absolute -top-6 left-8 w-12 h-12 bg-gradient-to-br from-green-600 to-green-700 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                3
              </div>
              <div className="mt-6">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  Cùng Nhau Phát Triển
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Hoàn thành buổi học, kiếm điểm, và phát triển kỹ năng. Tham gia cộng đồng nơi ai cũng có thể dạy và học.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* POPULAR CATEGORIES */}
      <section className="py-24 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 tracking-tight mb-4">
              Danh mục Phổ biến
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Khám phá hàng ngàn kỹ năng trong nhiều danh mục đa dạng
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { name: 'Lập trình', icon: Code, color: 'purple', count: '2.4k mentor' },
              { name: 'Thiết kế', icon: Palette, color: 'blue', count: '1.8k mentor' },
              { name: 'Ngoại ngữ', icon: Globe, color: 'green', count: '3.2k mentor' },
              { name: 'Marketing', icon: MessageSquare, color: 'pink', count: '1.5k mentor' },
              { name: 'Nhiếp ảnh', icon: Camera, color: 'orange', count: '980 mentor' },
              { name: 'Âm nhạc', icon: Music, color: 'red', count: '1.2k mentor' },
              { name: 'Kinh doanh', icon: TrendingUp, color: 'indigo', count: '2.1k mentor' },
              { name: 'Viết lách', icon: MessageSquare, color: 'yellow', count: '1.6k mentor' },
            ].map((category) => {
              const Icon = category.icon
              const colorClasses = {
                purple: 'bg-purple-50 border-purple-200 hover:border-purple-400 text-purple-700',
                blue: 'bg-blue-50 border-blue-200 hover:border-blue-400 text-blue-700',
                green: 'bg-green-50 border-green-200 hover:border-green-400 text-green-700',
                pink: 'bg-pink-50 border-pink-200 hover:border-pink-400 text-pink-700',
                orange: 'bg-orange-50 border-orange-200 hover:border-orange-400 text-orange-700',
                red: 'bg-red-50 border-red-200 hover:border-red-400 text-red-700',
                indigo: 'bg-indigo-50 border-indigo-200 hover:border-indigo-400 text-indigo-700',
                yellow: 'bg-yellow-50 border-yellow-200 hover:border-yellow-400 text-yellow-700',
              }[category.color]

              return (
                <Link
                  key={category.name}
                  href="/discover"
                  className={`group ${colorClasses} rounded-xl p-6 border-2 hover:-translate-y-1 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-lg`}
                >
                  <Icon className="w-10 h-10 mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="font-bold text-lg mb-1">{category.name}</h3>
                  <p className="text-sm opacity-75">{category.count}</p>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* CALL TO ACTION */}
      <section className="py-24 bg-gradient-to-br from-purple-600 via-purple-700 to-blue-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.1))]" />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-white text-sm font-medium mb-6">
            <Award className="w-4 h-4" />
            Cùng 10.000+ người học tham gia hôm nay
          </div>
          
          <h2 className="text-4xl lg:text-5xl font-bold text-white tracking-tight mb-6">
            Sẵn sàng Bắt đầu Hành trình?
          </h2>
          <p className="text-xl text-purple-100 mb-10 max-w-2xl mx-auto">
            Tạo tài khoản miễn phí và mở khóa vô số cơ hội học tập. Không cần thẻ tín dụng.
          </p>

          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-purple-600 font-bold rounded-xl hover:bg-gray-100 transition-all shadow-2xl hover:shadow-3xl hover:-translate-y-1"
            >
              Bắt đầu Miễn phí
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/discover"
              className="inline-flex items-center gap-2 px-8 py-4 bg-purple-800/50 backdrop-blur-sm text-white font-bold rounded-xl border-2 border-white/30 hover:bg-purple-800/70 transition-all"
            >
              Xem Mentor
            </Link>
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-8 text-purple-100">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <span>Không cần thẻ tín dụng</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <span>100% miễn phí mãi mãi</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <span>Hủy bất cứ lúc nào</span>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-white font-bold text-xl mb-4">GiveGot</h3>
              <p className="text-sm leading-relaxed">
                Nền tảng time-banking nơi kỹ năng là tiền tệ và ai cũng có thể dạy và học.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Nền tảng</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/discover" className="hover:text-white transition">Khám phá</Link></li>
                <li><Link href="/dashboard" className="hover:text-white transition">Bảng điều khiển</Link></li>
                <li><Link href="/profile" className="hover:text-white transition">Hồ sơ</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Công ty</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition">Giới thiệu</a></li>
                <li><a href="#" className="hover:text-white transition">Blog</a></li>
                <li><a href="#" className="hover:text-white transition">Tuyển dụng</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Hỗ trợ</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition">Trung tâm hỗ trợ</a></li>
                <li><a href="#" className="hover:text-white transition">Điều khoản</a></li>
                <li><a href="#" className="hover:text-white transition">Quyền riêng tư</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; 2026 GiveGot. Đã đăng ký bản quyền. Được xây dựng bằng ❤️ cho cộng đồng học tập.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
