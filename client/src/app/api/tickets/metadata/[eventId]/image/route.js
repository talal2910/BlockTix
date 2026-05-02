import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Event from '@/models/Event';

function getBaseUrl(req) {
    const configuredBaseUrl = (process.env.NEXT_PUBLIC_BASE_URL && process.env.NEXT_PUBLIC_BASE_URL.trim())
        ? process.env.NEXT_PUBLIC_BASE_URL.trim().replace(/\/+$/, '')
        : null;

    if (configuredBaseUrl) return configuredBaseUrl;

    const forwardedProto = req.headers.get('x-forwarded-proto');
    const forwardedHost = req.headers.get('x-forwarded-host');
    const host = forwardedHost || req.headers.get('host');
    const protocol = forwardedProto || (host?.includes('localhost') ? 'http' : 'https');

    return host ? `${protocol}://${host}` : null;
}

function getEventImageUrl(event, baseUrl) {
    const imageValue = (event.image || '').trim();
    if (!imageValue) return null;

    if (/^https?:\/\//i.test(imageValue)) {
        return imageValue;
    }

    return baseUrl
        ? new URL(imageValue.startsWith('/') ? imageValue : `/${imageValue}`, baseUrl).toString()
        : null;
}

function escapeXml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export async function GET(req, { params }) {
    try {
        await dbConnect();
        const { eventId } = await params;
        const event = await Event.findById(eventId);

        if (!event) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        const baseUrl = getBaseUrl(req);
        const eventImageUrl = getEventImageUrl(event, baseUrl);

        if (eventImageUrl) {
            try {
                const imageResponse = await fetch(eventImageUrl, {
                    headers: {
                        'User-Agent': 'BlockTix NFT metadata image proxy'
                    },
                    cache: 'no-store'
                });
                const contentType = imageResponse.headers.get('content-type') || '';

                if (imageResponse.ok && contentType.startsWith('image/')) {
                    const imageBuffer = await imageResponse.arrayBuffer();
                    return new Response(imageBuffer, {
                        headers: {
                            'Content-Type': contentType,
                            'Access-Control-Allow-Origin': '*',
                            'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400'
                        }
                    });
                }
            } catch (imageError) {
                console.warn('Failed to proxy NFT event image:', imageError);
            }
        }

        const title = escapeXml(event.event);
        const location = escapeXml(event.location);
        const date = escapeXml(new Date(event.date).toLocaleDateString());

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#111827"/>
      <stop offset="0.52" stop-color="#312e81"/>
      <stop offset="1" stop-color="#f59e0b"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  <rect x="72" y="72" width="1056" height="1056" rx="56" fill="#111827" fill-opacity="0.55" stroke="#ffffff" stroke-opacity="0.24" stroke-width="4"/>
  <text x="112" y="210" fill="#fbbf24" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="700" letter-spacing="6">BLOCKTIX NFT TICKET</text>
  <text x="112" y="520" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="86" font-weight="800">${title}</text>
  <text x="112" y="635" fill="#ffffff" fill-opacity="0.82" font-family="Arial, Helvetica, sans-serif" font-size="44">${location}</text>
  <text x="112" y="710" fill="#ffffff" fill-opacity="0.72" font-family="Arial, Helvetica, sans-serif" font-size="38">${date}</text>
  <rect x="112" y="910" width="976" height="2" fill="#ffffff" fill-opacity="0.28"/>
  <text x="112" y="1000" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="700">Sepolia ERC-721</text>
</svg>`;

        return new Response(svg, {
            headers: {
                'Content-Type': 'image/svg+xml; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400'
            }
        });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
