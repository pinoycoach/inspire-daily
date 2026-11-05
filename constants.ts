import { Persona, Post } from './types';
import { avatarFor } from './shared/avatar';

export const PERSONAS: Persona[] = [
  {
    id: 'stoic-sage',
    name: 'The Stoic Sage',
    description: 'Ancient wisdom for modern problems. Focuses on resilience, virtue, and inner peace.',
    avatar: avatarFor('The Stoic Sage'),
    promptFragment: 'You are The Stoic Sage, channeling the wisdom of figures like Marcus Aurelius and Seneca. Your tone is calm, profound, and reflective. Your post should connect the provided image to a timeless principle of stoicism, such as controlling one\\\'s perceptions, accepting what we cannot change, or living a virtuous life. The message should be empowering and grounding.',
    category: 'philosopher',
  },
  {
    id: 'visionary-innovator',
    name: 'The Visionary',
    description: 'Thinks differently. Speaks about innovation, passion, and shaping the future.',
    avatar: avatarFor('The Visionary'),
    promptFragment: 'You are The Visionary, embodying the spirit of innovators like Steve Jobs or Elon Musk. Your tone is passionate, bold, and forward-thinking. Your post should use the image as a metaphor for innovation, creativity, or challenging the status quo. Frame it as a call to action to "think different" or build a better future. The message should be inspiring and ambitious.',
    category: 'visionary',
  },
  {
      id: 'fearless-leader',
      name: 'The Fearless Leader',
      description: 'Inspires action and courage. Speaks of overcoming adversity and fighting for a cause.',
      avatar: avatarFor('Fearless Leader'),
      promptFragment: 'You are The Fearless Leader, echoing the courage of figures like Harriet Tubman or MLK Jr. Your tone is powerful, determined, and deeply empathetic. Your post should interpret the image as a symbol of struggle, perseverance, or liberation. The message should be a powerful call to find courage, stand for justice, and overcome obstacles.',
      category: 'leader',
  },
  {
      id: 'mystic-poet',
      name: 'The Mystic Poet',
      description: 'Finds the soul in everything. Speaks of love, connection, and the beauty of the universe.',
      avatar: avatarFor('Mystic Poet'),
      promptFragment: 'You are The Mystic Poet, in the vein of Rumi or Hafiz. Your tone is lyrical, spiritual, and full of heart. Your post should look beyond the surface of the image to find a deeper, universal truth about love, life, or the human spirit. The language should be beautiful, evocative, and emotionally resonant.',
      category: 'artist',
  },
  {
    id: 'head-coach',
    name: 'The Head Coach',
    description: 'Pure, unfiltered motivation. Focuses on teamwork, discipline, and pushing your limits.',
    avatar: avatarFor('Head Coach'),
    promptFragment: 'You are The Head Coach, the ultimate motivator. Your tone is energetic, direct, and encouraging, like a coach giving a halftime speech. Your post should use the image to deliver a straightforward message about discipline, teamwork, or giving 110%. It should be a gut check, designed to fire people up and get them ready to win their day.',
    category: 'original',
  },
  {
    id: 'wise-grandma',
    name: 'Wise Grandma',
    description: 'Dispenses timeless, homespun wisdom with love and a warm heart.',
    avatar: avatarFor('Wise Grandma'),
    promptFragment: 'You are Wise Grandma, full of love, warmth, and practical, heartfelt advice. Your tone is gentle, nurturing, and comforting. You see the simple life lessons in the image. Your post should feel like a warm hug, offering simple, profound wisdom about kindness, patience, or the importance of family and friends.',
    category: 'original',
  }
];

export const EXAMPLE_PROMPTS: string[] = [
    "A lone hiker watching the sunrise from a mountain peak",
    "A majestic old tree with deep roots in a green field",
    "A team of rowers working in perfect synchrony",
    "A single candle flame burning brightly in the dark",
    "A photorealistic image of a majestic lion, embodying courage",
    "A child planting a small seedling in a garden",
];

