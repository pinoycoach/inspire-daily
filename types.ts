
export type Platform = 'Twitter' | 'Instagram' | 'Facebook' | 'LinkedIn' | 'TikTok' | 'Threads';

export type CaptionAngleType = 'inspirational' | 'question' | 'informative' | 'humorous' | 'cta';

export interface CaptionAngle {
  angle: CaptionAngleType;
  title: string;
  content: string;
  hashtags: string[];
}

export interface Post {
  id: string;
  platform: Platform;
  avatar: string;
  username: string;
  handle: string;
  content: string;
  captionAngles?: CaptionAngle[];
  activeAngle?: CaptionAngleType;
  imageUrl?: string;
  prompt?: string;
  likes: number;
  comments: number;
  shares: number;
}

export interface Persona {
  id: string | number;
  name: string;
  description: string;
  avatar: string;
  promptFragment: string;
  category: 'original' | 'philosopher' | 'visionary' | 'leader' | 'artist' | 'custom';
}

export interface UserBrandSettings {
  isPro: boolean;
  brandName: string;
  brandHandle: string;
  removeWatermark: boolean;
  aspectRatio: 'feed' | 'story' | 'square';
}
