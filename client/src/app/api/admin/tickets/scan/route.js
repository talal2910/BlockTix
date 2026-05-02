import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Ticket from '@/models/Ticket';
import User from '@/models/User';
import { verifyTicketQR } from '@/lib/qr';

export const runtime = 'nodejs';

async function requireAdmin(adminId) {
  if (!adminId) {
    return { ok: false, res: NextResponse.json({ error: 'adminId is required' }, { status: 400 }) };
  }

  const admin = await User.findOne({ firebase_uid: adminId }).lean();
  if (!admin || admin.role !== 'admin') {
    return { ok: false, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true, admin };
}

export async function POST(req) {
  try {
    await dbConnect();

    const { adminId, qrToken } = await req.json();

    const adminCheck = await requireAdmin(adminId);
    if (!adminCheck.ok) return adminCheck.res;

    if (!qrToken) {
      return NextResponse.json({ error: 'qrToken is required' }, { status: 400 });
    }

    const decoded = verifyTicketQR(qrToken);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired QR code' }, { status: 400 });
    }

    const { ticketId, userId } = decoded;

    // Atomic redeem: only allow transition from valid -> used once.
    const updated = await Ticket.findOneAndUpdate(
      { ticketId, userId, status: 'valid', isRedeemed: false },
      {
        $set: {
          status: 'used',
          isRedeemed: true,
          redeemedAt: new Date(),
          redeemedBy: adminId,
        },
      },
      { new: true }
    ).lean();

    if (updated) {
      return NextResponse.json(
        {
          success: true,
          message: 'Ticket accepted',
          ticket: {
            ticketId: updated.ticketId,
            eventId: updated.eventId,
            userId: updated.userId,
            status: updated.status,
            redeemedAt: updated.redeemedAt,
            redeemedBy: updated.redeemedBy,
          },
        },
        { status: 200 }
      );
    }

    // If atomic update failed, return a clear reason.
    const ticket = await Ticket.findOne({ ticketId }).lean();
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (ticket.userId !== userId) {
      return NextResponse.json({ error: 'Owner mismatch' }, { status: 403 });
    }

    if (ticket.isRedeemed || ticket.status === 'used') {
      return NextResponse.json(
        {
          error: 'Ticket already used',
          ticket: {
            ticketId: ticket.ticketId,
            eventId: ticket.eventId,
            userId: ticket.userId,
            status: ticket.status,
            redeemedAt: ticket.redeemedAt || null,
            redeemedBy: ticket.redeemedBy || null,
          },
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: `Ticket is not valid (status: ${ticket.status})` }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
