import React, { useState, useMemo, useEffect } from 'react';
import { QUOTES_DATABASE as BUNDLED_QUOTES, TimelessQuote } from '../data/quotesDatabase';
import { listQuotes } from '../services/inspireApi';
import { Search, Sparkles, Shuffle, Copy, Check, ArrowRight, BookOpen } from './icons/LucideIcons';

interface QuoteVaultViewProps {
  onUseQuote: (quoteText: string, suggestedPrompt: string) => void;
}

export const QuoteVaultView: React.FC<QuoteVaultViewProps> = ({ onUseQuote }) => {
  // The quote library comes from the server's database; the bundled list shows until it loads (or if it can't).
  const [QUOTES_DATABASE, setQuotes] = useState<TimelessQuote[]>(BUNDLED_QUOTES);
  useEffect(() => {
    listQuotes()
      .then((quotes) => {
        if (quotes.length) setQuotes(quotes);
      })
      .catch(() => {});
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedEra, setSelectedEra] = useState<string>('All');
  const [activeVersion, setActiveVersion] = useState<'both' | 'modern' | 'classic'>('both');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [highlightedQuote, setHighlightedQuote] = useState<TimelessQuote | null>(null);

  const categories = ['All', 'Resilience', 'Leadership', 'Focus & Stillness', 'Creativity', 'Courage'];
  const eras = [
    'All',
    'Ancient Stoics & Romans',
    'Eastern Philosophy',
    'Enlightenment & Literature',
    'Trailblazers & Leaders',
    'Modern Innovators',
  ];

  const filteredQuotes = useMemo(() => {
    return QUOTES_DATABASE.filter((q) => {
      const matchesCategory = selectedCategory === 'All' || q.category === selectedCategory;
      const matchesEra = selectedEra === 'All' || q.era === selectedEra;
      const qText = `${q.author} ${q.originalQuote} ${q.modernizedQuote} ${q.context}`.toLowerCase();
      const matchesSearch = !searchQuery || qText.includes(searchQuery.toLowerCase());
      return matchesCategory && matchesEra && matchesSearch;
    });
  }, [searchQuery, selectedCategory, selectedEra]);

  const handleShuffle = () => {
    const randomIndex = Math.floor(Math.random() * QUOTES_DATABASE.length);
    const chosen = QUOTES_DATABASE[randomIndex];
    setHighlightedQuote(chosen);
    // Scroll highlighted into view
    setTimeout(() => {
      const el = document.getElementById(`quote-${chosen.id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-gray-900 via-indigo-950/60 to-gray-900 border border-gray-700/80 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-2xl">
          <div className="flex items-center gap-2.5 text-indigo-400 font-semibold text-xs tracking-wider uppercase mb-2">
            <BookOpen className="w-4 h-4" />
            <span>Never Run Out of Inspiration</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
            Timeless Quote Vault
          </h2>
          <p className="text-gray-300 text-sm sm:text-base mt-2 leading-relaxed">
            Ancient Stoic wisdom, Eastern philosophy, and visionary words from history — preserved in their original beauty and translated into punchy, high-impact modern hooks.
          </p>
        </div>

        {/* Action Controls */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleShuffle}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-4 rounded-xl text-sm shadow-md transition"
          >
            <Shuffle className="w-4 h-4" />
            <span>Surprise Me / Quote of the Day</span>
          </button>

          <div className="flex items-center bg-gray-800/90 border border-gray-700 rounded-xl p-1 text-xs">
            <button
              onClick={() => setActiveVersion('both')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeVersion === 'both' ? 'bg-indigo-600 text-white font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Both Versions
            </button>
            <button
              onClick={() => setActiveVersion('modern')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeVersion === 'modern' ? 'bg-indigo-600 text-white font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Modernized
            </button>
            <button
              onClick={() => setActiveVersion('classic')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeVersion === 'classic' ? 'bg-indigo-600 text-white font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Classical
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by philosopher, keyword, or wisdom..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          <select
            value={selectedEra}
            onChange={(e) => setSelectedEra(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          >
            {eras.map((e) => (
              <option key={e} value={e}>
                Era: {e}
              </option>
            ))}
          </select>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const isSelected = selectedCategory === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedCategory(c)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition ${
                  isSelected
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quotes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredQuotes.map((q) => {
          const isHighlighted = highlightedQuote?.id === q.id;
          return (
            <div
              key={q.id}
              id={`quote-${q.id}`}
              className={`bg-gray-800/90 border rounded-2xl p-6 flex flex-col justify-between transition-all hover:border-indigo-500/60 shadow-lg ${
                isHighlighted
                  ? 'border-indigo-500 ring-2 ring-indigo-500/50 bg-gradient-to-br from-gray-800 via-indigo-950/40 to-gray-800'
                  : 'border-gray-700/80'
              }`}
            >
              <div>
                {/* Meta Badges */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full bg-indigo-950/80 border border-indigo-700/60 text-indigo-300">
                    {q.category}
                  </span>
                  <span className="text-xs text-gray-400 truncate max-w-[200px]">
                    {q.era}
                  </span>
                </div>

                {/* Author & Context */}
                <h3 className="font-bold text-white text-lg tracking-tight">
                  {q.author}
                </h3>
                <p className="text-xs text-gray-400 mb-4">{q.context}</p>

                {/* Modernized Version */}
                {(activeVersion === 'both' || activeVersion === 'modern') && (
                  <div className="bg-gray-900/80 border border-indigo-900/50 rounded-xl p-3.5 mb-3">
                    <div className="flex items-center justify-between text-[11px] text-indigo-400 font-semibold uppercase tracking-wider mb-1.5">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        Modernized Angle
                      </span>
                      <button
                        onClick={() => handleCopy(`${q.id}-mod`, q.modernizedQuote)}
                        title="Copy modernized quote"
                        className="text-gray-400 hover:text-white"
                      >
                        {copiedId === `${q.id}-mod` ? (
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <p className="text-gray-200 text-sm leading-relaxed font-medium">
                      "{q.modernizedQuote}"
                    </p>
                  </div>
                )}

                {/* Classic Version */}
                {(activeVersion === 'both' || activeVersion === 'classic') && (
                  <div className="bg-gray-900/50 border border-gray-700/70 rounded-xl p-3.5 mb-4">
                    <div className="flex items-center justify-between text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-1.5">
                      <span>Original Classical Text</span>
                      <button
                        onClick={() => handleCopy(`${q.id}-orig`, q.originalQuote)}
                        title="Copy original quote"
                        className="text-gray-400 hover:text-white"
                      >
                        {copiedId === `${q.id}-orig` ? (
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <p className="text-gray-300 text-sm italic leading-relaxed">
                      "{q.originalQuote}"
                    </p>
                  </div>
                )}
              </div>

              {/* Action Button: Spin into Post */}
              <div className="pt-3 border-t border-gray-700/70 flex items-center justify-between gap-3">
                <span className="text-xs text-gray-400 truncate max-w-[180px]">
                  💡 Visual: {q.suggestedPrompt.substring(0, 32)}...
                </span>

                <button
                  type="button"
                  onClick={() => onUseQuote(q.modernizedQuote || q.originalQuote, q.suggestedPrompt)}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-3.5 rounded-xl text-xs shadow transition group"
                >
                  <span>Create Post with This</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredQuotes.length === 0 && (
        <div className="text-center py-16 bg-gray-800/40 border border-gray-700 rounded-2xl">
          <BookOpen className="w-12 h-12 mx-auto text-gray-500 mb-3" />
          <h3 className="text-lg font-bold text-white">No quotes matched your search</h3>
          <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or search keywords.</p>
        </div>
      )}
    </div>
  );
};
