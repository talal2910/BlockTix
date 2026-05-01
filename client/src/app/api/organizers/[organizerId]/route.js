import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import Event from "@/models/Event";
import EventRating from "@/models/EventRating";
import OrganizerFollow from "@/models/OrganizerFollow";

export async function GET(req, { params }) {
  try {
    await dbConnect();

    const { organizerId } = await params;
    const { searchParams } = new URL(req.url);
    const viewerId = searchParams.get("viewerId");

    const organizer = await User.findOne({ firebase_uid: organizerId })
      .select("firebase_uid name email role bio profilePicture createdAt")
      .lean();

    if (!organizer || (organizer.role !== "organizer" && organizer.role !== "admin")) {
      return NextResponse.json({ success: false, error: "Organizer not found" }, { status: 404 });
    }

    const events = await Event.find({
      organizerId,
      deleted: { $ne: true },
      $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }],
    })
      .sort({ date: 1, createdAt: -1 })
      .lean();

    const eventObjectIds = events.map((event) => event._id);

    const [ratingStats] = eventObjectIds.length
      ? await EventRating.aggregate([
          { $match: { eventId: { $in: eventObjectIds } } },
          {
            $group: {
              _id: null,
              averageRating: { $avg: "$rating" },
              ratingsCount: { $sum: 1 },
            },
          },
        ])
      : [];

    const followersCount = await OrganizerFollow.countDocuments({ organizerId });
    const isFollowing = viewerId
      ? Boolean(await OrganizerFollow.exists({ organizerId, userId: viewerId }))
      : false;

    return NextResponse.json({
      success: true,
      organizer: {
        ...organizer,
        followersCount,
        averageRating: ratingStats?.averageRating || 0,
        ratingsCount: ratingStats?.ratingsCount || 0,
        isFollowing,
      },
      events,
    });
  } catch (error) {
    console.error("[organizer profile GET]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
