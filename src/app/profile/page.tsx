'use client'

import { useUser } from '@/contexts/UserContext'
import { useEffect, useState } from 'react'
import {
  getAllAvailableSkills,
  getUserLearningGoals,
  getUserTeachingSkills,
  updateUserProfile,
} from '@/actions/user'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

interface Skill {
  id: string
  name: string
  slug: string
}

export default function ProfilePage() {
  const { currentUser, refreshUser, isLoading: userLoading } = useUser()
  const router = useRouter()

  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([])
  const [selectedTeachingSkills, setSelectedTeachingSkills] = useState<string[]>([])
  const [selectedLearningGoals, setSelectedLearningGoals] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccessToast, setShowSuccessToast] = useState(false)

  useEffect(() => {
    async function loadProfileData() {
      if (!currentUser) return

      setIsLoading(true)

      setName(currentUser.name || '')
      setBio(currentUser.bio || '')
      setAvatarUrl(currentUser.avatarUrl || '')

      const skills = await getAllAvailableSkills()
      setAvailableSkills(skills)

      const teachingSkills = await getUserTeachingSkills(currentUser.id)
      setSelectedTeachingSkills(teachingSkills)

      const learningGoals = await getUserLearningGoals(currentUser.id)
      setSelectedLearningGoals(learningGoals)

      setIsLoading(false)
    }

    loadProfileData()
  }, [currentUser?.id])

  const toggleTeachingSkill = (skillName: string) => {
    setSelectedTeachingSkills((prev) =>
      prev.includes(skillName)
        ? prev.filter((s) => s !== skillName)
        : [...prev, skillName]
    )
  }

  const toggleLearningGoal = (skillName: string) => {
    setSelectedLearningGoals((prev) =>
      prev.includes(skillName)
        ? prev.filter((s) => s !== skillName)
        : [...prev, skillName]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentUser) return

    setIsSaving(true)

    const result = await updateUserProfile(currentUser.id, {
      name: name.trim(),
      bio: bio.trim(),
      avatarUrl: avatarUrl.trim() || currentUser.avatarUrl || undefined,
      teachingSkills: selectedTeachingSkills,
      learningGoals: selectedLearningGoals,
    })

    if (result.success) {
      await refreshUser()
      setShowSuccessToast(true)
      setTimeout(() => setShowSuccessToast(false), 4000)
    } else {
      alert(`❌ ${result.message}`)
    }

    setIsSaving(false)
  }

  const generateRandomAvatar = () => {
    const seed = Math.random().toString(36).substring(7)
    setAvatarUrl(`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`)
  }

  if (userLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-xl font-bold text-red-600">Authentication Required</h2>
          <p className="text-gray-600 mt-2">Please select a user from the switcher above.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => router.push('/')}
            className="text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-8 py-6">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-xl">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Edit Your Profile</h1>
                <p className="text-purple-100">
                  Update your skills to get better mentor matches
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">👤</span>
                Basic Information
              </h2>

              <div className="space-y-6">
                <div>
                  <label htmlFor="avatar" className="block text-sm font-medium text-gray-700 mb-2">
                    Profile Avatar
                  </label>
                  <div className="flex items-center gap-4">
                    {avatarUrl && (
                      <Image
                        src={avatarUrl}
                        alt="Avatar preview"
                        width={80}
                        height={80}
                        className="rounded-full ring-4 ring-purple-200"
                      />
                    )}
                    <div className="flex-1">
                      <input
                        type="text"
                        id="avatar"
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        placeholder="https://example.com/avatar.jpg"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={generateRandomAvatar}
                        className="mt-2 text-sm text-purple-600 hover:text-purple-700 font-medium"
                      >
                        🎲 Generate Random Avatar
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-2">
                    Bio / About Me
                  </label>
                  <textarea
                    id="bio"
                    rows={4}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell others about yourself, your experience, and what you're passionate about..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent resize-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    This helps mentors/mentees understand your background
                  </p>
                </div>
              </div>
            </section>

            <div className="border-t border-gray-200"></div>

            <section>
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <span className="text-2xl">🎓</span>
                  What I Can Teach (Give)
                </h2>
                <p className="text-sm text-gray-600">
                  Select the skills you can teach to others. These will appear when others search for mentors.
                </p>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-200">
                <div className="flex flex-wrap gap-3">
                  {availableSkills.map((skill) => {
                    const isSelected = selectedTeachingSkills.includes(skill.name)
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => toggleTeachingSkill(skill.name)}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                          isSelected
                            ? 'bg-green-600 text-white shadow-md ring-2 ring-green-400 scale-105'
                            : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-green-400 hover:bg-green-50'
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="inline w-4 h-4 mr-1"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                        {skill.name}
                      </button>
                    )
                  })}
                </div>
                {selectedTeachingSkills.length === 0 && (
                  <p className="text-sm text-green-700 mt-4 text-center">
                    No teaching skills selected. Select skills above to become a mentor!
                  </p>
                )}
                {selectedTeachingSkills.length > 0 && (
                  <div className="mt-4 text-center">
                    <span className="text-sm font-semibold text-green-800">
                      {selectedTeachingSkills.length} skill
                      {selectedTeachingSkills.length !== 1 ? 's' : ''} selected
                    </span>
                  </div>
                )}
              </div>
            </section>

            <div className="border-t border-gray-200"></div>

            <section>
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <span className="text-2xl">📚</span>
                  What I Want to Learn (Get)
                </h2>
                <p className="text-sm text-gray-600">
                  Select your learning goals. Our auto-match system will prioritize mentors teaching these skills.
                </p>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 border-2 border-blue-200">
                <div className="flex flex-wrap gap-3">
                  {availableSkills.map((skill) => {
                    const isSelected = selectedLearningGoals.includes(skill.name)
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => toggleLearningGoal(skill.name)}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400 scale-105'
                            : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="inline w-4 h-4 mr-1"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                        {skill.name}
                      </button>
                    )
                  })}
                </div>
                {selectedLearningGoals.length === 0 && (
                  <p className="text-sm text-blue-700 mt-4 text-center">
                    No learning goals selected. Select skills above to get personalized mentor recommendations!
                  </p>
                )}
                {selectedLearningGoals.length > 0 && (
                  <div className="mt-4 text-center">
                    <span className="text-sm font-semibold text-blue-800">
                      {selectedLearningGoals.length} goal
                      {selectedLearningGoals.length !== 1 ? 's' : ''} selected
                    </span>
                  </div>
                )}
              </div>
            </section>

            <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-lg p-4 border border-purple-200">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-purple-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-purple-900 mb-1">
                    💡 Auto-Match System
                  </h4>
                  <p className="text-sm text-purple-800">
                    Your learning goals power our smart recommendation engine. When you select skills you want to learn,
                    we'll automatically show you the best-matched mentors on the Discovery page!
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => router.push('/')}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed shadow-md"
              >
                {isSaving ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </span>
                ) : (
                  'Save Profile'
                )}
              </button>
            </div>
          </form>
        </div>
      </main>

      {showSuccessToast && (
        <div className="fixed bottom-8 right-8 bg-green-600 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 animate-slide-in">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="font-semibold">Profile Updated!</p>
            <p className="text-sm text-green-100">
              Your mentor matches have been refreshed
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
