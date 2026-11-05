import { Post, UserBrandSettings } from '../types';
import { saveImage, canvasToBlob } from './saveImage';

/**
 * Loads an image into an HTMLImageElement safely.
 * If external, tries crossOrigin = 'anonymous'.
 * If that fails, falls back to using it as-is or placeholder.
 */
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    // No retry without crossOrigin: a picture loaded that way locks the canvas and the save fails.
    // Callers skip a picture that can't load.
    img.onerror = (e) => reject(e);
    img.src = src;
  });
};

/**
 * Helper to wrap text onto canvas lines
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (para.trim() === '') {
      lines.push('');
      continue;
    }
    const words = para.split(' ');
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

/**
 * Draws rounded rectangle
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export type GraphicStyle = 'card' | 'quote_on_photo';

/**
 * Generates and downloads a high-resolution PNG image combining the post text and photo.
 */
export async function downloadPostGraphic(
  post: Post, 
  style: GraphicStyle = 'card',
  brandSettings?: UserBrandSettings
): Promise<void> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  // Determine brand watermark
  const showWatermark = !brandSettings?.removeWatermark;
  const watermarkLabel = brandSettings?.brandName?.trim() || 'Inspire Daily';

  // High-res social post canvas dimensions (1080 x 1350 for portrait feed, or dynamic height)
  const width = 1080;
  
  // Pre-load photo if available
  let photoImg: HTMLImageElement | null = null;
  if (post.imageUrl) {
    try {
      photoImg = await loadImage(post.imageUrl);
    } catch (e) {
      console.warn('Could not load photo directly for canvas, continuing with fallback:', e);
    }
  }

  // Pre-load avatar if available
  let avatarImg: HTMLImageElement | null = null;
  if (post.avatar) {
    try {
      avatarImg = await loadImage(post.avatar);
    } catch (e) {
      console.warn('Could not load avatar for canvas:', e);
    }
  }

  if (style === 'quote_on_photo' && photoImg) {
    // STYLE 1: Full-bleed photo with quote overlay scrim (Instagram Story / Visual Quote style)
    const height = 1350; // standard 4:5 vertical feed
    canvas.width = width;
    canvas.height = height;

    // Draw background photo centered & cropped
    const imgRatio = photoImg.width / photoImg.height;
    const canvasRatio = width / height;
    let sx = 0, sy = 0, sw = photoImg.width, sh = photoImg.height;
    if (imgRatio > canvasRatio) {
      sw = photoImg.height * canvasRatio;
      sx = (photoImg.width - sw) / 2;
    } else {
      sh = photoImg.width / canvasRatio;
      sy = (photoImg.height - sh) / 2;
    }
    ctx.drawImage(photoImg, sx, sy, sw, sh, 0, 0, width, height);

    // Dark gradient overlay for text readability
    const scrim = ctx.createLinearGradient(0, 0, 0, height);
    scrim.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
    scrim.addColorStop(0.4, 'rgba(0, 0, 0, 0.3)');
    scrim.addColorStop(0.7, 'rgba(0, 0, 0, 0.75)');
    scrim.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, width, height);

    // Draw Top Header (Platform & Brand Name)
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText(`${post.platform.toUpperCase()} POST`, 60, 90);

    if (showWatermark) {
      ctx.font = '500 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      const labelWidth = ctx.measureText(watermarkLabel).width;
      ctx.fillText(watermarkLabel, width - labelWidth - 60, 90);
    }

    // Draw Quote Mark
    ctx.font = 'italic bold 90px serif';
    ctx.fillStyle = 'rgba(147, 197, 253, 0.6)';
    ctx.fillText('“', 60, height - 520);

    // Draw Main Quote Text
    ctx.font = 'bold 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 4;

    const lines = wrapText(ctx, post.content, width - 130);
    let textY = height - 460;
    const lineHeight = 58;
    // If lines exceed space, adjust starting position
    const totalTextHeight = lines.length * lineHeight;
    if (totalTextHeight > 380) {
      textY = Math.max(160, height - 180 - totalTextHeight);
    }

    for (const line of lines) {
      ctx.fillText(line, 65, textY);
      textY += lineHeight;
    }

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Draw Author & Avatar Footer
    const footerY = height - 100;
    if (avatarImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(105, footerY, 45, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatarImg, 60, footerY - 45, 90, 90);
      ctx.restore();

      // Border around avatar
      ctx.beginPath();
      ctx.arc(105, footerY, 45, 0, Math.PI * 2);
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(post.username, 175, footerY - 6);

      ctx.font = '400 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#9ca3af';
      ctx.fillText(post.handle, 175, footerY + 28);
    } else {
      ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(post.username, 70, footerY);
    }
  } else {
    // STYLE 2: High-Fidelity Social Card (Avatar, Handle, Post Text, Photo Frame, Stats)
    // First calculate dynamic height based on text and photo
    ctx.font = '400 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const textLines = wrapText(ctx, post.content, width - 140);
    const lineHeight = 52;
    const textBlockHeight = textLines.length * lineHeight;
    
    const photoHeight = photoImg ? 640 : 0;
    const padding = 60;
    const headerHeight = 120;
    const statsHeight = 100;
    const height = padding * 2 + headerHeight + textBlockHeight + (photoHeight ? photoHeight + 40 : 0) + statsHeight;

    canvas.width = width;
    canvas.height = height;

    // Background Gradient (Dark card aesthetic)
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Outer card container outline
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    roundRect(ctx, 24, 24, width - 48, height - 48, 36);
    ctx.stroke();

    // 1. Header: Avatar, Name, Handle, Platform Badge
    const headerY = padding + 20;
    if (avatarImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(padding + 45, headerY + 45, 45, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatarImg, padding, headerY, 90, 90);
      ctx.restore();

      ctx.beginPath();
      ctx.arc(padding + 45, headerY + 45, 45, 0, Math.PI * 2);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    const textLeft = padding + (avatarImg ? 115 : 0);
    ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(post.username, textLeft, headerY + 42);

    ctx.font = '400 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(post.handle, textLeft, headerY + 80);

    // Platform Badge (Right side of header)
    const platformColors: Record<string, string> = {
      Twitter: '#1DA1F2',
      LinkedIn: '#0A66C2',
      Facebook: '#1877F2',
      Threads: '#e2e8f0',
      Instagram: '#e1306c',
      TikTok: '#00f2fe',
    };
    const badgeColor = platformColors[post.platform] || '#6366f1';
    const badgeWidth = ctx.measureText(post.platform).width + 50;
    const badgeX = width - padding - badgeWidth;

    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
    roundRect(ctx, badgeX, headerY + 15, badgeWidth, 54, 27);
    ctx.fill();
    ctx.strokeStyle = badgeColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = badgeColor;
    ctx.fillText(post.platform, badgeX + 25, headerY + 51);

    // 2. Post Caption / Text
    let currentY = headerY + 120 + 20;
    ctx.font = '400 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#f1f5f9';

    for (const line of textLines) {
      if (line) {
        ctx.fillText(line, padding, currentY);
      }
      currentY += lineHeight;
    }

    currentY += 10;

    // 3. Post Image Photo
    if (photoImg) {
      const photoBoxWidth = width - padding * 2;
      const photoBoxHeight = photoHeight;

      ctx.save();
      roundRect(ctx, padding, currentY, photoBoxWidth, photoBoxHeight, 28);
      ctx.clip();

      // Crop & center photo in box
      const pRatio = photoImg.width / photoImg.height;
      const bRatio = photoBoxWidth / photoBoxHeight;
      let sx = 0, sy = 0, sw = photoImg.width, sh = photoImg.height;
      if (pRatio > bRatio) {
        sw = photoImg.height * bRatio;
        sx = (photoImg.width - sw) / 2;
      } else {
        sh = photoImg.width / bRatio;
        sy = (photoImg.height - sh) / 2;
      }

      ctx.drawImage(photoImg, sx, sy, sw, sh, padding, currentY, photoBoxWidth, photoBoxHeight);
      ctx.restore();

      // Border around photo
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      roundRect(ctx, padding, currentY, photoBoxWidth, photoBoxHeight, 28);
      ctx.stroke();

      currentY += photoBoxHeight + 35;
    }

    // 4. Footer: Engagement Metrics + Inspire Daily Badge
    const sepY = currentY + 10;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, sepY);
    ctx.lineTo(width - padding, sepY);
    ctx.stroke();

    const statsY = sepY + 45;
    ctx.font = '500 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`❤️  ${post.likes.toLocaleString()}   💬  ${post.comments.toLocaleString()}   🔁  ${post.shares.toLocaleString()}`, padding, statsY);

    if (showWatermark) {
      ctx.fillStyle = '#64748b';
      ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const labelWidth = ctx.measureText(watermarkLabel).width;
      ctx.fillText(watermarkLabel, width - padding - labelWidth, statsY);
    }
  }

  await saveImage(await canvasToBlob(canvas), `${post.platform.toLowerCase()}-post-${Date.now()}.png`);
}