export const INITIAL_POSTS: Post[] = [
  {
    id: 'post-1',
    platform: 'Instagram',
    username: 'The Stoic Sage',
    handle: '@stoicsage',
    avatar: avatarFor('The Stoic Sage'),
    content: '“You have power over your mind - not outside events. Realize this, and you will find strength.”\n\nEvery sunrise reminds us that dawn always breaks after the darkest hour. Step into today with unshakable inner stillness.\n\n#Stoicism #Mindset #InnerPeace #Perspective #MorningRoutine',
    captionAngles: [
      {
        angle: 'inspirational',
        title: 'Inspirational',
        content: '“You have power over your mind - not outside events. Realize this, and you will find strength.”\n\nEvery sunrise reminds us that dawn always breaks after the darkest hour. Step into today with unshakable inner stillness.',
        hashtags: ['#Stoicism', '#Mindset', '#InnerPeace', '#Perspective', '#MorningRoutine']
      },
      {
        angle: 'question',
        title: 'Question-Based',
        content: 'When was the last time you paused at the summit of a hard week just to breathe and appreciate how far you\'ve climbed?\n\nWhat is one challenge you conquered recently that once felt impossible?',
        hashtags: ['#QuestionOfTheDay', '#SelfReflection', '#GrowthMindset', '#ClimbingHigher', '#Community']
      },
      {
        angle: 'informative',
        title: 'Informative',
        content: '3 Stoic rules for high-stress days:\n1. The Dichotomy of Control: Focus exclusively on your actions, not outcomes.\n2. Amor Fati: Don\'t just tolerate obstacles, learn to use them as fuel.\n3. Voluntary Discomfort: Resilience is a muscle that shrinks in pure comfort.',
        hashtags: ['#StoicWisdom', '#PersonalDevelopment', '#ProductivityHacks', '#Leadership', '#MindsetShift']
      },
      {
        angle: 'humorous',
        title: 'Humorous',
        content: 'Me hiking up 4,000 feet at 5 AM just to stare into the distance like a dramatic movie character who has their entire life figured out (my legs are currently jelly). 😂🥾',
        hashtags: ['#HikersOfInstagram', '#ExpectationVsReality', '#RelatablePost', '#LegDay', '#WeekendVibes']
      },
      {
        angle: 'cta',
        title: 'Call to Action',
        content: 'Bookmark this visual for the next morning you wake up feeling overwhelmed. Share it with someone who is currently climbing their own mountain right now. You\'ve got this! 🏔️✨',
        hashtags: ['#SaveThisPost', '#ShareTheInspiration', '#TagAFriend', '#DailyEncouragement', '#StayStrong']
      }
    ],
    activeAngle: 'inspirational',
    imageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=80',
    prompt: 'A lone hiker watching the sunrise from a mountain peak',
    likes: 14200,
    comments: 890,
    shares: 3240,
  },
  {
    id: 'post-2',
    platform: 'LinkedIn',
    username: 'The Visionary',
    handle: '@visionaryleader',
    avatar: avatarFor('The Visionary'),
    content: 'Leadership is not about knowing every answer before you start; it’s about having the conviction to take the first step when the map hasn’t been drawn yet.\n\nGreat breakthroughs rarely happen inside comfort zones. Keep building what doesn’t exist yet.\n\n#Leadership #Innovation #Entrepreneurship #FutureOfWork #Startups',
    captionAngles: [
      {
        angle: 'inspirational',
        title: 'Inspirational',
        content: 'Leadership is not about knowing every answer before you start; it’s about having the conviction to take the first step when the map hasn’t been drawn yet.\n\nGreat breakthroughs rarely happen inside comfort zones. Keep building what doesn’t exist yet.',
        hashtags: ['#Leadership', '#Innovation', '#Entrepreneurship', '#FutureOfWork', '#Startups']
      },
      {
        angle: 'question',
        title: 'Question-Based',
        content: 'If you had zero fear of failure, what is the single boldest initiative you would launch at your company next quarter?\n\nCurious to hear from founders and leaders: what bold bets paid off most for your team?',
        hashtags: ['#LeadershipDiscussion', '#Strategy', '#BoldMoves', '#InnovationCulture', '#AskLinkedIn']
      },
      {
        angle: 'informative',
        title: 'Informative',
        content: 'How top innovators de-risk unchartered ideas in 3 steps:\n• Rapid Prototyping: Build low-fidelity proof-of-concepts in days, not quarters.\n• Direct Customer Feedback: Test assumptions with actual users before scaling.\n• Asymmetric Upside: Bound your downside while preserving unlimited upside.',
        hashtags: ['#ProductManagement', '#TechLeadership', '#BusinessStrategy', '#AgileMindset', '#Frameworks']
      },
      {
        angle: 'humorous',
        title: 'Humorous',
        content: 'Nothing tests your visionary resolve quite like having your entire pitch deck ready, only to realize the conference room HDMI adapter doesn\'t fit your laptop. 😅☕ Innovation never said it would be easy.',
        hashtags: ['#StartupLife', '#OfficeHumor', '#TechFail', '#FounderStory', '#CorporateLife']
      },
      {
        angle: 'cta',
        title: 'Call to Action',
        content: 'Are you building something groundbreaking? Repost this to empower your network, and leave a comment below sharing what project you\'re most excited about this month! Let\'s connect and collaborate. 🤝',
        hashtags: ['#Networking', '#ConnectWithMe', '#Repost', '#InnovationHub', '#Collaborate']
      }
    ],
    activeAngle: 'inspirational',
    imageUrl: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1000&q=80',
    prompt: 'A futuristic workshop of bold innovators solving big challenges',
    likes: 28540,
    comments: 1420,
    shares: 5120,
  },
  {
    id: 'post-3',
    platform: 'Threads',
    username: 'The Mystic Poet',
    handle: '@mysticpoet',
    avatar: avatarFor('Mystic Poet'),
    content: 'The wound is where the light enters you. Do not fear your valleys, for they carve the depth from which your rivers of compassion will flow. ✨🌿\n\n#Poetry #SoulWisdom #Mindfulness #Healing #SpiritualJourney',
    captionAngles: [
      {
        angle: 'inspirational',
        title: 'Inspirational',
        content: 'The wound is where the light enters you. Do not fear your valleys, for they carve the depth from which your rivers of compassion will flow. ✨🌿',
        hashtags: ['#Poetry', '#SoulWisdom', '#Mindfulness', '#Healing', '#SpiritualJourney']
      },
      {
        angle: 'question',
        title: 'Question-Based',
        content: 'When did silence last give you an answer that noise never could? What is your soul craving more of right now?',
        hashtags: ['#DeepQuestions', '#MindfulLiving', '#Stillness', '#SelfDiscovery', '#ThreadsTalk']
      },
      {
        angle: 'informative',
        title: 'Informative',
        content: 'The psychological practice of "forest bathing" (Shinrin-yoku):\nSpending just 20 minutes immersed in nature significantly reduces salivary cortisol, stabilizes blood pressure, and resets attention fatigue. Ancient poetry meets modern neuroscience.',
        hashtags: ['#NatureTherapy', '#MentalHealth', '#Neuroscience', '#WellnessTips', '#ScienceAndArt']
      },
      {
        angle: 'humorous',
        title: 'Humorous',
        content: 'Walked into the forest seeking deep spiritual enlightenment and transcendental peace... ended up arguing with a suspicious squirrel about who owns the pinecone. 🐿️🌲',
        hashtags: ['#NatureHumor', '#Relatable', '#SpiritualHumor', '#DailyVibe', '#PlotTwist']
      },
      {
        angle: 'cta',
        title: 'Call to Action',
        content: 'Take one deep breath before you scroll any further. If this brought you even 5 seconds of calm, send this to someone you care about today. 🍃💚',
        hashtags: ['#PauseAndBreathe', '#SharePeace', '#SpreadKindness', '#DailyCalm', '#ThreadsCommunity']
      }
    ],
    activeAngle: 'inspirational',
    imageUrl: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1000&q=80',
    prompt: 'Golden rays filtering through ancient mossy trees in a tranquil forest',
    likes: 9800,
    comments: 420,
    shares: 1350,
  },
  {
    id: 'post-4',
    platform: 'Facebook',
    username: 'Wise Grandma',
    handle: '@wisegrandma',
    avatar: avatarFor('Wise Grandma'),
    content: 'Remember honey, you don’t need to rush what is meant to grow. Roots take time in quiet soil before branches reach the sun. Be gentle with your heart today, drink some warm tea, and call someone you love. ❤️\n\n#GrandmaWisdom #FamilyFirst #SlowDown #WarmHeart #HeartfeltMoments',
    captionAngles: [
      {
        angle: 'inspirational',
        title: 'Inspirational',
        content: 'Remember honey, you don’t need to rush what is meant to grow. Roots take time in quiet soil before branches reach the sun. Be gentle with your heart today, drink some warm tea, and call someone you love. ❤️',
        hashtags: ['#GrandmaWisdom', '#FamilyFirst', '#SlowDown', '#WarmHeart', '#HeartfeltMoments']
      },
      {
        angle: 'question',
        title: 'Question-Based',
        content: 'What is the best piece of advice your grandparents or parents ever gave you that you still carry in your heart today? Tell me below, I would love to read them all! 🥰👇',
        hashtags: ['#LifeLessons', '#Memories', '#Generations', '#Heartwarming', '#FamilyStories']
      },
      {
        angle: 'informative',
        title: 'Informative',
        content: '3 gentle reminders for a peaceful week:\n1. Doing your best looks different on every single day.\n2. Comparison is a thief that steals today\'s joy.\n3. The smallest kind gesture to a neighbor can turn their whole world around.',
        hashtags: ['#FriendlyAdvice', '#MentalWellness', '#PeacefulLiving', '#DailyReminders', '#KindnessCounts']
      },
      {
        angle: 'humorous',
        title: 'Humorous',
        content: 'My doctor told me to reduce stress and get outdoors, so I sat on the porch with a plate of fresh cookies. Balance is key, darlings! 🍪👵',
        hashtags: ['#GrandmaHumor', '#CookieTime', '#StressFree', '#LaughterIsMedicine', '#SweetMoments']
      },
      {
        angle: 'cta',
        title: 'Call to Action',
        content: 'Share this with your loved ones to brighten their day, and don\'t forget to give someone a warm hug today! Love you all dearly! 💕👵',
        hashtags: ['#ShareTheLove', '#BrightenSomeonesDay', '#SpreadJoy', '#WarmHugs', '#FamilyLove']
      }
    ],
    activeAngle: 'inspirational',
    imageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=80',
    prompt: 'A serene mountain valley bathed in warm evening sunlight',
    likes: 31200,
    comments: 2650,
    shares: 8900,
  }
];