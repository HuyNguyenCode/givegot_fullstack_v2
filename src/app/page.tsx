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
                Discover
              </Link>
              <Link href="/dashboard" className="text-sm font-medium text-gray-700 hover:text-purple-600 transition">
                Dashboard
              </Link>
              <Link
                href="/auth/signin"
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-blue-700 transition shadow-md"
              >
                Sign In
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
                  Exchange Skills,
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
                    Not Money.
                  </span>
                </h1>
                <p className="text-xl text-gray-600 leading-relaxed max-w-xl">
                  Join the time-banking revolution. Teach what you know, learn what you need. Every hour you give earns you an hour to receive.
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
                    placeholder="What do you want to learn today?"
                    className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-gray-900 placeholder:text-gray-400"
                  />
                </div>
                <button 
                  type="submit"
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl"
                >
                  Search
                </button>
              </form>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/discover"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                  Discover Mentors
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-white text-purple-600 font-semibold rounded-xl border-2 border-purple-600 hover:bg-purple-50 transition-all"
                >
                  Get Started Free
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
                      <p className="text-sm font-semibold text-gray-900">Programming</p>
                    </div>

                    <div className="absolute top-8 right-12 bg-white/80 backdrop-blur-lg rounded-2xl p-4 shadow-xl border border-white/20 hover:-translate-y-2 transition-transform">
                      <Palette className="w-8 h-8 text-blue-600 mb-2" />
                      <p className="text-sm font-semibold text-gray-900">Design</p>
                    </div>

                    <div className="absolute bottom-16 left-16 bg-white/80 backdrop-blur-lg rounded-2xl p-4 shadow-xl border border-white/20 hover:-translate-y-2 transition-transform">
                      <Globe className="w-8 h-8 text-green-600 mb-2" />
                      <p className="text-sm font-semibold text-gray-900">Languages</p>
                    </div>

                    <div className="absolute bottom-12 right-8 bg-white/80 backdrop-blur-lg rounded-2xl p-4 shadow-xl border border-white/20 hover:-translate-y-2 transition-transform">
                      <MessageSquare className="w-8 h-8 text-pink-600 mb-2" />
                      <p className="text-sm font-semibold text-gray-900">Marketing</p>
                    </div>

                    <div className="absolute top-1/2 right-4 bg-white/80 backdrop-blur-lg rounded-2xl p-4 shadow-xl border border-white/20 hover:-translate-y-2 transition-transform">
                      <Camera className="w-8 h-8 text-orange-600 mb-2" />
                      <p className="text-sm font-semibold text-gray-900">Photography</p>
                    </div>

                    <div className="absolute top-1/2 left-4 bg-white/80 backdrop-blur-lg rounded-2xl p-4 shadow-xl border border-white/20 hover:-translate-y-2 transition-transform">
                      <Music className="w-8 h-8 text-red-600 mb-2" />
                      <p className="text-sm font-semibold text-gray-900">Music</p>
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
                <p className="text-2xl font-bold text-white">AI-Powered Matching</p>
                <p className="text-gray-400 mt-1">Find your perfect mentor instantly</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-3">
              <Shield className="w-10 h-10 text-blue-400" />
              <div>
                <p className="text-2xl font-bold text-white">100% Free</p>
                <p className="text-gray-400 mt-1">No credit cards, no subscriptions</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-3">
              <Users className="w-10 h-10 text-green-400" />
              <div>
                <p className="text-2xl font-bold text-white">Verified Mentors</p>
                <p className="text-gray-400 mt-1">Trusted community of experts</p>
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
              How It Works
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Three simple steps to start your learning journey
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
                  Offer Your Skills
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Create your profile and list the skills you can teach. From coding to cooking, every skill has value.
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
                  Book Sessions
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Browse mentors and book 1-hour sessions. Each hour you teach earns you points to learn something new.
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
                  Grow Together
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Complete sessions, earn points, and build your skills. Join a community where everyone teaches and learns.
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
              Popular Categories
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Explore thousands of skills across diverse categories
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { name: 'Programming', icon: Code, color: 'purple', count: '2.4k mentors' },
              { name: 'Design', icon: Palette, color: 'blue', count: '1.8k mentors' },
              { name: 'Languages', icon: Globe, color: 'green', count: '3.2k mentors' },
              { name: 'Marketing', icon: MessageSquare, color: 'pink', count: '1.5k mentors' },
              { name: 'Photography', icon: Camera, color: 'orange', count: '980 mentors' },
              { name: 'Music', icon: Music, color: 'red', count: '1.2k mentors' },
              { name: 'Business', icon: TrendingUp, color: 'indigo', count: '2.1k mentors' },
              { name: 'Writing', icon: MessageSquare, color: 'yellow', count: '1.6k mentors' },
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
            Join 10,000+ learners today
          </div>
          
          <h2 className="text-4xl lg:text-5xl font-bold text-white tracking-tight mb-6">
            Ready to Start Your Journey?
          </h2>
          <p className="text-xl text-purple-100 mb-10 max-w-2xl mx-auto">
            Create your free account and unlock unlimited learning opportunities. No credit card required.
          </p>

          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-purple-600 font-bold rounded-xl hover:bg-gray-100 transition-all shadow-2xl hover:shadow-3xl hover:-translate-y-1"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/discover"
              className="inline-flex items-center gap-2 px-8 py-4 bg-purple-800/50 backdrop-blur-sm text-white font-bold rounded-xl border-2 border-white/30 hover:bg-purple-800/70 transition-all"
            >
              Browse Mentors
            </Link>
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-8 text-purple-100">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <span>No credit card</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <span>100% free forever</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <span>Cancel anytime</span>
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
                The time-banking platform where skills are currency and everyone can teach and learn.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Platform</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/discover" className="hover:text-white transition">Discover</Link></li>
                <li><Link href="/dashboard" className="hover:text-white transition">Dashboard</Link></li>
                <li><Link href="/profile" className="hover:text-white transition">Profile</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition">About</a></li>
                <li><a href="#" className="hover:text-white transition">Blog</a></li>
                <li><a href="#" className="hover:text-white transition">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition">Terms</a></li>
                <li><a href="#" className="hover:text-white transition">Privacy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; 2026 GiveGot. All rights reserved. Built with ❤️ for the learning community.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
