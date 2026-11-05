import React from 'react';
import { Sparkles, Plus, BookOpen } from './icons/LucideIcons';

interface HeaderProps {
  onCreate: () => void;
  onFeed?: () => void;
  onQuoteVault?: () => void;
  currentView?: 'feed' | 'create' | 'vault' | string;
}

export const Header: React.FC<HeaderProps> = ({ onCreate, onFeed, onQuoteVault, currentView = 'feed' }) => {
  return (
    <header className="print:hidden bg-gray-900/90 backdrop-blur-md border-b border-gray-700/80 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-2">
          <div onClick={onFeed} className="flex items-center gap-2.5 cursor-pointer group flex-shrink-0">
            <div className="bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 p-2 rounded-xl shadow-lg group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent tracking-tight">
                Inspire Daily
              </h1>
              <p className="text-[10px] text-gray-400 hidden sm:block">You pick, you post.</p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-1">
            <button
              onClick={onFeed}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                currentView === 'feed' ? 'bg-gray-800 text-white border border-gray-600 shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              Posts
            </button>

            <button
              onClick={onQuoteVault}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                currentView === 'vault' ? 'bg-indigo-900/60 text-indigo-300 border border-indigo-700 shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Quotes</span>
            </button>

            <button
              onClick={onCreate}
              className={`flex items-center gap-1 font-extrabold py-1.5 px-3 rounded-xl text-xs transition-all shadow-md ${
                currentView === 'create' ? 'bg-indigo-500 text-white ring-2 ring-indigo-400' : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-lg'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
