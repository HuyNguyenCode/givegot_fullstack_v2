import { SignOutButton } from '@/components/SignOutButton'
import { ShieldOff, Mail } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Account Suspended — GiveGot',
}

/**
 * This page is intentionally whitelisted in both:
 *  • middleware.ts  — listed in PUBLIC_PATHS so unauthenticated users can reach it
 *  • layout.tsx     — suspension check skipped for /suspended
 * Together these two exemptions ensure suspended users are never caught in an
 * infinite redirect loop.
 */
export default function SuspendedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-red-500 to-orange-500 px-8 py-10 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mb-4">
              <ShieldOff size={40} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Account Suspended</h1>
            <p className="text-red-100 mt-2 text-sm leading-relaxed">
              Your account has been temporarily restricted by an administrator.
            </p>
          </div>

          {/* Body */}
          <div className="px-8 py-8 space-y-6">
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <p className="text-sm text-orange-800 leading-relaxed">
                Access to GiveGot has been restricted. This may be due to a
                violation of our community guidelines or a pending review.
                If you believe this is a mistake, please contact support.
              </p>
            </div>

            {/* Contact */}
            <div className="flex items-start gap-3">
              <Mail size={18} className="text-purple-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-800">Contact Support</p>
                <p className="text-sm text-gray-600 mt-0.5">
                  Email us at{' '}
                  <a
                    href="mailto:support@givegot.app"
                    className="text-purple-600 hover:text-purple-800 font-medium underline underline-offset-2"
                  >
                    support@givegot.app
                  </a>{' '}
                  and include your registered email address.
                </p>
              </div>
            </div>

            <hr className="border-gray-100" />

            <SignOutButton />

            <p className="text-center text-xs text-gray-400">
              GiveGot · Time-Banking Mentorship Platform
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
