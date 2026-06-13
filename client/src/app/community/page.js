'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import CommunityPost from '../components/CommunityPost';
import CreatePost from '../components/CreatePost';
import CommunityPostSkeleton from '../components/CommunityPostSkeleton';

export default function CommunityPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);

  const postsPerPage = 10;

  const loadPosts = async (pageNum = 1) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/community/posts?page=${pageNum}&limit=${postsPerPage}`
      );
      const data = await res.json();
      if (data.success) {
        setPosts(data.posts);
        setTotal(data.total);
        setPages(data.pages);
        setPage(pageNum);
      }
    } catch (err) {
      console.error('Failed to load posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts(1);
  }, []);

  const handlePostCreated = () => {
    loadPosts(1);
  };

  const handlePostDeleted = () => {
    loadPosts(page);
  };

  return (
    <main className="min-h-screen px-4 sm:px-6 py-8 bg-white/10 backdrop-blur-sm">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-white">Community</h1>
          <p className="text-white/60 text-sm sm:text-base mt-2">
            Share your thoughts, feedback, and connect with others
          </p>
        </div>

        {/* Create Post */}
        {user ? (
          <CreatePost currentUser={user} onPostCreated={handlePostCreated} />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 mb-6 text-center">
            <p className="text-white/70 mb-4">Login to create posts and engage with the community</p>
            <button
              onClick={() => router.push('/login')}
              className="bg-[#FFA500] hover:bg-[#FF8C00] px-6 py-2 rounded-lg text-sm font-bold text-black transition"
            >
              Login
            </button>
          </div>
        )}

        {/* Posts Feed */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <CommunityPostSkeleton key={i} />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/60">No posts yet. Be the first to post!</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {posts.map((post) => (
                <CommunityPost
                  key={post.postId || post._id}
                  post={post}
                  currentUser={user}
                  onDelete={handlePostDeleted}
                  onLikeChange={handlePostCreated}
                />
              ))}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <button
                  onClick={() => loadPosts(page - 1)}
                  disabled={page === 1}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-sm transition"
                >
                  Previous
                </button>

                <div className="flex items-center gap-2">
                  {[...Array(pages)].map((_, i) => {
                    const p = i + 1;
                    const show =
                      p === 1 || p === pages || (p >= page - 1 && p <= page + 1);

                    if (!show) return null;

                    return (
                      <button
                        key={p}
                        onClick={() => loadPosts(p)}
                        className={`px-3 py-1 rounded-lg text-sm transition ${
                          p === page
                            ? 'bg-[#FFA500] text-black font-bold'
                            : 'bg-white/10 hover:bg-white/20 text-white'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => loadPosts(page + 1)}
                  disabled={page === pages}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-sm transition"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
