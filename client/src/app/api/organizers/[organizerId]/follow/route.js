import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import OrganizerFollow from "@/models/OrganizerFollow";

export async function GET(req, { params }) {
  try {
    await dbConnect();

    const { organizerId } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    const followersCount = await OrganizerFollow.countDocuments({ organizerId });
    const isFollowing = userId
      ? Boolean(await OrganizerFollow.exists({ organizerId, userId }))
      : false;

    return NextResponse.json({ success: true, followersCount, isFollowing });
  } catch (error) {
    console.error("[organizer follow GET]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    await dbConnect();

    const { organizerId } = await params;
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }

    if (userId === organizerId) {
      return NextResponse.json({ success: false, error: "You cannot follow yourself" }, { status: 400 });
    }

    const [organizer, follower] = await Promise.all([
      User.findOne({ firebase_uid: organizerId }).select("role").lean(),
      User.findOne({ firebase_uid: userId }).select("_id").lean(),
    ]);

    if (!organizer || (organizer.role !== "organizer" && organizer.role !== "admin")) {
      return NextResponse.json({ success: false, error: "Organizer not found" }, { status: 404 });
    }

    if (!follower) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const existing = await OrganizerFollow.findOne({ organizerId, userId });
    let isFollowing;

    if (existing) {
      await OrganizerFollow.deleteOne({ _id: existing._id });
      isFollowing = false;
    } else {
      await OrganizerFollow.create({ organizerId, userId });
      isFollowing = true;
    }

    const followersCount = await OrganizerFollow.countDocuments({ organizerId });

    return NextResponse.json({ success: true, followersCount, isFollowing });
  } catch (error) {
    if (error?.code === 11000) {
      const { organizerId } = await params;
      const followersCount = await OrganizerFollow.countDocuments({ organizerId });
      return NextResponse.json({ success: true, followersCount, isFollowing: true });
    }

    console.error("[organizer follow POST]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
