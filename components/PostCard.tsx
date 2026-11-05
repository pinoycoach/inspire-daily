import React, { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Post, UserBrandSettings } from '../types';
import { Twitter, Instagram, Facebook, LinkedIn, TikTok, Threads } from './icons/PlatformIcons';
import { Download, Camera, Copy, Check, Sparkles } from './icons/LucideIcons';
import { downloadPostGraphic, GraphicStyle } from '../services/canvasExportService';
import { saveImage } from '../services/saveImage';
import { avatarFor } from '../shared/avatar';

const PlatformIcon: React.FC<{ platform: Post['platform'] }> = ({ platform }) => {
  switch (platform) {
    case 'Twitter':
      return <Twitter className="w-6 h-6 text-[#1DA1F2]" />;
    case 'Instagram':
      return <Instagram className="w-6 h-6" />;
    case 'Facebook':
      return <Facebook className="w-6 h-6 text-[#1877F2]" />;
    case 'LinkedIn':
        return <LinkedIn className="w-6 h-6 text-[#0A66C2]" />;
    case 'TikTok':
        return <TikTok className="w-6 h-6" />;
    case 'Threads':
        return <Threads className="w-6 h-6 text-black dark:text-white" />;
    default:
      return null;
  }
};

export const PostCard: React.FC<{ post: Post; brandSettings?: UserBrandSettings }> = ({ post, brandSettings }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [selectedAngle, setSelectedAngle] = useState<string>(post.activeAngle || 'inspirational');

  // Compute active caption text and hashtags based on selected angle
  const activeAngleObj = post.captionAngles?.find(a => a.angle === selectedAngle) || post.captionAngles?.[0];
  const activeContent = activeAngleObj
    ? `${activeAngleObj.content}\n\n${activeAngleObj.hashtags.join(' ')}`
    : post.content;

  const handleDownloadScreenshot = async (style: GraphicStyle = 'card') => {
    if (isExporting) return;
    setIsExporting(true);
    setDownloadSuccess(null);

    // Pass the active angle's text to the canvas compositor so the downloaded image matches the selected caption
    const postToExport: Post = {
      ...post,
      content: activeContent,
    };

    try {
      // 1. Direct canvas compositor: guarantees text + photo are rendered together with zero CORS/font sheet crash
      await downloadPostGraphic(postToExport, style, brandSettings);
      setDownloadSuccess(style === 'quote_on_photo' ? 'Quote Saved!' : 'Post Saved!');
      setTimeout(() => setDownloadSuccess(null), 3000);
    } catch (err: any) {
      console.warn('Direct canvas generator fallback to DOM capture:', err);
      try {
        if (cardRef.current) {
          const dataUrl = await toPng(cardRef.current, {
            pixelRatio: 2,
            fontEmbedCSS: '',
            filter: (node) => {
              if (node instanceof HTMLElement && node.dataset.noExport === 'true') {
                return false;
              }
              return true;
            },
          });
          await saveImage(dataUrl, `${post.platform.toLowerCase()}-post-${Date.now()}.png`);
          setDownloadSuccess('Post Saved!');
          setTimeout(() => setDownloadSuccess(null), 3000);
        }
      } catch (domErr) {
        console.error('All screenshot generation methods failed:', domErr);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadMedia = () => {
    if (post.imageUrl) {
      saveImage(post.imageUrl, `${post.platform.toLowerCase()}-photo-${Date.now()}.png`);
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(activeContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  return (
    <div 
      ref={cardRef}
      className="bg-gray-800 border border-gray-700 rounded-2xl shadow-lg overflow-hidden transition-all hover:shadow-xl hover:border-gray-600 relative group"
    >
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <img 
              src={post.avatar && /^(https?:|data:image\/svg\+xml)/.test(post.avatar) ? post.avatar : avatarFor(post.username || '?')} 
              alt={post.username} 
              crossOrigin="anonymous" 
              onError={(e) => {
                const fallback = avatarFor(post.username || '?');
                if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
              }}
              className="w-12 h-12 rounded-full border-2 border-gray-600 object-cover" 
            />
            <div>
              <p className="font-bold text-lg text-white">{post.username}</p>
              <p className="text-gray-400 text-sm">{post.handle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-gray-700/80 text-gray-300 font-medium">
              {post.platform}
            </span>
            <PlatformIcon platform={post.platform} />
          </div>
        </div>

        {/* 5 Distinct Caption Angles Switcher */}
        {post.captionAngles && post.captionAngles.length > 0 && (
          <div data-no-export="true" className="mb-4 bg-gray-900/60 border border-gray-700/70 rounded-xl p-2.5">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <span>5 Caption Angles:</span>
              </span>
              <span className="text-[11px] text-gray-400">
                Switch tone & hashtags
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {post.captionAngles.map((a) => {
                const isSelected = selectedAngle === a.angle;
                const angleIcons: Record<string, string> = {
                  inspirational: '✨',
                  question: '❓',
                  informative: '💡',
                  humorous: '😄',
                  cta: '🎯',
                };
                return (
                  <button
                    key={a.angle}
                    type="button"
                    onClick={() => setSelectedAngle(a.angle)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 text-center ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400 font-semibold'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'
                    }`}
                  >
                    <span>{angleIcons[a.angle] || '📝'}</span>
                    <span className="truncate">{a.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Active Caption Content */}
        <p className="text-gray-200 text-base leading-relaxed whitespace-pre-wrap mb-4 font-normal">
          {activeContent}
        </p>
        
        <div className="mb-4 rounded-xl overflow-hidden border border-gray-700 bg-black/40">
            {post.imageUrl && (
              <img 
                src={post.imageUrl} 
                alt={post.prompt || 'Inspirational visual'} 
                crossOrigin="anonymous" 
                className="w-full h-auto object-cover max-h-[500px]" 
              />
            )}
        </div>

        {/* Actions. No likes, comments or shares here: those would be made-up numbers. */}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-700 pt-3 text-sm text-gray-400">

          {/* Action buttons (excluded from screenshot export) */}
          <div data-no-export="true" className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              title="Copy post caption"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700/60 hover:bg-gray-700 text-gray-300 hover:text-white transition text-xs font-medium"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-green-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Text</span>
                </>
              )}
            </button>

            {post.imageUrl && (
              <button
                type="button"
                onClick={handleDownloadMedia}
                title="Download raw photo file"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700/60 hover:bg-gray-700 text-gray-300 hover:text-white transition text-xs font-medium"
              >
                <Download className="w-4 h-4" />
                <span>Raw Photo</span>
              </button>
            )}

            {/* Quote on Photo option (if image exists) */}
            {post.imageUrl && (
              <button
                type="button"
                onClick={() => handleDownloadScreenshot('quote_on_photo')}
                disabled={isExporting}
                title="Download photo with quote overlaid on it"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-700/80 hover:bg-purple-600 text-white transition text-xs font-medium shadow-sm disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Quote on Photo</span>
              </button>
            )}

            {/* Main Screenshot Button: Text + Photo Combined */}
            <button
              type="button"
              onClick={() => handleDownloadScreenshot('card')}
              disabled={isExporting}
              title="Download image screenshot with post text and photo"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition text-xs font-semibold shadow-md hover:shadow-lg disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Rendering...</span>
                </>
              ) : downloadSuccess ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>{downloadSuccess}</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  <span>Download (Text + Photo)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};