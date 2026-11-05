import { apiFetch } from './apiFetch';
import { listMyPersonas, createMyPersona } from './inspireApi';
import { Post, Platform, Persona, CaptionAngle, CaptionAngleType } from '../types';

// --- Persona Service Functions (saved on the server, per anonymous user) ---

export type NewPersonaData = Omit<Persona, 'id' | 'avatar' | 'category'>;

export const getCustomPersonas = async (): Promise<Persona[]> => listMyPersonas();

export const createPersona = async (personaData: NewPersonaData): Promise<Persona> => createMyPersona(personaData);


// --- Gemini Service Functions ---

const generateRandomMetrics = () => ({
  likes: 0,
  comments: 0,
  shares: 0,
});

function ensureAllCaptionAngles(
  primaryContent: string,
  angles: any[] | undefined,
  persona: Persona,
  platform: Platform
): CaptionAngle[] {
  const angleKeys: CaptionAngleType[] = ['inspirational', 'question', 'informative', 'humorous', 'cta'];
  const titles: Record<CaptionAngleType, string> = {
    inspirational: 'Inspirational',
    question: 'Question-Based',
    informative: 'Informative',
    humorous: 'Humorous',
    cta: 'Call to Action',
  };

  const existingMap = new Map<string, CaptionAngle>();
  if (Array.isArray(angles)) {
    for (const a of angles) {
      if (a && a.angle && a.content) {
        const key = a.angle.toLowerCase();
        existingMap.set(key, {
          angle: key as CaptionAngleType,
          title: a.title || titles[key as CaptionAngleType] || a.angle,
          content: a.content,
          hashtags: Array.isArray(a.hashtags) && a.hashtags.length > 0 
            ? a.hashtags.map((h: string) => h.startsWith('#') ? h : `#${h}`)
            : ['#Inspiration', '#Mindset', `#${platform}`],
        });
      }
    }
  }

  return angleKeys.map((key) => {
    if (existingMap.has(key)) {
      return existingMap.get(key)!;
    }
    if (key === 'inspirational') {
      return {
        angle: 'inspirational',
        title: 'Inspirational',
        content: primaryContent,
        hashtags: ['#Inspiration', '#Mindset', '#Wisdom', `#${platform}`],
      };
    }
    if (key === 'question') {
      return {
        angle: 'question',
        title: 'Question-Based',
        content: `What is the biggest lesson this view holds for you? When was the last time you stepped back to see the bigger picture?\n\nDrop your thoughts below 👇`,
        hashtags: ['#QuestionOfTheDay', '#Reflection', '#Mindset', `#${platform}`],
      };
    }
    if (key === 'informative') {
      return {
        angle: 'informative',
        title: 'Informative',
        content: `Key insights from this visual:\n1. Perspective shapes every decision.\n2. Small daily habits create monumental shifts over time.\n3. Stillness is often where the best clarity is found.`,
        hashtags: ['#Insights', '#DailyWisdom', '#Clarity', `#${platform}`],
      };
    }
    if (key === 'humorous') {
      return {
        angle: 'humorous',
        title: 'Humorous',
        content: `Me pretending to have everything 100% figured out while soaking in the majestic scenery (hoping there's coffee nearby). ☕😅`,
        hashtags: ['#Relatable', '#DailyHumor', '#Vibes', `#${platform}`],
      };
    }
    return {
      angle: 'cta',
      title: 'Call to Action',
      content: `Save this post as a reminder for whenever you need a mental reset. Tag a friend who could use this energy today! 🚀`,
      hashtags: ['#SaveForLater', '#ShareTheInspiration', '#Community', `#${platform}`],
    };
  });
}

// All AI calls go to this app's own server, which holds the key (or uses Vertex AI).
const postJson = async <T,>(url: string, body: unknown, fallback: string): Promise<T> => {
  const res = await apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `${fallback} (status ${res.status})`);
  }
  return res.json();
};

export interface ServerConfig {
  aiMode: 'vertex' | 'api-key';
  locked: boolean;
}

export const getServerConfig = async (): Promise<ServerConfig | null> => {
  try {
    const res = await fetch('/api/config');
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
};

export const generateImageFromPrompt = async (prompt: string): Promise<string> => {
  const data = await postJson<{ image: string }>('/api/generate-image', { prompt }, 'Failed to generate an image');
  return data.image;
};

type PostDetails = Omit<Post, 'id' | 'imageUrl' | 'prompt'>;

const toPost = (parsed: any, persona: Persona, platform: Platform): PostDetails => {
  const primaryContent = parsed?.content || 'Keep moving forward and stay inspired.';
  const captionAngles = ensureAllCaptionAngles(primaryContent, parsed?.captionAngles, persona, platform);
  // The first angle's full text (content + hashtags) is what the post shows first.
  const initialAngle = captionAngles[0];
  const initialFullContent = initialAngle ? `${initialAngle.content}\n\n${initialAngle.hashtags.join(' ')}` : primaryContent;
  return {
    platform,
    username: parsed?.username || persona.name,
    handle: parsed?.handle || `@${persona.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    avatar: persona.avatar, // the persona's own badge, never a picture address the AI made up
    content: initialFullContent,
    captionAngles,
    activeAngle: 'inspirational',
    ...generateRandomMetrics(),
  };
};

const personaForServer = (persona: Persona) => ({
  name: persona.name,
  promptFragment: persona.promptFragment,
  avatar: persona.avatar,
});

export const generateInspirationalPost = async (
  mediaPrompt: string,
  mediaType: 'image',
  persona: Persona,
  platform: Platform,
  inspirationLevel: number
): Promise<PostDetails> => {
  const parsed = await postJson<any>(
    '/api/generate-post',
    { mode: 'prompt', mediaPrompt, mediaType, persona: personaForServer(persona), platform, inspirationLevel },
    'Failed to write the captions'
  );
  return toPost(parsed, persona, platform);
};

export const generateInspirationalPostForUpload = async (
  imageData: string,
  persona: Persona,
  platform: Platform,
  inspirationLevel: number
): Promise<PostDetails> => {
  const image = imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`;
  const parsed = await postJson<any>(
    '/api/generate-post',
    { mode: 'upload', image, persona: personaForServer(persona), platform, inspirationLevel },
    'Failed to write the captions'
  );
  return toPost(parsed, persona, platform);
};
