import React from 'react';
import { Post, UserBrandSettings } from '../types';
import { PostCard } from './PostCard';
import { Sparkles } from './icons/LucideIcons';

interface FeedViewProps {
  posts: Post[];
  onCreate: () => void;
  brandSettings?: UserBrandSettings;
}

export const FeedView: React.FC<FeedViewProps> = ({ posts, onCreate, brandSettings }) => {
  if (posts.length === 0) {
    return (
        <div className="text-center py-20">
            <Sparkles className="w-16 h-16 mx-auto text-blue-400 mb-4" />
            <h2 className="text-3xl font-bold mb-2">The Canvas is Blank!</h2>
            <p className="text-gray-400 mb-6">Your feed is awaiting inspiration. Be the first to create an uplifting post.</p>
            <button onClick={onCreate} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all">
                Create the First Post
            </button>
        </div>
    )
  }

  return (
    <div className="space-y-6">
      {posts.map(post => (
        <PostCard key={post.id} post={post} brandSettings={brandSettings} />
      ))}
    </div>
  );
};