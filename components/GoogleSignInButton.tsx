import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    google?: any;
  }
}

let gsiPromise: Promise<void> | null = null;
/** Loads Google's sign-in script once. */
const loadGsi = () => {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gsiPromise) {
    gsiPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        gsiPromise = null;
        reject(new Error('Could not load Google sign-in.'));
      };
      document.head.appendChild(s);
    });
  }
  return gsiPromise;
};

interface Props {
  clientId: string;
  onCredential: (credential: string) => void;
}

// Google's own "Sign in with Google" button. We only receive Google's signed token; the server checks it.
export const GoogleSignInButton: React.FC<Props> = ({ clientId, onCredential }) => {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGsi()
      .then(() => {
        if (cancelled || !ref.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (r: { credential?: string }) => r.credential && cb.current(r.credential),
        });
        window.google.accounts.id.renderButton(ref.current, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with' });
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <div>
      <div ref={ref} className="flex justify-center min-h-[44px]" />
      {error && <p className="text-sm text-red-300 mt-2">{error}</p>}
    </div>
  );
};
