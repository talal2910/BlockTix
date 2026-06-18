import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/User';

const VALID_CATEGORIES = ["Art", "Sports", "Food And Drink", "Education", "Festival", "Music", "Other"];

export async function POST(req) {
    try {
        await dbConnect();
        const { firebase_uid, categories, city, location } = await req.json();

        if (!firebase_uid) {
            return NextResponse.json({ success: false, message: 'firebase_uid is required' }, { status: 400 });
        }

        const update = {};

        if (Array.isArray(categories)) {
            update.preferredCategories = categories.filter(c => VALID_CATEGORIES.includes(c));
        }

        if (city !== undefined) {
            update.city = city?.trim() || null;
        }

        if (location !== undefined) {
            const lat = Number(location?.lat);
            const lng = Number(location?.lng);
            update.location = Number.isFinite(lat) && Number.isFinite(lng)
                ? { lat, lng }
                : { lat: null, lng: null };
        }

        const user = await User.findOneAndUpdate(
            { firebase_uid },
            update,
            { new: true }
        );

        if (!user) {
            return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            preferredCategories: user.preferredCategories,
            city: user.city,
            location: user.location || null,
        });

    } catch (error) {
        console.error('Preferences update error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET(req) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const firebase_uid = searchParams.get('firebase_uid');

        if (!firebase_uid) {
            return NextResponse.json({ success: false, message: 'firebase_uid is required' }, { status: 400 });
        }

        const user = await User.findOne({ firebase_uid }).select('preferredCategories city location').lean();

        if (!user) {
            return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            preferredCategories: user.preferredCategories || [],
            city: user.city || null,
            location: user.location || null,
        });

    } catch (error) {
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
