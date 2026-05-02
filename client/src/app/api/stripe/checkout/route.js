import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import Event from "@/models/Event";
import { getStripe, STRIPE_CURRENCY, toStripeAmount } from "@/lib/stripe";
import { getEffectiveTicketPrice } from "@/lib/ticketPricing";

function getBaseUrl(req) {
  const configuredBaseUrl = (process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_URL || "").trim();
  if (configuredBaseUrl) return configuredBaseUrl.replace(/\/+$/, "");

  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost || req.headers.get("host");
  const protocol = forwardedProto || (host?.includes("localhost") ? "http" : "https");

  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

function buildEventQuery(eventId) {
  const query = [{ eventId }];
  if (mongoose.Types.ObjectId.isValid(eventId)) {
    query.push({ _id: eventId });
  }
  return { $or: query, deleted: { $ne: true } };
}

function getStripeImage(image) {
  return /^https?:\/\//i.test(image || "") ? [image] : undefined;
}

export async function POST(req) {
  try {
    await dbConnect();

    const { eventId, userId, userEmail } = await req.json();
    if (!eventId || !userId) {
      return NextResponse.json({ error: "Event and user are required." }, { status: 400 });
    }

    const event = await Event.findOne(buildEventQuery(eventId));
    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    if (event.remainingTickets <= 0) {
      return NextResponse.json({ error: "This event is sold out." }, { status: 400 });
    }

    const { price, earlyBirdActive } = getEffectiveTicketPrice(event);
    const amount = toStripeAmount(price);
    const baseUrl = getBaseUrl(req);
    const publicEventId = event.eventId || eventId;
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: userEmail || undefined,
      client_reference_id: `${userId}:${event._id}`,
      success_url: `${baseUrl}/event/${publicEventId}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/event/${publicEventId}?checkout=cancelled`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: STRIPE_CURRENCY,
            unit_amount: amount,
            product_data: {
              name: `${event.event} Ticket`,
              description: `${event.location} - ${new Date(event.date).toLocaleDateString("en-US")}`,
              images: getStripeImage(event.image),
            },
          },
        },
      ],
      metadata: {
        eventId: String(event._id),
        publicEventId: String(publicEventId),
        userId: String(userId),
        price: String(price),
        earlyBirdActive: String(Boolean(earlyBirdActive)),
      },
      payment_intent_data: {
        metadata: {
          eventId: String(event._id),
          publicEventId: String(publicEventId),
          userId: String(userId),
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: error.message || "Unable to start checkout." },
      { status: 500 }
    );
  }
}
