export interface TimelessQuote {
  id: string;
  author: string;
  era: 'Ancient Stoics & Romans' | 'Eastern Philosophy' | 'Enlightenment & Literature' | 'Trailblazers & Leaders' | 'Modern Innovators';
  category: 'Resilience' | 'Leadership' | 'Focus & Stillness' | 'Creativity' | 'Courage';
  originalQuote: string;
  modernizedQuote: string;
  context: string;
  suggestedPrompt: string;
}

export const QUOTES_DATABASE: TimelessQuote[] = [
  {
    id: 'q-1',
    author: 'Marcus Aurelius (121–180 AD)',
    era: 'Ancient Stoics & Romans',
    category: 'Resilience',
    originalQuote: 'The impediment to action advances action. What stands in the way becomes the way.',
    modernizedQuote: 'The obstacle isn’t blocking the road; the obstacle IS the road. Turn your setbacks into your strategy.',
    context: 'Roman Emperor & Stoic Philosopher, Meditations',
    suggestedPrompt: 'A rugged climber ascending a sheer rock face at golden hour, path carved through stone'
  },
  {
    id: 'q-2',
    author: 'Seneca (4 BC–65 AD)',
    era: 'Ancient Stoics & Romans',
    category: 'Focus & Stillness',
    originalQuote: 'We suffer more often in imagination than in reality.',
    modernizedQuote: '90% of the battles you are stressing about only exist in your head. Protect your peace and focus on what is real right now.',
    context: 'Roman Stoic philosopher & statesman, Letters from a Stoic',
    suggestedPrompt: 'A tranquil glass-like alpine lake reflecting clear morning skies in serene stillness'
  },
  {
    id: 'q-3',
    author: 'Epictetus (50–135 AD)',
    era: 'Ancient Stoics & Romans',
    category: 'Resilience',
    originalQuote: 'Men are disturbed not by the things which happen, but by the opinions about the things.',
    modernizedQuote: 'You can\'t control the weather or the market, but you have 100% control over your response and your next move.',
    context: 'Greek Stoic philosopher, Enchiridion 5 (trans. George Long, 1877)',
    suggestedPrompt: 'A majestic ancient oak tree standing tall against swirling ocean winds and waves'
  },
  {
    id: 'q-4',
    author: 'Lao Tzu (6th Century BC)',
    era: 'Eastern Philosophy',
    category: 'Leadership',
    originalQuote: 'A leader is best when people barely know he exists; when his work is done, his aim fulfilled, they will say: we did it ourselves.',
    modernizedQuote: 'True leadership isn\'t about the spotlight; it\'s about creating the conditions where your team feels invincible and owns the victory.',
    context: 'Taoist master & author of the Tao Te Ching',
    suggestedPrompt: 'A team of expedition guides helping each other cross a mist-covered rope bridge in dawn light'
  },
  {
    id: 'q-5',
    author: 'Sun Tzu (544–496 BC)',
    era: 'Eastern Philosophy',
    category: 'Leadership',
    originalQuote: 'To secure ourselves against defeat lies in our own hands, but the opportunity of defeating the enemy is provided by the enemy himself.',
    modernizedQuote: 'Your preparation is fully yours to control. The opening comes later — your job is to be ready when it does.',
    context: 'Military strategist, The Art of War, ch. 4 (trans. Lionel Giles, 1910)',
    suggestedPrompt: 'A lone chess piece made of solid crystal standing steady amidst whirling gold dust'
  },
  {
    id: 'q-6',
    author: 'Rumi (1207–1273)',
    era: 'Eastern Philosophy',
    category: 'Creativity',
    originalQuote: 'Do not be satisfied with the stories that come before you. Unfold your own myth.',
    modernizedQuote: 'Stop re-living everyone else\'s template. Write the story only you were built to tell.',
    context: 'Persian poet and mystic scholar',
    suggestedPrompt: 'An artist painting a glowing celestial aurora on an open outdoor canvas in the highlands'
  },
  {
    id: 'q-7',
    author: 'Leonardo da Vinci (1452–1519)',
    era: 'Enlightenment & Literature',
    category: 'Creativity',
    originalQuote: 'Iron rusts from disuse; stagnant water loses its purity and in cold weather becomes frozen; even so does inaction sap the vigour of the mind.',
    modernizedQuote: 'Skills fade when they sit unused. Make one small thing today and keep your mind moving.',
    context: 'Renaissance polymath, from his notebooks (Codex Atlanticus)',
    suggestedPrompt: 'Minimalist architectural design with sunlight casting precise geometric shadows on marble'
  },
  {
    id: 'q-8',
    author: 'John Anster, after Goethe’s Faust (1835)',
    era: 'Enlightenment & Literature',
    category: 'Courage',
    originalQuote: 'Whatever you can do, or dream you can, begin it. Boldness has genius, power, and magic in it.',
    modernizedQuote: 'Stop waiting for perfect conditions. Start before you are completely ready — momentum creates its own clarity.',
    context: 'A loose English rendering of Faust, made popular by W. H. Murray (1951). Not Goethe’s own words.',
    suggestedPrompt: 'A spacecraft breaking through atmospheric clouds into star-filled deep space'
  },
  {
    id: 'q-9',
    author: 'Harriet Tubman (1822–1913)',
    era: 'Trailblazers & Leaders',
    category: 'Courage',
    originalQuote: 'There was one of two things I had a right to, liberty, or death; if I could not have one, I would have the other; for no man should take me alive.',
    modernizedQuote: 'Decide what you refuse to live without, and let that decision carry you through the fear. Keep your eyes on the North Star.',
    context: 'As told to Sarah Bradford, Scenes in the Life of Harriet Tubman (1869), spelling modernised',
    suggestedPrompt: 'A lone lantern glowing on a dark woodland trail beneath the luminous North Star'
  },
  {
    id: 'q-10',
    author: 'Theodore Roosevelt (1858–1919)',
    era: 'Trailblazers & Leaders',
    category: 'Resilience',
    originalQuote: 'It is not the critic who counts... The credit belongs to the man who is actually in the arena, whose face is marred by dust and sweat and blood.',
    modernizedQuote: 'Never take criticism from someone sitting in the cheap seats. Honor belongs to the one daring greatly in the arena.',
    context: 'Citizenship in a Republic speech (The Man in the Arena)',
    suggestedPrompt: 'An athlete catching their breath after an intense workout as dawn breaks over the stadium'
  },
  {
    id: 'q-11',
    author: 'Apple’s “Think Different” ad (1997)',
    era: 'Modern Innovators',
    category: 'Creativity',
    originalQuote: 'The people who are crazy enough to think they can change the world are the ones who do.',
    modernizedQuote: 'If your ambition doesn\'t sound a little crazy to the average spectator, it probably isn\'t big enough.',
    context: 'Written by the TBWA\\Chiat\\Day team (Rob Siltanen, Ken Segall and others). Steve Jobs championed the ad but didn’t write the line.',
    suggestedPrompt: 'A futuristic design studio with glowing holographic prototypes in deep midnight blue'
  },
  {
    id: 'q-12',
    author: 'Maya Angelou (1928–2014)',
    era: 'Trailblazers & Leaders',
    category: 'Courage',
    originalQuote: 'You may encounter many defeats, but you must not be defeated. In fact, it may be necessary to encounter the defeats, so you can know who you are.',
    modernizedQuote: 'Losing a round is not losing your story. Every failure is just tuition for the character you are becoming.',
    context: 'Poet, memoirist, and civil rights icon',
    suggestedPrompt: 'A single golden blossom blooming through a crack in a weathered granite boulder'
  }
];
