import React from 'react';
import { Sparkles } from './icons/LucideIcons';

interface HeaderProps {
  onToday: () => void;
  currentView?: string;
}

export const Header: React.FC<HeaderProps> = ({ onToday, currentView = 'today' }) => (
  <header className="print:hidden bg-gray-900/90 backdrop-blur-md border-b border-gray-700/80 sticky top-0 z-50">
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-2">
      <div onClick={onToday} className="flex items-center gap-2.5 cursor-pointer group flex-shrink-0">
        <div className="bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 p-2 rounded-xl shadow-lg group-hover:scale-105 transition-transform">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-black bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent tracking-tight">
            Inspire Daily
          </h1>
          <p className="text-[10px] text-gray-400 hidden sm:block">Three checked quotes a day. Free.</p>
        </div>
      </div>
      <button
        onClick={onToday}
        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
          currentView === 'today' ? 'bg-gray-800 text-white border border-gray-600 shadow' : 'text-gray-400 hover:text-white'
        }`}
      >
        Today
      </button>
    </div>
  </header>
);
