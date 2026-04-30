import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Notification from '@/models/Notification';

export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const firebase_uid = searchParams.get('firebase_uid');
    const limit = Number.parseInt(searchParams.get('limit') || '50', 10);

    if (!firebase_uid) {
      return NextResponse.json(
        { success: false, message: 'firebase_uid is required' },
        { status: 400 }
      );
    }

    const notifications = await Notification.find({ userId: firebase_uid })
      .populate({
        path: 'eventId',
        select: 'event eventId deleted',
        match: { deleted: { $ne: true } },
      })
      .sort({ createdAt: -1 })
      .limit(Math.max(1, Math.min(100, limit)))
      .lean();

    return NextResponse.json({ success: true, notifications });
  } catch (error) {
    console.error('[notifications GET]', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    await dbConnect();

    const { firebase_uid } = await req.json();

    if (!firebase_uid) {
      return NextResponse.json(
        { success: false, message: 'firebase_uid is required' },
        { status: 400 }
      );
    }

    await Notification.updateMany(
      { userId: firebase_uid, read: false },
      { $set: { read: true } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[notifications POST]', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
