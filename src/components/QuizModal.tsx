'use client'

import { useState, useEffect, useRef } from 'react'
import { QuizQuestion } from '@/lib/gemini'
import { verifyUserSkill } from '@/actions/quiz'

interface QuizModalProps {
  isOpen: boolean
  onClose: () => void
  skillName: string
  userSkillId: string
  questions: QuizQuestion[]
  onVerified: () => void
}

export default function QuizModal({
  isOpen,
  onClose,
  skillName,
  userSkillId,
  questions,
  onVerified,
}: QuizModalProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([])
  const [timeLeft, setTimeLeft] = useState(15)
  const [quizActive, setQuizActive] = useState(true)
  const [quizCompleted, setQuizCompleted] = useState(false)
  const [score, setScore] = useState(0)
  const [passed, setPassed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [tabSwitchDetected, setTabSwitchDetected] = useState(false)
  
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Anti-Cheat: Tab switching detection
  useEffect(() => {
    if (!isOpen || !quizActive || quizCompleted) return

    const handleVisibilityChange = () => {
      if (document.hidden && quizActive && !quizCompleted) {
        console.warn('🚨 Tab switch detected! Quiz failed.')
        setTabSwitchDetected(true)
        setQuizActive(false)
        setQuizCompleted(true)
        setPassed(false)
        if (timerRef.current) {
          clearInterval(timerRef.current)
        }
      }
    }

    const handleBlur = () => {
      if (quizActive && !quizCompleted) {
        console.warn('🚨 Window blur detected! Quiz failed.')
        setTabSwitchDetected(true)
        setQuizActive(false)
        setQuizCompleted(true)
        setPassed(false)
        if (timerRef.current) {
          clearInterval(timerRef.current)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
    }
  }, [isOpen, quizActive, quizCompleted])

  // Timer countdown
  useEffect(() => {
    if (!isOpen || !quizActive || quizCompleted) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      return
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Time's up! Auto-submit current question as wrong
          console.warn(`⏰ Time's up for question ${currentQuestionIndex + 1}`)
          handleNextQuestion()
          return 15
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [isOpen, quizActive, quizCompleted, currentQuestionIndex])

  // Reset timer when question changes
  useEffect(() => {
    setTimeLeft(15)
  }, [currentQuestionIndex])

  const handleAnswerSelect = (answerIndex: number) => {
    if (!quizActive || quizCompleted) return
    
    const newAnswers = [...selectedAnswers]
    newAnswers[currentQuestionIndex] = answerIndex
    setSelectedAnswers(newAnswers)
  }

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    } else {
      // Quiz completed
      finishQuiz()
    }
  }

  const finishQuiz = async () => {
    setQuizActive(false)
    setQuizCompleted(true)
    
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    // Calculate score
    let correctCount = 0
    questions.forEach((question, index) => {
      if (selectedAnswers[index] === question.correctAnswer) {
        correctCount++
      }
    })

    setScore(correctCount)
    
    const hasPassed = correctCount >= 4
    setPassed(hasPassed)

    // If passed, verify the skill
    if (hasPassed) {
      setIsSubmitting(true)
      const result = await verifyUserSkill(userSkillId)
      setIsSubmitting(false)
      
      if (result.success) {
        console.log('🎉 Skill verified!')
        onVerified()
      }
    }
  }

  const handleClose = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    // Reset state
    setCurrentQuestionIndex(0)
    setSelectedAnswers([])
    setTimeLeft(15)
    setQuizActive(true)
    setQuizCompleted(false)
    setScore(0)
    setPassed(false)
    setTabSwitchDetected(false)
    onClose()
  }

  if (!isOpen) return null

  const currentQuestion = questions[currentQuestionIndex]

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-5 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">
                Bài kiểm tra kỹ năng
              </h2>
              <p className="text-purple-100 text-sm mt-1">
                {skillName}
              </p>
            </div>
            {!quizCompleted && quizActive && (
              <div className="text-center">
                <div className={`text-4xl font-bold ${timeLeft <= 5 ? 'text-red-300 animate-pulse' : 'text-white'}`}>
                  {timeLeft}s
                </div>
                <div className="text-xs text-purple-100">Thời gian còn lại</div>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {tabSwitchDetected ? (
            // Tab Switch Failure Screen
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-red-600 mb-2">
                Bài kiểm tra bị hủy!
              </h3>
              <p className="text-gray-600 mb-6">
                Hệ thống phát hiện bạn đã chuyển tab hoặc cửa sổ trong lúc làm bài.
                Đây là hành vi gian lận và bài kiểm tra đã bị hủy tự động.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-red-800 font-medium">
                  ⚠️ Cảnh báo: Không được chuyển tab hoặc thoát khỏi cửa sổ trong khi làm bài kiểm tra!
                </p>
              </div>
              <button
                onClick={handleClose}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition"
              >
                Đóng
              </button>
            </div>
          ) : quizCompleted ? (
            // Results Screen
            <div className="text-center py-8">
              {passed ? (
                <>
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                    <svg className="w-10 h-10 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-green-600 mb-2">
                    🎉 Xin chúc mừng!
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Bạn đã vượt qua bài kiểm tra kỹ năng <span className="font-bold">{skillName}</span>
                  </p>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                    <div className="text-5xl font-bold text-green-600 mb-2">
                      {score}/5
                    </div>
                    <div className="text-sm text-gray-600">
                      Điểm số của bạn
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg p-4 mb-6">
                    <p className="text-sm text-green-800 font-medium">
                      ✓ Kỹ năng của bạn đã được xác thực bằng AI
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      Huy hiệu "Verified" sẽ hiển thị trên hồ sơ của bạn
                    </p>
                  </div>
                  {isSubmitting && (
                    <div className="mb-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                      <p className="text-sm text-gray-600 mt-2">Đang cập nhật hồ sơ...</p>
                    </div>
                  )}
                  <button
                    onClick={handleClose}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition shadow-lg"
                  >
                    Hoàn tất
                  </button>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-red-600 mb-2">
                    Chưa đạt yêu cầu
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Bạn cần ít nhất 4/5 câu đúng để vượt qua bài kiểm tra
                  </p>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
                    <div className="text-5xl font-bold text-red-600 mb-2">
                      {score}/5
                    </div>
                    <div className="text-sm text-gray-600">
                      Điểm số của bạn
                    </div>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-yellow-800">
                      💡 Hãy ôn tập thêm về <span className="font-bold">{skillName}</span> và thử lại sau!
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition"
                  >
                    Đóng
                  </button>
                </>
              )}
            </div>
          ) : (
            // Quiz Questions
            <>
              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">
                    Câu hỏi {currentQuestionIndex + 1}/{questions.length}
                  </span>
                  <span className="text-sm text-gray-500">
                    Cần 4/5 câu đúng để vượt qua
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Warning Banner */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
                <p className="text-sm text-red-800 font-medium flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Không được chuyển tab hoặc rời khỏi cửa sổ! Bài kiểm tra sẽ bị hủy ngay lập tức.
                </p>
              </div>

              {/* Question */}
              <div className="bg-gray-50 rounded-xl p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {currentQuestion.question}
                </h3>

                <div className="space-y-3">
                  {currentQuestion.options.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => handleAnswerSelect(index)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selectedAnswers[currentQuestionIndex] === index
                          ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-200'
                          : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          selectedAnswers[currentQuestionIndex] === index
                            ? 'border-purple-600 bg-purple-600'
                            : 'border-gray-300'
                        }`}>
                          {selectedAnswers[currentQuestionIndex] === index && (
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <span className="font-medium text-gray-800">{option}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleNextQuestion}
                  disabled={selectedAnswers[currentQuestionIndex] === undefined}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg"
                >
                  {currentQuestionIndex < questions.length - 1 ? 'Câu tiếp theo' : 'Hoàn tất'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
