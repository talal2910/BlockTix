'use client';

import { useState } from 'react';
import { FaHeart, FaRegHeart, FaComment } from 'react-icons/fa';
import toast from 'react-hot-toast';
import Skeleton from './Skeleton';

export default function CommunityPost({ post, currentUser, onDelete, onLikeChange }) {
  const [showComments, setShowComments] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes || 0);
  const [commentCount, setCommentCount] = useState(post.commentCount || 0);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [addingComment, setAddingComment] = useState(false);
  const postIdentifier = post.postId || post._id;

  const isAuthor = currentUser?.uid === post.firebase_uid;

  const handleLike = async () => {
    if (!currentUser?.uid) {
      toast.error('Login to like posts');
      return;
    }

    try {
      const res = await fetch('/api/community/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: postIdentifier, firebase_uid: currentUser.uid }),
      });

      const data = await res.json();
      if (data.success) {
        setLiked(data.liked);
        setLikes(liked ? likes - 1 : likes + 1);
        onLikeChange?.();
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error('Failed to like post');
    }
  };

  const loadComments = async () => {
    if (showComments) {
      setShowComments(false);
      setShowAllComments(false);
      return;
    }

    setShowComments(true);
    setShowAllComments(false);
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/community/comments?postId=${postIdentifier}`);
      const data = await res.json();
      if (data.success) {
        const fetchedComments = data.comments || [];
        setComments(fetchedComments);
        setCommentCount(fetchedComments.length);
      }
    } catch {
      toast.error('Failed to load comments');
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async () => {
    if (!currentUser?.uid) {
      toast.error('Login to comment');
      return;
    }

    if (!newComment.trim()) {
      toast.error('Comment cannot be empty');
      return;
    }

    setAddingComment(true);
    try {
      const res = await fetch('/api/community/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: postIdentifier,
          firebase_uid: currentUser.uid,
          content: newComment,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setComments((prevComments) => [data.comment, ...prevComments]);
        setCommentCount((prevCount) => prevCount + 1);
        setNewComment('');
        toast.success('Comment added');
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error('Failed to add comment');
    } finally {
      setAddingComment(false);
    }
  };

  const handleDelete = async () => {
    toast.custom((t) => (
      <div className="w-[320px] rounded-2xl border border-white/10 bg-white p-4 shadow-2xl">
        <div className="text-black font-semibold">Delete this post?</div>
        <p className="mt-1 text-sm text-black/70">
          This action cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="rounded-lg px-3 bg-white/30 py-2 text-sm text-black transition hover:bg-green-500 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              toast.dismiss(t.id);

              try {
                const res = await fetch(
                  `/api/community/posts/${postIdentifier}?firebase_uid=${currentUser.uid}`,
                  { method: 'DELETE' }
                );

                const data = await res.json();
                if (data.success) {
                  toast.success('Post deleted');
                  onDelete?.();
                } else {
                  toast.error(data.error);
                }
              } catch {
                toast.error('Failed to delete post');
              }
            }}
            className="rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-600"
          >
            Delete
          </button>
        </div>
      </div>
    ));
  };

  const visibleComments = showAllComments ? comments : comments.slice(0, 2);
  const hiddenCommentsCount = Math.max(comments.length - 2, 0);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 sm:p-6 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {post.authorPicture ? (
            <img
              src={post.authorPicture}
              alt={post.authorName}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#FFA500]/30 flex items-center justify-center text-sm font-bold text-[#FFA500]">
              {post.authorName?.[0] || 'U'}
            </div>
          )}
          <div>
            <div className="text-white font-semibold">{post.authorName}</div>
            <div className="text-xs text-white/50">
              {new Date(post.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>

        {isAuthor && (
          <button
            onClick={handleDelete}
           className="p-2 rounded-lg bg-red-400 text-white hover:bg-red-600 hover:scale-105 transition duration-200 shadow-sm"
            title="Delete post"
          >
           🗑️
          </button>
        )}
      </div>



      {/* Content */}
      <div className="mb-4">
        <p className="text-white text-sm sm:text-base leading-relaxed">{post.content}</p>
        {post.image && (
          <img
            src={post.image}
            alt="Post"
            className="mt-4 rounded-xl max-h-96 w-full object-cover"
          />
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs text-white/60 mb-4 border-y border-white/10 py-3">
        <span>{likes} likes</span>
        <span>{commentCount} comments</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={handleLike}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition text-white text-sm"
        >
          {liked ? <FaHeart className="text-[#FFA500]" /> : <FaRegHeart />}
          <span>Like</span>
        </button>
        <button
          onClick={loadComments}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition text-white text-sm"
          disabled={loadingComments}
        >
          <FaComment />
          <span>Comment</span>
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="border-t border-white/10 pt-4">
          <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
            {loadingComments ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, index) => (
                  <div key={`comment-skeleton-${index}`} className="bg-white/5 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Skeleton variant="circle" className="w-6 h-6" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-3 w-full mb-2" />
                    <Skeleton className="h-3 w-4/5" />
                  </div>
                ))}
              </div>
            ) : comments.length === 0 ? (
              <p className="text-xs text-white/50 text-center py-3">No comments yet</p>
            ) : (
              visibleComments.map((comment) => (
                <div key={comment.commentId} className="bg-white/5 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    {comment.authorPicture ? (
                      <img
                        src={comment.authorPicture}
                        alt={comment.authorName}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[#FFA500]/30 flex items-center justify-center text-xs font-bold text-[#FFA500]">
                        {comment.authorName?.[0] || 'U'}
                      </div>
                    )}
                    <div className="text-xs text-white/70 font-semibold">{comment.authorName}</div>
                    <div className="text-[11px] text-white/50">
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <p className="text-xs text-white/80">{comment.content}</p>
                </div>
              ))
            )}
          </div>

          {!loadingComments && comments.length > 2 && (
            <button
              onClick={() => setShowAllComments((prev) => !prev)}
              className="mb-4 text-xs bg-[#FFA500] hover:bg-[#FF8C00] text-black font-semibold transition"
            >
              {showAllComments
                ? 'Show less comments'
                : `Show more comments (${hiddenCommentsCount})`}
            </button>
          )}

          {/* Add Comment */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-xs text-white placeholder-white/50 focus:outline-none focus:border-[#FFA500]"
            />
            <button
              onClick={handleAddComment}
              disabled={addingComment}
              className="bg-[#FFA500] hover:bg-[#FF8C00] px-4 py-2 rounded-lg text-xs font-semibold text-black transition disabled:opacity-50"
            >
              {addingComment ? 'Adding...' : 'Post'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
