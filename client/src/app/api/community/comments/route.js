import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import CommunityComment from '@/models/CommunityComment';
import CommunityPost from '@/models/CommunityPost';
import User from '@/models/User';
import { v4 as uuidv4 } from 'uuid';

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

    const { postId, firebase_uid, content } = await req.json();

    if (!postId || !firebase_uid || !content?.trim()) {
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

    const user = await User.findOne({ firebase_uid }).lean();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const commentId = uuidv4();
    const comment = new CommunityComment({
      commentId,
      postId,
      firebase_uid,
      authorName: user.name,
      authorPicture: user.profilePicture || '',
      content: content.trim(),
    });

    await comment.save();

    await CommunityPost.updateOne(
      { postId },
      { $inc: { commentCount: 1 } }
    );

    return NextResponse.json({
      success: true,
      message: 'Comment added',
      comment,
    });
  } catch (error) {
    console.error('POST Comment Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add comment' },
      { status: 500 }
    );
  }
}

export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const postId = searchParams.get('postId');

    if (!postId) {
      return NextResponse.json(
        { success: false, error: 'postId required' },
        { status: 400 }
      );
    }

    const comments = await CommunityComment.find({ postId })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      comments,
    });
  } catch (error) {
    console.error('GET Comments Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}
