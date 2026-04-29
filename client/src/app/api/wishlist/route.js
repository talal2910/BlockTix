import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Wishlist  from '@/models/Wishlist';
import Event     from '@/models/Event';

// GET — fetch the user's wishlist
export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const firebase_uid = searchParams.get('firebase_uid');

    if (!firebase_uid) {
      return NextResponse.json(
        { success: false, message: 'firebase_uid is required' },
        { status: 400 }
      );
    }

    const wishlist = await Wishlist.findOne({ userId: firebase_uid })
      .populate({
        path : 'savedEvents',
        match: { deleted: { $ne: true } },
      })
      .lean();

    const savedEvents = (wishlist?.savedEvents || []).filter(Boolean);

    return NextResponse.json({ success: true, savedEvents });

  } catch (error) {
    console.error('[wishlist GET]', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

// POST — toggle an event in/out of the wishlist
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

    // Look up the event by its eventId UUID
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

    // Atomic toggle to avoid races that can trigger E11000 on userId
    const pullRes = await Wishlist.updateOne(
      { userId: firebase_uid },
      { $pull: { savedEvents: event._id } }
    );

    const removedCount = (pullRes.modifiedCount ?? pullRes.nModified ?? 0);
    if (removedCount > 0) {
      return NextResponse.json({ success: true, saved: false });
    }

    // Not previously saved => add, creating the wishlist doc if needed
    try {
      await Wishlist.updateOne(
        { userId: firebase_uid },
        {
          $setOnInsert: { userId: firebase_uid },
          $addToSet: { savedEvents: event._id },
        },
        { upsert: true }
      );
    } catch (err) {
      // Two concurrent upserts can still collide on the unique index; retry.
      if (err?.code === 11000) {
        await Wishlist.updateOne(
          { userId: firebase_uid },
          { $addToSet: { savedEvents: event._id } }
        );
      } else {
        throw err;
      }
    }

    // Record "wishlist" interaction for ML training
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    fetch(`${baseUrl}/api/recommendations/record`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        firebase_uid,
        event_id,
        interaction_type: 'wishlist',
      }),
    }).catch(() => {});

    return NextResponse.json({ success: true, saved: true });

  } catch (error) {
    console.error('[wishlist POST]', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}