import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import CommunityLike from '@/models/CommunityLike';
import CommunityPost from '@/models/CommunityPost';

function buildPostFilter(postId) {
  const filter = { postId };

  if (mongoose.Types.ObjectId.isValid(postId)) {
    return { $or: [filter, { _id: postId }] };
  }

  return filter;
}

export async function POST(req) {
  try {
    await dbConnect();

    const { postId, firebase_uid } = await req.json();

    if (!postId || !firebase_uid) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const post = await CommunityPost.findOne(buildPostFilter(postId));
    if (!post) {
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404 }
      );
    }

    const existingLike = await CommunityLike.findOne({ postId, firebase_uid });

    if (existingLike) {
      await CommunityLike.deleteOne({ postId, firebase_uid });
      await CommunityPost.updateOne({ postId }, { $inc: { likes: -1 } });
      return NextResponse.json({
        success: true,
        liked: false,
        message: 'Like removed',
      });
    } else {
      await CommunityLike.create({ postId, firebase_uid });
      await CommunityPost.updateOne({ postId }, { $inc: { likes: 1 } });
      return NextResponse.json({
        success: true,
        liked: true,
        message: 'Post liked',
      });
    }
  } catch (error) {
    console.error('POST Like Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update like' },
      { status: 500 }
    );
  }
}

export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const postId = searchParams.get('postId');
    const firebase_uid = searchParams.get('firebase_uid');

    if (!postId || !firebase_uid) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const like = await CommunityLike.findOne({ postId, firebase_uid }).lean();

    return NextResponse.json({
      success: true,
      liked: !!like,
    });
  } catch (error) {
    console.error('GET Like Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch like status' },
      { status: 500 }
    );
  }
}
