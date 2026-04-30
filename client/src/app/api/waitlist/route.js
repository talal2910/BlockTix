import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Event from '@/models/Event';
import WaitlistEntry from '@/models/WaitlistEntry';

export async function POST(req) {
  try {
    await dbConnect();

    const { firebase_uid, event_id } = await req.json();

    if (!firebase_uid || !event_id) {
      return NextResponse.json(
        { success: false, message: 'firebase_uid and event_id are required' },
        { status: 400 }
      );
    }

    const event = await Event.findOne({
      eventId: event_id,
      deleted: { $ne: true },
    }).lean();

    if (!event) {
      return NextResponse.json(
        { success: false, message: 'Event not found' },
        { status: 404 }
      );
    }

    const remaining = event.remainingTickets ?? 0;
    const waitlistMode = await WaitlistEntry.exists({ eventId: event._id });

    // Allow joining when sold out, or when "priority mode" is active (waitlist exists)
    if (remaining > 0 && !waitlistMode) {
      return NextResponse.json(
        { success: false, message: 'Tickets are available', joinable: false },
        { status: 409 }
      );
    }

    const existing = await WaitlistEntry.findOne({
      eventId: event._id,
      userId: firebase_uid,
    });

    if (existing) {
      // If user already active on the waitlist, joining is idempotent
      if (existing.status === 'waiting' || existing.status === 'notified') {
        return NextResponse.json({ success: true, joined: true });
      }

      // If they previously purchased/removed/expired, re-join at the end (new createdAt)
      await WaitlistEntry.deleteOne({ _id: existing._id });
    }

    await WaitlistEntry.create({ eventId: event._id, userId: firebase_uid, status: 'waiting' });
    return NextResponse.json({ success: true, joined: true });
  } catch (error) {
    console.error('[waitlist POST]', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const firebase_uid = searchParams.get('firebase_uid');
    const event_id = searchParams.get('event_id');

    if (!firebase_uid || !event_id) {
      return NextResponse.json(
        { success: false, message: 'firebase_uid and event_id are required' },
        { status: 400 }
      );
    }

    const event = await Event.findOne({
      eventId: event_id,
      deleted: { $ne: true },
    }).lean();

    if (!event) {
      return NextResponse.json(
        { success: false, message: 'Event not found' },
        { status: 404 }
      );
    }

    const entry = await WaitlistEntry.findOne({ eventId: event._id, userId: firebase_uid })
      .select('_id status')
      .lean();

    const isActive = entry?.status === 'waiting' || entry?.status === 'notified';
    return NextResponse.json({ success: true, joined: !!entry && isActive, status: entry?.status || 'none' });
  } catch (error) {
    console.error('[waitlist GET]', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
