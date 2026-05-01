import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import Event from "@/models/Event";
import Ticket from "@/models/Ticket";
import EventRating from "@/models/EventRating";

async function findEvent(id) {
  const query = mongoose.Types.ObjectId.isValid(id)
    ? { $or: [{ eventId: id }, { _id: id }] }
    : { eventId: id };

  return Event.findOne({ ...query, deleted: { $ne: true } });
}

async function getRatingStats(eventObjectId) {
  const [stats] = await EventRating.aggregate([
    { $match: { eventId: eventObjectId } },
    {
      $group: {
        _id: "$eventId",
        averageRating: { $avg: "$rating" },
        ratingsCount: { $sum: 1 },
      },
    },
  ]);

  return {
    averageRating: stats?.averageRating || 0,
    ratingsCount: stats?.ratingsCount || 0,
  };
}

export async function GET(req, { params }) {
  try {
    await dbConnect();

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    const event = await findEvent(id);
    if (!event) {
      return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 });
    }

    const stats = await getRatingStats(event._id);
    const userRating = userId
      ? await EventRating.findOne({ eventId: event._id, userId }).lean()
      : null;
    const canRate = userId
      ? Boolean(await Ticket.exists({ eventId: event._id, userId}))
      : false;

    return NextResponse.json({
      success: true,
      ...stats,
      canRate,
      userRating,
    });
  } catch (error) {
    console.error("[event ratings GET]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    await dbConnect();

    const { id } = await params;
    const { userId, rating, comment = "" } = await req.json();

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }

    const parsedRating = Number(rating);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return NextResponse.json({ success: false, error: "rating must be an integer from 1 to 5" }, { status: 400 });
    }

    const event = await findEvent(id);
    if (!event) {
      return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 });
    }

    const hasPurchased = await Ticket.exists({ eventId: event._id, userId });
    if (!hasPurchased) {
      return NextResponse.json(
    { success: false, error: "Only users who purchased a ticket can rate this event" },
    { status: 403 }
    );
    }

    const savedRating = await EventRating.findOneAndUpdate(
      { eventId: event._id, userId },
      {
        $set: {
          rating: parsedRating,
          comment: String(comment || "").slice(0, 1000),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    const stats = await getRatingStats(event._id);

    return NextResponse.json({
      success: true,
      rating: savedRating,
      ...stats,
    });
  } catch (error) {
    console.error("[event ratings POST]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
