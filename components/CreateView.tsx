import React, { useState, useEffect, useRef } from 'react';
import { generateImageFromPrompt, generateInspirationalPost, generateInspirationalPostForUpload, getCustomPersonas, createPersona, NewPersonaData } from '../services/geminiService';
import { Post, Platform, Persona, UserBrandSettings } from '../types';
import { PostCard } from './PostCard';
import { Wand2, RotateCw, Image as ImageIcon, UserSquare, Sparkles, UploadCloud, X, UserPlus, Camera } from './icons/LucideIcons';
import { Twitter, Instagram, Facebook, LinkedIn, TikTok, Threads } from './icons/PlatformIcons';
import { PERSONAS, EXAMPLE_PROMPTS } from '../constants';
import { downloadPostGraphic } from '../services/canvasExportService';

interface CreateViewProps {
  onPostCreated: (post: Post) => void;
  initialPrompt?: string;
  initialQuote?: string;
  brandSettings?: UserBrandSettings;
}

// --- Create Persona Modal Component ---
interface CreatePersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPersonaCreated: (newPersona: Persona) => void;
}

const CreatePersonaModal: React.FC<CreatePersonaModalProps> = ({ isOpen, onClose, onPersonaCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [promptFragment, setPromptFragment] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !description || !promptFragment) {
        setError('All fields are required.');
        return;
    }
    setIsSaving(true);
    setError(null);
    try {
        const newPersonaData: NewPersonaData = { name, description, promptFragment };
        const savedPersona = await createPersona(newPersonaData);
        onPersonaCreated(savedPersona);
        onClose();
        // Reset form for next time
        setName('');
        setDescription('');
        setPromptFragment('');
    } catch (err: any) {
        setError(err.message || 'Failed to save persona.');
    } finally {
        setIsSaving(false);
    }
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center p-4 animate-fade-in-fast" aria-modal="true" role="dialog">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl w-full max-w-2xl transform transition-all relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
          <X />
        </button>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
            <div className="text-center">
                <UserPlus className="w-10 h-10 mx-auto text-indigo-400 mb-2" />
                <h2 className="text-2xl font-bold text-white">Create a New Persona</h2>
                <p className="text-gray-400">Define a unique voice of inspiration for others to use.</p>
            </div>
            <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">Persona Name</label>
                <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., The Patient Gardener" className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 transition" required/>
            </div>
            <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">Short Description</label>
                <input id="description" type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Finds lessons about growth and patience in nature." className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 transition" required/>
            </div>
            <div>
                <label htmlFor="promptFragment" className="block text-sm font-medium text-gray-300 mb-2">Core Persona (The AI Instructions)</label>
                <textarea id="promptFragment" rows={5} value={promptFragment} onChange={(e) => setPromptFragment(e.target.value)} placeholder="You are The Patient Gardener. You speak calmly and find metaphors for personal growth in the natural world. Your tone is nurturing and wise..." className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 transition" required/>
                <p className="text-xs text-gray-500 mt-1">This is the most important part. Be descriptive about the persona's voice, wisdom, and worldview.</p>
            </div>
            {error && <p className="text-red-400 text-center text-sm">{error}</p>}
            <div className="flex justify-end gap-4 pt-2">
                <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg transition">Cancel</button>
                <button type="submit" disabled={isSaving} className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-lg transition disabled:bg-indigo-800 disabled:cursor-not-allowed">
                    {isSaving ? (<><div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>Saving...</>) : (<><Sparkles className="w-5 h-5" /> Save Persona</>)}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};


// --- Main Create View Component ---
const platforms: Platform[] = ['Twitter', 'LinkedIn', 'Instagram', 'Threads', 'Facebook', 'TikTok'];

const loadingMessages = [
    "Gathering inspiration...",
    "Consulting the muses...",
    "Rendering the digital dream...",
    "Polishing the wisdom...",
    "Finding the perfect words...",
    "This is taking a moment, great ideas need patience!",
];

