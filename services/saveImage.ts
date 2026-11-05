// Saving pictures in a way phones understand. Desktop browsers download the file directly. Phones
// mostly ignore the "download" link trick (and never allow it for pictures from other websites),
// so on a phone we show the picture in a sheet with a Share/Save button and "press and hold to save".

export const SAVE_IMAGE_EVENT = 'inspire:save-image';

export interface SaveImageDetail {
  /** A blob: URL we made (revoke when done), or the original address if we couldn't copy the picture. */
  url: string;
  filename: string;
  file?: File;
}

const isPhone = () => {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
};

// data: URLs are decoded by hand: the page's security policy doesn't allow fetching them.
const dataUrlToBlob = (dataUrl: string) => {
  const [head, body] = dataUrl.split(',', 2);
  const type = /data:([^;]+)/.exec(head)?.[1] || 'image/png';
  const bytes = atob(body);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type });
};

const toBlob = async (source: Blob | string): Promise<Blob | null> => {
  if (source instanceof Blob) return source;
  if (source.startsWith('data:')) return dataUrlToBlob(source);
  try {
    const res = await fetch(source, { mode: 'cors' });
    return res.ok ? await res.blob() : null;
  } catch {
    return null; // another website that doesn't allow copying its pictures
  }
};

/** Saves a picture: a direct download on desktop, the save sheet on a phone. */
export async function saveImage(source: Blob | string, filename: string): Promise<void> {
  const blob = await toBlob(source);
  if (!blob) {
    // Can't copy it: show it, so it can still be saved by hand.
    if (isPhone()) window.dispatchEvent(new CustomEvent<SaveImageDetail>(SAVE_IMAGE_EVENT, { detail: { url: String(source), filename } }));
    else window.open(String(source), '_blank', 'noopener');
    return;
  }
  const url = URL.createObjectURL(blob);
  if (isPhone()) {
    const file = new File([blob], filename, { type: blob.type || 'image/png' });
    window.dispatchEvent(new CustomEvent<SaveImageDetail>(SAVE_IMAGE_EVENT, { detail: { url, filename, file } }));
    return;
  }
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Canvas → PNG blob (throws if the canvas can't be read). */
export const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the picture.'))), 'image/png'));
