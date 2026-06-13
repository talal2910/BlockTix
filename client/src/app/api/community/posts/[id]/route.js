import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import CommunityPost from '@/models/CommunityPost';
import CommunityComment from '@/models/CommunityComment';
import CommunityLike from '@/models/CommunityLike';

function buildPostFilter(id) {
  const filter = { postId: id };

  if (mongoose.Types.ObjectId.isValid(id)) {
    return { $or: [filter, { _id: id }] };
  }

  return filter;
}

export async function GET(req, { params }) {
  try {
    await dbConnect();

    const { id } = await params;

    const post = await CommunityPost.findOne(buildPostFilter(id)).lean();
    if (!post) {
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404 }
      );
    }

    const likes = await CommunityLike.countDocuments({ postId: id });
    const comments = await CommunityComment.find({ postId: id })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      post: { ...post, likes, commentCount: comments.length },
      comments,
    });
  } catch (error) {
    console.error('GET Post Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch post' },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    await dbConnect();

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const firebase_uid = searchParams.get('firebase_uid');

    const post = await CommunityPost.findOne(buildPostFilter(id));
    if (!post) {
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404 }
      );
    }

    if (post.firebase_uid !== firebase_uid) {
      return NextResponse.json(
        { success: false, error: 'Not authorized' },
        { status: 403 }
      );
    }

    await CommunityPost.deleteOne(buildPostFilter(id));
    await CommunityComment.deleteMany({ postId: id });
    await CommunityLike.deleteMany({ postId: id });

    return NextResponse.json({
      success: true,
      message: 'Post deleted',
    });
  } catch (error) {
    console.error('DELETE Post Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete post' },
      { status: 500 }
    );
  }
}