export const CreateView: React.FC<CreateViewProps> = ({ 
  onPostCreated, 
  initialPrompt = '', 
  initialQuote = '',
  brandSettings,
}) => {
  // Your own photo comes first: Daily Three posts are built from the customer's own pictures.
  const [creationMode, setCreationMode] = useState<'generate' | 'upload'>('upload');
  const [prompt, setPrompt] = useState(initialPrompt);
  const [quoteFromVault, setQuoteFromVault] = useState(initialQuote);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(PERSONAS[0]);
  const [platform, setPlatform] = useState<Platform>('Twitter');
  const [inspirationLevel, setInspirationLevel] = useState(5);
  const [generatedPost, setGeneratedPost] = useState<Post | null>(null);
  const [isGeneratingPost, setIsGeneratingPost] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialPrompt) setPrompt(initialPrompt);
    if (initialQuote) setQuoteFromVault(initialQuote);
  }, [initialPrompt, initialQuote]);
  
  // --- Persona Management State ---
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [allPersonas, setAllPersonas] = useState<Persona[]>(PERSONAS);
  
  const loadingIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    // Fetch custom personas
    const fetchPersonas = async () => {
        try {
            const customPersonas = await getCustomPersonas();
            if (customPersonas.length > 0) {
              setAllPersonas(prev => [...PERSONAS, ...customPersonas]);
            }
        } catch (e: any) {
            setError(e.message || "Could not load custom personas.");
        }
    };
    fetchPersonas();
  }, []);

  useEffect(() => {
    if (isGenerating) {
        loadingIntervalRef.current = window.setInterval(() => {
            setLoadingMessage(prev => {
                const currentIndex = loadingMessages.indexOf(prev);
                return loadingMessages[(currentIndex + 1) % loadingMessages.length];
            });
        }, 3000);
    } else {
        if (loadingIntervalRef.current) {
            clearInterval(loadingIntervalRef.current);
            loadingIntervalRef.current = null;
        }
    }
    return () => {
        if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    }
  }, [isGenerating]);


  const handlePersonaCreated = (newPersona: Persona) => {
    setAllPersonas(prev => [...prev, newPersona]);
    setSelectedPersona(newPersona);
  };
  
  const resetError = () => setError(null);

  const handleGenerateImage = async () => {
    if (!prompt) { setError('Please provide a prompt for the image.'); return; }
    setIsGenerating(true);
    resetError();
    setImageUrl(null);
    setGeneratedPost(null);
    try {
      const url = await generateImageFromPrompt(prompt);
      setImageUrl(url);
      setSelectedPersona(allPersonas[0]);
    } catch (e: any) {
      setError(e.message || 'An unexpected error occurred during image generation.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please upload a valid image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Image size cannot exceed 5MB.'); return; }
    resetError();
    setGeneratedPost(null);
    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setImageUrl(dataUrl);
        setSelectedPersona(allPersonas[0]);
    };
    reader.readAsDataURL(file);
  };
  
  const handleGeneratePost = async () => {
    const mediaUrl = imageUrl;
    if (!mediaUrl || !selectedPersona) { setError('A media asset and persona are required.'); return; }
    setIsGeneratingPost(true);
    resetError();
    try {
      const promptToUse = quoteFromVault 
        ? `${prompt} (Theme & Quote: "${quoteFromVault}")`
        : prompt;

      const postDetails = creationMode === 'upload'
        ? await generateInspirationalPostForUpload(imageUrl!, selectedPersona, platform, inspirationLevel)
        : await generateInspirationalPost(promptToUse, 'image', selectedPersona, platform, inspirationLevel);
      
      const finalPost: Omit<Post, 'id'> = {
        prompt, 
        ...(imageUrl && { imageUrl }),
        ...postDetails
      };

      setGeneratedPost({ ...finalPost, id: new Date().toISOString() });
    } catch(e: any) {
      setError(e.message || 'An unexpected error occurred during post generation.');
    } finally {
      setIsGeneratingPost(false);
    }
  };

  const handlePublish = () => {
    if (generatedPost) {
      onPostCreated({ ...generatedPost, id: new Date().toISOString() + Math.random() });
    }
  };
  
  const handleStartOver = () => {
      setCreationMode('upload');
      setPrompt('');
      setImageUrl(null);
      setGeneratedPost(null);
      setError(null);
  }

  const renderPersonaSelector = (personas: Persona[], onSelect: (p: Persona) => void, current: Persona | null) => (
    personas.map(p => (
        <button key={p.id} onClick={() => onSelect(p)} className={`p-3 rounded-lg border-2 transition-all h-full flex flex-col items-center justify-center text-center ${current?.id === p.id ? 'border-blue-400 bg-gray-700' : 'border-gray-600 hover:border-gray-500'}`}>
            <img src={p.avatar} alt={p.name} className="w-16 h-16 rounded-full mx-auto mb-2 border-2 border-gray-500 flex-shrink-0"/>
            <p className="font-bold text-sm text-white">{p.name}</p>
            <p className="text-xs text-gray-400 hidden md:block mt-1 flex-grow">{p.description}</p>
        </button>
    ))
  );
  
  const mediaGenerated = imageUrl;

  return (
    <>
      <CreatePersonaModal isOpen={isPersonaModalOpen} onClose={() => setIsPersonaModalOpen(false)} onPersonaCreated={handlePersonaCreated} />
      <div className="max-w-2xl mx-auto space-y-8 py-8">
        {quoteFromVault && !mediaGenerated && (
          <div className="bg-indigo-950/70 border border-indigo-700/80 rounded-2xl p-4 flex items-center justify-between shadow-lg animate-fade-in">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                  Inspired by Quote Vault
                </p>
                <p className="text-white text-sm font-medium mt-0.5">
                  "{quoteFromVault}"
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setQuoteFromVault('')}
              className="text-xs text-gray-400 hover:text-white underline ml-3 flex-shrink-0"
            >
              Clear
            </button>
          </div>
        )}
        {!mediaGenerated && (
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-lg animate-fade-in">
              <div className="flex border-b border-gray-700 mb-6">
                  <button onClick={() => setCreationMode('upload')} className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors ${creationMode === 'upload' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-white'}`}>
                      <UploadCloud className="w-5 h-5"/> Upload Image
                  </button>
                  <button onClick={() => setCreationMode('generate')} className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors ${creationMode === 'generate' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-white'}`}>
                      <ImageIcon className="w-5 h-5"/> Generate Image
                  </button>
              </div>
              <div className="space-y-6">
                  {/* IMAGE GENERATION */}
                  {creationMode === 'generate' && (
                      <div className="space-y-6 animate-fade-in-fast">
                          <h2 className="text-2xl font-bold text-white flex items-center gap-3"><span className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">1</span>Describe an Image</h2>
                          <div>
                              <label htmlFor="prompt" className="block text-sm font-medium text-gray-300 mb-2">Image Prompt</label>
                              <textarea id="prompt" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g., A lone hiker watching the sunrise from a mountain peak" className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"/>
                          </div>
                          <div>
                              <p className="text-sm text-gray-400 mb-2">Need ideas? Try one of these:</p>
                              <div className="flex flex-wrap gap-2">{EXAMPLE_PROMPTS.map(p => (<button key={p} onClick={() => setPrompt(p)} className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-full px-3 py-1 transition">{p}</button>))}</div>
                          </div>
                          <button onClick={handleGenerateImage} disabled={isGenerating} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-md hover:shadow-lg disabled:bg-indigo-800 disabled:cursor-not-allowed">
                              {isGenerating ? (<><div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div> Conjuring Pixels...</>) : (<><Wand2 className="w-5 h-5" /> Generate Image</>)}
                          </button>
                      </div>
                  )}

                  {/* IMAGE UPLOAD */}
                  {creationMode === 'upload' && (
                      <div className="space-y-4 animate-fade-in-fast">
                          <h2 className="text-2xl font-bold text-white flex items-center gap-3"><span className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">1</span>Upload an Image</h2>
                          <div className="mt-2 flex justify-center rounded-lg border border-dashed border-gray-600 px-6 py-10">
                              <div className="text-center">
                                  <UploadCloud className="mx-auto h-12 w-12 text-gray-500" />
                                  <div className="mt-4 flex text-sm leading-6 text-gray-400"><label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-semibold text-indigo-400 hover:text-indigo-300"><span>Upload a file</span><input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={(e) => handleFileChange(e)} accept="image/*" /></label><p className="pl-1">or drag and drop</p></div><p className="text-xs leading-5 text-gray-400">PNG, JPG, GIF up to 5MB</p>
                              </div>
                          </div>
                      </div>
                  )}

                 {error && <p className="text-red-400 text-center pt-4">{error}</p>}
              </div>
          </div>
        )}
        {mediaGenerated && !generatedPost && (
           <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 space-y-6 shadow-lg animate-fade-in">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3"><span className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">2</span><UserSquare className="w-7 h-7 text-blue-400" />Craft the Inspirational Post</h2>
              <div className="border border-gray-700 rounded-xl overflow-hidden bg-black">
                {imageUrl && <img src={imageUrl} alt={prompt} className="w-full" />}
                {prompt && creationMode !== 'upload' && <p className="text-xs text-gray-400 p-2 bg-gray-900">Prompt: "{prompt}"</p>}
              </div>
              
              <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Choose a Persona</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {renderPersonaSelector(allPersonas.filter(p => p.category !== 'custom'), setSelectedPersona, selectedPersona)}
                    {renderPersonaSelector(allPersonas.filter(p => p.category === 'custom'), setSelectedPersona, selectedPersona)}
                    <button onClick={() => setIsPersonaModalOpen(true)} className="p-3 rounded-lg border-2 border-dashed border-gray-600 hover:border-indigo-400 hover:text-indigo-400 transition-all text-gray-400 flex flex-col items-center justify-center min-h-[180px]">
                      <UserPlus className="w-12 h-12" />
                      <p className="font-bold text-sm mt-2 text-center">Create New Persona</p>
                    </button>
                  </div>
              </div>
               <div>
                <label htmlFor="inspiration" className="block text-sm font-medium text-gray-300 mb-2">Inspiration Intensity: <span className="font-bold text-blue-400">{inspirationLevel}</span></label>
                <input id="inspiration" type="range" min="1" max="10" value={inspirationLevel} onChange={(e) => setInspirationLevel(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                <div className="flex justify-between text-xs text-gray-400 mt-1"><span>Encouraging</span><span>Profound</span></div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Target Platform</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {platforms.map(p => {
                    const isSelected = platform === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPlatform(p)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                          isSelected 
                            ? 'border-indigo-500 bg-indigo-900/50 text-white font-semibold ring-2 ring-indigo-500/50' 
                            : 'border-gray-700 bg-gray-900/60 text-gray-400 hover:text-white hover:border-gray-600 hover:bg-gray-800'
                        }`}
                      >
                        <div className="mb-1.5 flex items-center justify-center">
                          {p === 'Twitter' && <Twitter className={`w-5 h-5 ${isSelected ? 'text-[#1DA1F2]' : 'text-gray-400'}`} />}
                          {p === 'Facebook' && <Facebook className={`w-5 h-5 ${isSelected ? 'text-[#1877F2]' : 'text-gray-400'}`} />}
                          {p === 'Threads' && <Threads className="w-5 h-5" />}
                          {p === 'LinkedIn' && <LinkedIn className={`w-5 h-5 ${isSelected ? 'text-[#0A66C2]' : 'text-gray-400'}`} />}
                          {p === 'Instagram' && <Instagram className="w-5 h-5" />}
                          {p === 'TikTok' && <TikTok className="w-5 h-5" />}
                        </div>
                        <span className="text-xs">{p}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 pt-2"><button onClick={handleStartOver} className="flex-1 bg-gray-600 hover:bg-gray-500 font-semibold py-3 px-4 rounded-lg">Start Over</button><button onClick={handleGeneratePost} disabled={isGeneratingPost || !selectedPersona} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-md hover:shadow-lg disabled:bg-blue-800 disabled:cursor-not-allowed">
                   {isGeneratingPost ? (<><div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div> Crafting Inspiration...</>) : (<><Sparkles className="w-5 h-5" /> Generate Post</>)}
              </button></div>
              {error && <p className="text-red-400 text-center">{error}</p>}
           </div>
        )}
        {generatedPost && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-b border-gray-700 pb-3">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <span className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-base">3</span>
                Your Inspiration is Ready!
              </h2>
              <span className="text-xs text-green-400 bg-green-950/60 border border-green-800/80 px-3 py-1 rounded-full font-medium">
                Photo & Text Combined
              </span>
            </div>

            <PostCard post={generatedPost} brandSettings={brandSettings} />

            {/* Quick Graphic Download Action Bar */}
            <div className="bg-gray-800 border border-indigo-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg bg-gradient-to-r from-gray-800 via-gray-800 to-indigo-950/30">
              <div>
                <p className="font-semibold text-white text-sm flex items-center gap-2">
                  <Camera className="w-4 h-4 text-indigo-400" />
                  Download Screenshot Graphic
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Save a high-res image pairing your motivational caption with the photo
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => downloadPostGraphic(generatedPost, 'card', brandSettings)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-xl text-xs shadow-md transition"
                >
                  <Camera className="w-4 h-4" />
                  Download (Text + Photo)
                </button>
                {generatedPost.imageUrl && (
                  <button
                    type="button"
                    onClick={() => downloadPostGraphic(generatedPost, 'quote_on_photo', brandSettings)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-medium py-2 px-3.5 rounded-xl text-xs shadow-md transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Quote on Photo
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={handleGeneratePost} disabled={isGeneratingPost} className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded-xl transition-all disabled:bg-gray-800 disabled:cursor-not-allowed">
                <RotateCw className="w-5 h-5" />
                Regenerate Post
              </button>
              <button onClick={handlePublish} className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-lg">
                <Sparkles className="w-5 h-5" />
                Publish to Feed
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};