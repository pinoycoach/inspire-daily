import React, { useState } from 'react';

interface PrivacyViewProps {
  onBack: () => void;
  onDeleteMyData: () => Promise<void>;
}

// Plain-language privacy notice and terms, plus "delete my data".
export const PrivacyView: React.FC<PrivacyViewProps> = ({ onBack, onDeleteMyData }) => {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await onDeleteMyData();
    } catch (e: any) {
      setError(e.message || 'Could not delete your data. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 text-sm text-gray-300 leading-relaxed">
      <button onClick={onBack} className="text-indigo-400 hover:text-indigo-300 font-semibold">
        ← Back
      </button>
      <h1 className="text-2xl font-bold text-white">Privacy &amp; Terms</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">What we keep</h2>
        <p>
          Your browser gets a random, anonymous ID so the app can remember your posts and settings. If you sign in with Google, we
          keep your name and email address (nothing else from your Google account) to recognise you on every device and,
          during the invite-only beta, to know who invited whom. With that ID we store:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>your brand settings;</li>
          <li>posts you publish, including their images;</li>
          <li>custom personas you create;</li>
          <li>your invite codes and whether they've been used.</li>
        </ul>
        <p>
          If you join the waitlist, we keep that email address only to send you an invite.
        </p>
        <p>
          Your prompts and images are sent to Google's Gemini models to create the pictures and captions. We use daily
          usage counts to keep the free service fair. We don't sell your data or show ads.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">AI-generated content</h2>
        <p>
          Images and captions are made by AI and can be wrong, odd or unoriginal. Quotes are attributed to their
          authors with a modern reading; check them before you rely on them. Review everything before you post it, and
          don't use Inspire Daily to create content that is harmful, misleading or that infringes someone else's rights.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">Fair use</h2>
        <p>
          Inspire Daily is free during this preview, with daily limits on images and posts. Features may change. The service
          is provided as is.
        </p>
      </section>

      <section className="space-y-3 p-4 rounded-xl bg-gray-800 border border-gray-700">
        <h2 className="text-lg font-semibold text-white">Delete my data</h2>
        <p>
          This permanently deletes your settings, saved posts, their images and your personas from our
          servers, and unlinks your Google account. You'll start fresh. During the invite-only beta you'd need a new
          invite to come back.
        </p>
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-lg"
          >
            Delete my data
          </button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Yes, delete everything'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg"
            >
              Cancel
            </button>
          </div>
        )}
        {error && <p className="text-red-300">{error}</p>}
      </section>
    </div>
  );
};
