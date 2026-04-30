import WaitlistEntry from '@/models/WaitlistEntry';
import Notification from '@/models/Notification';

// In the simplified-priority model:
// - No holds / no reservedUntil timers
// - We promote earliest waitlist entries to `status: 'notified'` up to `remainingTickets`

export async function fillNotifiedWaitlistSlots({ event }) {
  if (!event) return { promoted: 0 };

  const remaining = event.remainingTickets ?? 0;
  if (remaining <= 0) return { promoted: 0 };

  const alreadyNotified = await WaitlistEntry.countDocuments({
    eventId: event._id,
    status: 'notified',
  });

  const slotsToFill = Math.max(0, remaining - alreadyNotified);
  if (slotsToFill === 0) return { promoted: 0 };

  const now = new Date();
  const notifications = [];
  let promoted = 0;

  // Promote in FIFO order; use findOneAndUpdate to avoid double-promotion under races
  for (let i = 0; i < slotsToFill; i += 1) {
    const entry = await WaitlistEntry.findOneAndUpdate(
      { eventId: event._id, status: 'waiting' },
      { $set: { status: 'notified', notifiedAt: now } },
      { sort: { createdAt: 1 }, new: true }
    ).lean();

    if (!entry) break;

    promoted += 1;
    notifications.push({
      userId: entry.userId,
      eventId: event._id,
      type: 'waitlist',
      message: `Tickets are available now for ${event.event}.`,
    });
  }

  if (notifications.length) {
    await Notification.insertMany(notifications, { ordered: false });
  }

  return { promoted };
}
