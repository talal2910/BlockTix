import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Event from "@/models/Event";
import Ticket from "@/models/Ticket";
import User from '@/models/User';
import { fillNotifiedWaitlistSlots } from '@/lib/waitlist';

export async function GET(req, {params}) {
  const { id }= await params;  
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const organizerId = searchParams.get('organizerId');
    const adminId = searchParams.get('adminId');

    // Only fetch non-deleted events
    const event = await Event.findOne({
      eventId: id,
      deleted: { $ne: true }
    });  

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const status = event.approvalStatus;
    const isLegacyApproved = typeof status === 'undefined' || status === null;
    const isApproved = status === 'approved' || isLegacyApproved;

    if (!isApproved) {
      // Allow organizer who created it
      if (organizerId && organizerId === event.organizerId) {
        return NextResponse.json(event, { status: 200 });
      }

      // Allow admin
      if (adminId) {
        const admin = await User.findOne({ firebase_uid: adminId }).lean();
        if (admin?.role === 'admin') {
          return NextResponse.json(event, { status: 200 });
        }
      }

      return NextResponse.json({ error: 'Event not approved yet' }, { status: 404 });
    }

    return NextResponse.json(event, { status: 200 });
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// UPDATE event

export async function PUT(req, { params }) {
  try {
    await dbConnect();
    const body = await req.json();
    const { id } = await params;
    const { organizerId, adminId, ...updates } = body || {};

    const event = await Event.findOne({
      $or: [{ eventId: id }, { _id: id }]
    });

    if (!event || event.deleted) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
    }

    let isAuthorized = false;
    if (adminId) {
      const admin = await User.findOne({ firebase_uid: adminId }).lean();
      isAuthorized = admin?.role === 'admin';
    } else if (organizerId) {
      isAuthorized = organizerId === event.organizerId;
    }

    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const allowedFields = new Set([
      'event', 'date', 'time', 'location', 'category', 'price',
      'totalTickets', 'remainingTickets', 'image', 'earlyBird',
      'latitude', 'longitude'
    ]);

    const safeUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key, value]) => allowedFields.has(key) && value !== undefined)
    );

    const prevRemaining = event.remainingTickets ?? 0;
    const updatedEvent = await Event.findByIdAndUpdate(event._id, safeUpdates, { new: true });

    const nextRemaining = updatedEvent?.remainingTickets ?? prevRemaining;
    const newlyAvailable = nextRemaining - prevRemaining;
    if (newlyAvailable > 0) {
      await fillNotifiedWaitlistSlots({ event: updatedEvent });
    }
    return NextResponse.json({ success: true, event: updatedEvent });
  } catch (error) {
    return NextResponse.json({ success: false, error: `Update failed ${error}` }, { status: 500 });
  }
}

// DELETE event (soft delete)
export async function DELETE(req, { params }) {
  try {
    await dbConnect();
    const { id } = await params;

    const { searchParams } = new URL(req.url);
    const adminId = searchParams.get('adminId');
    if (!adminId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const admin = await User.findOne({ firebase_uid: adminId }).lean();
    if (admin?.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    
    // Find event by eventId or _id
    const event = await Event.findOne({
      $or: [
        { eventId: id },
        { _id: id }
      ]
    });

    if (!event) {
      return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 });
    }

    // Check if event has any tickets
    const ticketCount = await Ticket.countDocuments({ eventId: event._id });
    if (ticketCount > 0) {
      // Soft delete instead of hard delete
      event.deleted = true;
      event.deletedAt = new Date();
      await event.save();
      
      return NextResponse.json({ 
        success: true, 
        message: `Event soft-deleted. ${ticketCount} ticket(s) still exist for this event.`,
        softDeleted: true
      });
    }

    // If no tickets exist, we can hard delete
    await Event.findByIdAndDelete(event._id);
    return NextResponse.json({ success: true, message: "Event deleted permanently" });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ success: false, error: error.message || "Delete failed" }, { status: 500 });
  }
}
