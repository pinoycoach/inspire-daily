import React, { useEffect, useState } from 'react';
import { SAVE_IMAGE_EVENT, type SaveImageDetail } from '../services/saveImage';
import { Download, X } from './icons/LucideIcons';

// On phones: shows the finished picture with a Save/Share button and a press-and-hold hint.
export const SaveImageSheet: React.FC = () => {
  const [item, setItem] = useState<SaveImageDetail | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const onSave = (e: Event) => {
      setNote(null);
      setItem((prev) => {
        if (prev?.url.startsWith('blob:')) URL.revokeObjectURL(prev.url);
        return (e as CustomEvent<SaveImageDetail>).detail;
      });
    };
    window.addEventListener(SAVE_IMAGE_EVENT, onSave);
    return () => window.removeEventListener(SAVE_IMAGE_EVENT, onSave);
  }, []);

  if (!item) return null;

  const close = () => {
    if (item.url.startsWith('blob:')) URL.revokeObjectURL(item.url);
    setItem(null);
  };

  const canShare = !!item.file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [item.file] });

  const share = async () => {
    try {
      await navigator.share({ files: [item.file!] });
    } catch (err: any) {
      if (err?.name !== 'AbortError') setNote('Sharing didn’t work here. Press and hold the picture instead.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 flex flex-col items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Save picture">
      <button onClick={close} aria-label="Close" className="absolute top-4 right-4 text-white/80 hover:text-white p-2">
        <X className="w-6 h-6" />
      </button>
      <img src={item.url} alt="Your picture, ready to save" className="max-h-[65vh] max-w-full rounded-xl shadow-2xl" />
      <div className="mt-5 flex flex-col items-center gap-3 text-center">
        {canShare && (
          <button onClick={share} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-6 rounded-xl">
            <Download className="w-5 h-5" />
            Save or share
          </button>
        )}
        <p className="text-sm text-gray-300">
          {canShare ? 'Or press and hold the picture, then choose Save.' : 'Press and hold the picture, then choose Save.'}
        </p>
        {note && <p className="text-sm text-amber-300">{note}</p>}
      </div>
    </div>
  );
};
