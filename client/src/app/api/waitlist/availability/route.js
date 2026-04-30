import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Event from '@/models/Event';
import WaitlistEntry from '@/models/WaitlistEntry';
import { fillNotifiedWaitlistSlots } from '@/lib/waitlist';

export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const event_id = searchParams.get('event_id');
    const firebase_uid = searchParams.get('firebase_uid');

    if (!event_id) {
      return NextResponse.json(
        { success: false, message: 'event_id is required' },
        { status: 400 }
      );
    }

    const event = await Event.findOne({ eventId: event_id, deleted: { $ne: true } });
    if (!event) {
      return NextResponse.json(
        { success: false, message: 'Event not found' },
        { status: 404 }
      );
    }

    const remaining = event.remainingTickets ?? 0;
    const soldOut = remaining <= 0;

    // If anyone joined the waitlist for this event, purchases are priority-based.
    const hasWaitlist = await WaitlistEntry.exists({ eventId: event._id });

    if (soldOut) {
      return NextResponse.json({ success: true, canBuy: false, message: 'Tickets sold out' });
    }

    // No waitlist => normal buying for everyone
    if (!hasWaitlist) {
      return NextResponse.json({ success: true, canBuy: true, message: null });
    }

    // Waitlist exists + tickets exist => ensure the earliest users are promoted to `notified`
    await fillNotifiedWaitlistSlots({ event });

    // Waitlist exists => only waitlisted users can buy, everyone else sees sold out.
    if (!firebase_uid) {
      return NextResponse.json({ success: true, canBuy: false, message: 'Tickets sold out' });
    }

    const entry = await WaitlistEntry.findOne({ eventId: event._id, userId: firebase_uid })
      .select('status')
      .lean();

    const canBuy = entry?.status === 'notified';
    return NextResponse.json({ success: true, canBuy, message: canBuy ? null : 'Tickets sold out' });
  } catch (error) {
    console.error('[waitlist availability GET]', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
