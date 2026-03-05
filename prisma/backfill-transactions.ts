import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function backfillTransactions() {
  console.log('🔄 Starting transaction backfill...\n')

  try {
    // Get all users
    const users = await prisma.user.findMany()
    console.log(`📊 Found ${users.length} users\n`)

    for (const user of users) {
      console.log(`Processing user: ${user.name || user.email}`)

      // Check if user already has an INITIAL_BONUS transaction
      const existingBonus = await prisma.transactionLog.findFirst({
        where: {
          userId: user.id,
          type: 'INITIAL_BONUS',
        },
      })

      if (!existingBonus && user.givePoints >= 3) {
        // Create INITIAL_BONUS transaction (assuming they started with 3 points)
        await prisma.transactionLog.create({
          data: {
            userId: user.id,
            amount: 3,
            type: 'INITIAL_BONUS',
            bookingId: null,
          },
        })
        console.log(`  ✅ Created INITIAL_BONUS transaction (+3 points)`)
      }

      // Get all bookings for this user
      const bookings = await prisma.booking.findMany({
        where: {
          OR: [
            { mentorId: user.id },
            { menteeId: user.id },
          ],
        },
        orderBy: { createdAt: 'asc' },
      })

      console.log(`  📅 Found ${bookings.length} bookings`)

      for (const booking of bookings) {
        const isMentor = booking.mentorId === user.id

        if (!isMentor) {
          // Mentee: Check for BOOKING_CREATED transaction
          const existingCreated = await prisma.transactionLog.findFirst({
            where: {
              userId: user.id,
              bookingId: booking.id,
              type: 'BOOKING_CREATED',
            },
          })

          if (!existingCreated) {
            await prisma.transactionLog.create({
              data: {
                userId: user.id,
                amount: -1,
                type: 'BOOKING_CREATED',
                bookingId: booking.id,
              },
            })
            console.log(`  ✅ Created BOOKING_CREATED transaction (-1 point) for booking ${booking.id.slice(0, 8)}`)
          }

          // Check for refund if cancelled
          if (booking.status === 'CANCELLED') {
            const existingRefund = await prisma.transactionLog.findFirst({
              where: {
                userId: user.id,
                bookingId: booking.id,
                type: 'BOOKING_CANCELLED',
              },
            })

            if (!existingRefund) {
              await prisma.transactionLog.create({
                data: {
                  userId: user.id,
                  amount: 1,
                  type: 'BOOKING_CANCELLED',
                  bookingId: booking.id,
                },
              })
              console.log(`  ✅ Created BOOKING_CANCELLED transaction (+1 point refund) for booking ${booking.id.slice(0, 8)}`)
            }
          }
        } else {
          // Mentor: Check for BOOKING_COMPLETED transaction
          if (booking.status === 'COMPLETED') {
            const existingCompleted = await prisma.transactionLog.findFirst({
              where: {
                userId: user.id,
                bookingId: booking.id,
                type: 'BOOKING_COMPLETED',
              },
            })

            if (!existingCompleted) {
              await prisma.transactionLog.create({
                data: {
                  userId: user.id,
                  amount: 1,
                  type: 'BOOKING_COMPLETED',
                  bookingId: booking.id,
                },
              })
              console.log(`  ✅ Created BOOKING_COMPLETED transaction (+1 point earned) for booking ${booking.id.slice(0, 8)}`)
            }
          }
        }
      }

      console.log(`  ✅ Completed user: ${user.name || user.email}\n`)
    }

    console.log('✅ Transaction backfill complete!')
  } catch (error) {
    console.error('❌ Error during backfill:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

backfillTransactions()
  .then(() => {
    console.log('\n🎉 All done! Transaction history is now complete.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Backfill failed:', error)
    process.exit(1)
  })
