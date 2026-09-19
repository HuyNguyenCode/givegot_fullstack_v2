import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const bookingPage = readFileSync('src/app/book/[mentorId]/page.tsx', 'utf8')
const mentorCalendar = readFileSync('src/components/MenteeBookingCalendar.tsx', 'utf8')

test('LearningSpace LIVE and HYBRID use AvailableSlot while EXERCISE_REVIEW and legacy booking retain manual scheduling', () => {
  assert.match(
    bookingPage,
    /learningSpaceId && \(learningMode === 'LIVE' \|\| learningMode === 'HYBRID'\)/,
  )
  assert.match(bookingPage, /const slots = await getAvailableSlots\(mentorId\)/)
  assert.match(bookingPage, /if \(usesAvailableSlot\) \{[\s\S]*?bookAvailableSlot\([\s\S]*?\} else \{[\s\S]*?createBooking\(/)

  const scheduleBranch = bookingPage.slice(bookingPage.indexOf('{usesAvailableSlot ? ('))
  const manualBranch = scheduleBranch.indexOf('type="date"')
  assert.ok(scheduleBranch.indexOf('name="available-slot"') >= 0)
  assert.ok(manualBranch > scheduleBranch.indexOf(') : ('), 'manual inputs must exist only in the non-slot branch')
  assert.match(scheduleBranch, /type="time"/)
})

test('LIVE and HYBRID submit slotId with complete LearningSpace selection', () => {
  assert.match(bookingPage, /bookAvailableSlot\(\s*selectedSlotId,/)
  for (const field of [
    'learningSpaceId: learningContext.id',
    'learningMode,',
    'topicId: topicId || null',
    'objective: objective.trim() || null',
    'definitionOfDone: learningContext.definitionOfDone',
  ]) {
    assert.ok(bookingPage.includes(field), `missing LearningSpace selection field: ${field}`)
  }
})

test('empty or stale LIVE/HYBRID availability never falls back to manual time entry', () => {
  assert.match(bookingPage, /availableSlots\.length === 0/)
  assert.match(bookingPage, /LIVE và HYBRID không thể đặt bằng ngày giờ tự nhập/)
  assert.match(bookingPage, /if \(!result\.success && usesAvailableSlot\) \{\s*await loadAvailableSlots\(\)/)
  assert.match(bookingPage, /usesAvailableSlot && !selectedSlotId/)
})

test('mentor-profile AvailableSlot booking remains on its unchanged legacy call', () => {
  assert.match(
    mentorCalendar,
    /bookAvailableSlot\(selectedSlot\.id, currentUserId, bookingNote\.trim\(\) \|\| undefined\)/,
  )
})
