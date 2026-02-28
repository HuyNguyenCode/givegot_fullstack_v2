'use client'

import { useState } from 'react'
import { getOrGenerateRoadmap } from '@/actions/roadmap'
import { RoadmapStep } from '@/lib/gemini'
import Link from 'next/link'

interface LearningRoadmapCardProps {
  userSkillId: string
  skillName: string
  initialRoadmap?: RoadmapStep[] | null
}

export default function LearningRoadmapCard({
  userSkillId,
  skillName,
  initialRoadmap,
}: LearningRoadmapCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [roadmapData, setRoadmapData] = useState<RoadmapStep[] | null>(initialRoadmap || null)
  const [error, setError] = useState<string | null>(null)

  const handleToggle = async () => {
    // If already expanded, just collapse
    if (isExpanded) {
      setIsExpanded(false)
      return
    }

    // If we have roadmap data, just expand
    if (roadmapData) {
      setIsExpanded(true)
      return
    }

    // Otherwise, fetch/generate roadmap
    setIsLoading(true)
    setError(null)

    try {
      const result = await getOrGenerateRoadmap(userSkillId, skillName)

      if (result.success && result.roadmap) {
        setRoadmapData(result.roadmap)
        setIsExpanded(true)
      } else {
        setError(result.message || 'Failed to generate roadmap')
      }
    } catch (err) {
      console.error('Error fetching roadmap:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
      {/* Header - Always Visible */}
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2.5 rounded-lg">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Learning Path for {skillName}
              </h3>
              <p className="text-sm text-gray-600">
                {roadmapData ? 'AI-generated 4-step roadmap' : 'Generate your personalized learning roadmap'}
              </p>
            </div>
          </div>

          <button
            onClick={handleToggle}
            disabled={isLoading}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
              isLoading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : roadmapData
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg'
            }`}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span className="text-sm">Generating...</span>
              </>
            ) : roadmapData ? (
              <>
                <svg
                  className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
                <span className="text-sm">{isExpanded ? 'Hide' : 'View'} Roadmap</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-sm">Generate AI Roadmap</span>
              </>
            )}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">⚠️ {error}</p>
          </div>
        )}
      </div>

      {/* Expanded Content - Roadmap Steps */}
      {isExpanded && roadmapData && (
        <div className="px-5 pb-5 animate-fade-in">
          <div className="bg-white rounded-lg p-4 space-y-4">
            {/* Progress Indicator */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 w-0 animate-pulse"></div>
              </div>
              <span className="text-xs font-semibold text-gray-600">4 Steps</span>
            </div>

            {/* Roadmap Steps */}
            <div className="space-y-4">
              {roadmapData.map((step, index) => (
                <div
                  key={step.step}
                  className="relative group"
                  style={{
                    animation: `fadeInUp 0.4s ease-out ${index * 0.1}s backwards`,
                  }}
                >
                  {/* Connector Line (except for last step) */}
                  {index < roadmapData.length - 1 && (
                    <div className="absolute left-[19px] top-[45px] w-0.5 h-[calc(100%+1rem)] bg-gradient-to-b from-blue-300 to-indigo-300"></div>
                  )}

                  <div className="flex items-start gap-4 bg-gradient-to-r from-gray-50 to-white rounded-lg p-4 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all">
                    {/* Step Number Badge */}
                    <div className="flex-shrink-0 relative z-10">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                        <span className="text-white font-bold text-lg">{step.step}</span>
                      </div>
                    </div>

                    {/* Step Content */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-bold text-gray-900 mb-1.5 group-hover:text-blue-600 transition-colors">
                        {step.title}
                      </h4>
                      <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                        {step.description}
                      </p>

                      {/* Find Mentor Button */}
                      <Link
                        href={`/discover?search=${encodeURIComponent(step.searchKeyword)}`}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-medium transition-all text-sm group/btn"
                      >
                        <svg
                          className="w-4 h-4 group-hover/btn:scale-110 transition-transform"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                        <span>Find Mentor for "{step.searchKeyword}"</span>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Tip */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
              <p className="text-xs text-blue-800 flex items-start gap-2">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>
                  <strong>Pro tip:</strong> Follow these steps in order for the best learning experience. Click "Find Mentor" to discover experts for each stage!
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
