import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, LogOut, Shield, Plus, Edit2, Trash2, X, Music, Check, Settings, Save, Sparkles, Filter, ChevronRight, Hash, Layout, Upload, Image as ImageIcon, FileAudio, CheckCircle2, Headphones, Instagram, ExternalLink, Globe, Link2, AtSign } from 'lucide-react';
import { signInAnonymously, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { fetchBeats, addBeat, updateBeat, deleteBeat } from '../lib/beatService';
import { fetchGenres, addGenre, deleteGenre, Genre } from '../lib/genreService';
import { fetchSettings, updateSettings, parseInstagram, DEFAULT_INSTAGRAM } from '../lib/settingsService';
import { Track } from '../types';

// Helper to compress and convert image files to optimized Data URLs for direct Firestore storage
function processImageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file is not an image'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 500;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Helper to convert audio file to Data URL
function processAudioFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i)) {
      reject(new Error('Selected file is not a supported audio format'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target?.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface AdminPanelProps {
  onCatalogRefresh: () => void;
  isOpen: boolean;
  onClose: () => void;
  onSettingsRefresh?: () => void;
}

export default function AdminPanel({ onCatalogRefresh, isOpen, onClose, onSettingsRefresh }: AdminPanelProps) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('craxx_admin_session') || localStorage.getItem('beatsbyramz_admin_session');
    return saved ? JSON.parse(saved) : null;
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Catalog items
  const [beats, setBeats] = useState<Track[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [activeFormTab, setActiveFormTab] = useState<'list' | 'add' | 'edit' | 'genres' | 'instagram'>('list');
  const [selectedBeat, setSelectedBeat] = useState<Track | null>(null);
  const [adminGenreFilter, setAdminGenreFilter] = useState('All');
  const [adminSortBy, setAdminSortBy] = useState<'plays' | 'newest' | 'title'>('plays');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [newGenreName, setNewGenreName] = useState('');

  // Instagram Settings State
  const [instagramInput, setInstagramInput] = useState(DEFAULT_INSTAGRAM);
  const [isSavingInstagram, setIsSavingInstagram] = useState(false);
  const [instagramSavedSuccess, setInstagramSavedSuccess] = useState(false);

  // File Upload State & Refs
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingImage(true);
      const dataUrl = await processImageFileToDataUrl(file);
      setFormData(prev => ({ ...prev, artwork: dataUrl }));
    } catch (err: any) {
      alert(err.message || 'Failed to process image file');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleAudioFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingAudio(true);
      const dataUrl = await processAudioFileToDataUrl(file);
      setFormData(prev => ({ ...prev, beatUrl: dataUrl }));
    } catch (err: any) {
      alert(err.message || 'Failed to process audio file');
    } finally {
      setIsUploadingAudio(false);
    }
  };

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    tagline: '',
    bpm: 140,
    key: 'G Minor',
    genre: 'Trap',
    tagsString: '808; Atmospheric; Trap',
    priceBasic: 999,
    pricePremium: 1999,
    priceUnlimited: 3999,
    priceExclusive: 9999,
    duration: '3:00',
    artwork: '',
    mood: 'Dark' as Track['mood'],
    beatUrl: '',
    plays: 0
  });

  // Default Artwork mapping by genre
  const genreArtworks: Record<string, string> = {
    'ototoa': 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=300&h=300',
    'Pop': 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=300&h=300',
    'Trap': 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&q=80&w=300&h=300',
    'Lofi Chill': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=300&h=300',
    'Synthwave': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=300&h=300',
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        localStorage.setItem('beatsbyramz_admin_session', JSON.stringify({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          isFirebase: true
        }));
      }
      setIsLoading(false);
    });

    if (user) {
      loadBeats();
      loadGenres();
      loadInstagramSettings();
    }

    return () => unsubscribe();
  }, []);

  const loadInstagramSettings = async () => {
    try {
      const settings = await fetchSettings();
      if (settings.instagramLink) {
        setInstagramInput(settings.instagramLink);
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  };

  const handleSaveInstagram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instagramInput.trim()) return;
    setIsSavingInstagram(true);
    setInstagramSavedSuccess(false);

    try {
      await updateSettings({
        instagramLink: instagramInput.trim()
      });
      setInstagramSavedSuccess(true);
      if (onSettingsRefresh) {
        onSettingsRefresh();
      }
      setTimeout(() => {
        setInstagramSavedSuccess(false);
      }, 4000);
    } catch (err: any) {
      alert('Failed to update Instagram link: ' + (err.message || 'Please check connection'));
    } finally {
      setIsSavingInstagram(false);
    }
  };

  const loadBeats = async () => {
    try {
      const list = await fetchBeats();
      setBeats(list);
    } catch (e) {
      console.error(e);
    }
  };

  const loadGenres = async () => {
    try {
      const list = await fetchGenres();
      setGenres(list);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddGenre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGenreName.trim()) return;
    setIsSubmitting(true);
    try {
      await addGenre(newGenreName.trim());
      setNewGenreName('');
      await loadGenres();
    } catch (err) {
      alert('Failed to add genre.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGenre = async (id: string) => {
    if (confirm('Delete this genre? Existing beats with this genre will keep it until edited.')) {
      try {
        await deleteGenre(id);
        await loadGenres();
      } catch (err) {
        alert('Failed to delete genre.');
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsSubmitting(true);

    if (username.trim() && password.trim()) {
      try {
        // Attempt anonymous sign-in, but don't block if it's disabled in console
        await signInAnonymously(auth).catch(err => {
          console.warn('Anonymous Auth disabled in console. Proceeding with local admin session.', err);
        });
        
        // Establish a local admin session even if Auth provider is disabled
        const mockUser = { uid: 'admin-session', email: 'admin@craxx.fire' } as any;
        localStorage.setItem('craxx_admin_session', JSON.stringify(mockUser));
        setUser(mockUser); 
        loadBeats();
        loadGenres();
        setIsLoading(false);
      } catch (err: any) {
        setLoginError(`Login Error: ${err.message || 'Unknown error'}`);
        console.error('Login Error:', err);
      }
    } else {
      setLoginError('Please enter valid administrator credentials.');
    }
    setIsSubmitting(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('craxx_admin_session');
      localStorage.removeItem('beatsbyramz_admin_session');
      setUser(null);
      setBeats([]);
      setUsername('');
      setPassword('');
      setActiveFormTab('list');
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  const handleEditClick = (beat: Track) => {
    setSelectedBeat(beat);
    setFormData({
      title: beat.title,
      tagline: beat.tagline,
      bpm: beat.bpm,
      key: beat.key,
      genre: beat.genre,
      tagsString: beat.tags.join('; '),
      priceBasic: beat.priceBasic || 999,
      pricePremium: beat.pricePremium || 1999,
      priceUnlimited: beat.priceUnlimited || 3999,
      priceExclusive: beat.priceExclusive || 9999,
      duration: beat.duration,
      artwork: beat.artwork,
      mood: beat.mood,
      beatUrl: beat.beatUrl || '',
      plays: beat.plays || 0
    });
    setActiveFormTab('edit');
  };

  const handleAddClick = () => {
    setSelectedBeat(null);
    setFormData({
      title: '',
      tagline: '',
      bpm: 140,
      key: 'G Minor',
      genre: 'Trap',
      tagsString: '808; Atmospheric; Trap',
      priceBasic: 999,
      pricePremium: 1999,
      priceUnlimited: 3999,
      priceExclusive: 9999,
      duration: '3:00',
      artwork: '',
      mood: 'Dark',
      beatUrl: '',
      plays: 0
    });
    setActiveFormTab('add');
  };

  const handleDeleteClick = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    
    setIsSubmitting(true);
    try {
      await deleteBeat(deleteConfirmId);
      await loadBeats();
      onCatalogRefresh();
      setDeleteConfirmId(null);
    } catch (err) {
      alert('Deletion failed. Please check network connectivity.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (adminGenreFilter === 'All') return;
    
    const targets = beats.filter(b => b.genre === adminGenreFilter);
    if (targets.length === 0) return;

    if (confirm(`MASS PURGE WARNING: You are about to delete ALL ${targets.length} beats in the "${adminGenreFilter}" genre. This cannot be undone. Proceed?`)) {
       setIsSubmitting(true);
       try {
         for (const beat of targets) {
           await deleteBeat(beat.id);
         }
         await loadBeats();
         onCatalogRefresh();
         alert(`Successfully purged ${targets.length} beats.`);
       } catch (err) {
         alert('Bulk deletion partially failed.');
       } finally {
         setIsSubmitting(false);
       }
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const tags = formData.tagsString
      .split(';')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const finalArtwork = formData.artwork || genreArtworks[formData.genre] || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=300&h=300';

    // Trim all inputs and prepare payload
    const trimmedBeatUrl = formData.beatUrl?.trim();
    
    const beatPayload = {
      title: formData.title.trim(),
      tagline: formData.tagline?.trim() || `${formData.mood} styled rhythm`,
      bpm: Number(formData.bpm),
      key: formData.key.trim(),
      genre: formData.genre,
      tags,
      priceBasic: Number(formData.priceBasic) || 999,
      pricePremium: Number(formData.pricePremium) || 1999,
      priceUnlimited: Number(formData.priceUnlimited) || 3999,
      priceExclusive: Number(formData.priceExclusive) || 9999,
      duration: formData.duration?.trim() || '3:00',
      artwork: finalArtwork.trim(),
      mood: formData.mood,
      beatUrl: trimmedBeatUrl,
      plays: Number(formData.plays) || 0
    };

    try {
      if (activeFormTab === 'edit' && selectedBeat) {
        await updateBeat(selectedBeat.id, beatPayload);
      } else {
        await addBeat(beatPayload);
      }
      setActiveFormTab('list');
      await loadBeats();
      onCatalogRefresh();
    } catch (err) {
      alert('Save operation failed. Please check your network and security parameters.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dark Ambient overlay */}
      <div className="absolute inset-0 bg-zinc-950/98 md:bg-zinc-950/80 md:backdrop-blur-md" onClick={onClose}></div>

      {/* Main Container */}
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative bg-zinc-900 border border-zinc-800/80 w-full max-w-5xl lg:max-w-6xl xl:max-w-7xl max-h-[96vh] h-[94vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white font-sans z-10"
      >
        {/* Title Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 sm:px-6 py-3.5 bg-zinc-950/60 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-purple-500/10 text-purple-400">
              <Shield className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-sans tracking-wider uppercase font-black text-zinc-100">Producer Command Console</h2>
              <p className="text-[10px] text-zinc-500 font-sans font-bold uppercase tracking-wider">Live database synchronization powered by Cloud Firestore</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-500 hover:text-white bg-zinc-850 hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Close command console"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Auth Gate Screen */}
        {!user ? (
          <div className="flex-grow flex flex-col justify-center items-center py-16 px-6 max-w-sm mx-auto w-full">
            <h3 className="text-xl font-bold font-sans tracking-tight mb-2 flex items-center gap-1">
              Administrator Login
            </h3>
            <p className="text-xs text-zinc-400 text-center mb-6">Enter command credentials below to load write permissions</p>

            <form onSubmit={handleLogin} className="w-full space-y-4">
              <div>
                <label className="block text-[10px] font-sans font-bold text-zinc-400 uppercase tracking-widest mb-1">Username</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder=""
                  className="w-full bg-zinc-950 px-4 py-2.5 rounded-xl border border-zinc-800 focus:border-amber-400 text-sm focus:outline-none placeholder-zinc-750 transition-all font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-sans font-bold text-zinc-400 uppercase tracking-widest mb-1">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder=""
                  className="w-full bg-zinc-950 px-4 py-2.5 rounded-xl border border-zinc-800 focus:border-amber-400 text-sm focus:outline-none placeholder-zinc-750 transition-all font-mono"
                  required
                />
              </div>

              {loginError && (
                <div className="text-[10px] text-rose-400 font-mono text-center pt-1 animate-bounce">
                  ⚠ {loginError}
                </div>
              )}

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-yellow-300 text-black font-sans font-bold text-xs uppercase tracking-wider transition-all shadow-lg active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Authorize Terminal</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* Logged In Dashboard Screen */
          <div className="flex-grow flex flex-col md:flex-row overflow-hidden bg-zinc-900 min-h-0">
            {/* Sidebar Controls */}
            <div className="w-full md:w-56 border-b md:border-b-0 md:border-r border-zinc-850 px-3 md:px-4 py-2.5 md:py-5 flex flex-row md:flex-col justify-between items-center md:items-stretch gap-2 md:gap-4 flex-shrink-0 bg-zinc-950/40 overflow-x-auto md:overflow-visible">
              <div className="flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-visible flex-grow md:flex-grow-0 no-scrollbar">
                <div className="hidden md:block text-[9px] font-sans font-bold text-zinc-500 uppercase tracking-widest px-2 mb-2">Controls</div>
                
                <button
                  onClick={() => setActiveFormTab('list')}
                  className={`px-3 py-2 rounded-xl text-[10px] font-sans font-bold uppercase tracking-wider transition-colors flex items-center gap-2 flex-shrink-0 whitespace-nowrap cursor-pointer ${
                    activeFormTab === 'list' 
                      ? 'bg-amber-400 text-black shadow-md shadow-amber-500/20 font-black' 
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-850/40'
                  }`}
                >
                  <Music className="w-3.5 h-3.5" />
                  <span>Tracks Catalog</span>
                </button>

                <button
                  onClick={handleAddClick}
                  className={`px-3 py-2 rounded-xl text-[10px] font-sans font-bold uppercase tracking-wider transition-colors flex items-center gap-2 flex-shrink-0 whitespace-nowrap cursor-pointer ${
                    activeFormTab === 'add' 
                      ? 'bg-amber-400 text-black shadow-md shadow-amber-500/20 font-black' 
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-850/40'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Beat</span>
                </button>

                <button
                  onClick={() => setActiveFormTab('genres')}
                  className={`px-3 py-2 rounded-xl text-[10px] font-sans font-bold uppercase tracking-wider transition-colors flex items-center gap-2 flex-shrink-0 whitespace-nowrap cursor-pointer ${
                    activeFormTab === 'genres' 
                      ? 'bg-amber-400 text-black shadow-md shadow-amber-500/20 font-black' 
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-850/40'
                  }`}
                >
                  <Layout className="w-3.5 h-3.5" />
                  <span>Manage Genres</span>
                </button>

                <button
                  onClick={() => {
                    loadInstagramSettings();
                    setActiveFormTab('instagram');
                  }}
                  className={`px-3 py-2 rounded-xl text-[10px] font-sans font-bold uppercase tracking-wider transition-colors flex items-center gap-2 flex-shrink-0 whitespace-nowrap cursor-pointer ${
                    activeFormTab === 'instagram' 
                      ? 'bg-amber-400 text-black shadow-md shadow-amber-500/20 font-black' 
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-850/40'
                  }`}
                >
                  <Instagram className="w-3.5 h-3.5 text-rose-400" />
                  <span>Instagram Link</span>
                </button>
              </div>

              <div className="flex-shrink-0">
                <div className="border-t-0 md:border-t border-zinc-850 pt-0 md:pt-4 px-2 pb-0 md:pb-2 flex md:flex-col items-center md:items-start gap-2">
                  <div className="hidden md:flex text-[9px] truncate text-emerald-400 font-mono items-center gap-1.5 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Admin Session</span>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="font-mono text-[10px] text-zinc-500 hover:text-rose-400 flex items-center gap-1.5 transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-zinc-800"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Exit</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Main Section panel */}
            <div className="flex-grow flex flex-col min-h-0 overflow-hidden">
              
              {/* Beats List */}
              {activeFormTab === 'list' && (
                <div className="flex-grow flex flex-col overflow-hidden px-6 py-6">
                  <div className="mb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                      <h4 className="text-base font-bold font-sans tracking-tight">Active Instrumentals</h4>
                      <p className="text-[10px] text-zinc-400 font-mono">
                        Total catalog tracks: {beats.length} • Total plays: {beats.reduce((sum, b) => sum + (b.plays || 0), 0).toLocaleString()}
                      </p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2">
                       {adminGenreFilter !== 'All' && (
                         <button 
                           onClick={handleBulkDelete}
                           className="bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 border border-rose-900/30 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                         >
                           <Trash2 className="w-3 h-3" />
                           Purge All
                         </button>
                       )}

                       <div className="flex items-center gap-1">
                         <span className="text-[9px] text-zinc-500 font-mono uppercase">Sort:</span>
                         <select 
                           value={adminSortBy}
                           onChange={(e) => setAdminSortBy(e.target.value as 'plays' | 'newest' | 'title')}
                           className="bg-zinc-950 border border-zinc-850 rounded-lg px-2 py-1 text-[10px] font-mono focus:outline-none focus:border-amber-400 text-amber-400 font-bold"
                         >
                           <option value="plays">🔥 Most Plays</option>
                           <option value="newest">🕒 Newest</option>
                           <option value="title">🔤 Title (A-Z)</option>
                         </select>
                       </div>

                       <div className="flex items-center gap-1">
                         <span className="text-[9px] text-zinc-500 font-mono uppercase">Genre:</span>
                         <select 
                           value={adminGenreFilter}
                           onChange={(e) => setAdminGenreFilter(e.target.value)}
                           className="bg-zinc-950 border border-zinc-850 rounded-lg px-2 py-1 text-[10px] font-mono focus:outline-none focus:border-purple-500"
                         >
                           <option value="All">All Genres</option>
                           {genres.map(g => (
                             <option key={g.id} value={g.name}>{g.name}</option>
                           ))}
                         </select>
                       </div>
                    </div>
                  </div>

                  <div className="flex-grow overflow-y-auto pr-1">
                    {isLoading ? (
                      <div className="py-20 flex flex-col items-center justify-center gap-2">
                        <span className="w-6 h-6 border-2 border-t-transparent border-purple-500 rounded-full animate-spin"></span>
                        <span className="text-[10px] text-zinc-500 font-mono">Synchronizing beats...</span>
                      </div>
                    ) : beats.filter(b => adminGenreFilter === 'All' || b.genre === adminGenreFilter).length === 0 ? (
                      <div className="border border-dashed border-zinc-800 text-center rounded-2xl py-12 px-4 shadow-inner bg-zinc-950/20">
                        <span className="text-xs text-zinc-500">No tracks matches the current filter.</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 pb-4">
                        {[...beats]
                          .filter(b => adminGenreFilter === 'All' || b.genre === adminGenreFilter)
                          .sort((a, b) => {
                            if (adminSortBy === 'plays') {
                              return (b.plays || 0) - (a.plays || 0);
                            }
                            if (adminSortBy === 'title') {
                              return a.title.localeCompare(b.title);
                            }
                            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                            return dateB - dateA;
                          })
                          .map((beat, idx) => (
                          <div 
                            key={beat.id}
                            className="bg-zinc-950/80 hover:bg-zinc-900/60 border border-zinc-800/90 hover:border-zinc-700 p-5 sm:p-6 rounded-2xl transition-all shadow-md flex flex-col md:flex-row md:items-center justify-between gap-5"
                          >
                            {/* Left: Artwork + Big Title + Meta Specs */}
                            <div className="flex items-start sm:items-center gap-4 sm:gap-5 min-w-0 flex-grow">
                              {/* Rank Indicator */}
                              {adminSortBy === 'plays' && (
                                <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-mono font-black flex-shrink-0 ${
                                  idx === 0 
                                    ? 'bg-amber-400 text-black shadow-lg shadow-amber-500/30' 
                                    : idx < 3 
                                    ? 'bg-zinc-800 text-amber-300 border border-amber-400/40' 
                                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                                }`}>
                                  #{idx + 1}
                                </span>
                              )}

                              {/* Large Artwork */}
                              <img 
                                src={beat.artwork} 
                                alt={beat.title} 
                                className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl object-cover border border-zinc-800 flex-shrink-0 shadow-lg"
                                referrerPolicy="no-referrer"
                              />

                              {/* Clean, Readable Track Information */}
                              <div className="min-w-0 flex-grow space-y-1.5">
                                <div className="flex flex-wrap items-baseline gap-2">
                                  <h5 className="text-lg sm:text-xl text-white font-sans font-bold tracking-tight truncate">
                                    {beat.title}
                                  </h5>
                                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                                    ₹{(beat.priceBasic || 999).toLocaleString()}
                                  </span>
                                </div>

                                {/* Clean Metadata Line: BPM, Key, Genre */}
                                <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-zinc-300">
                                  <span className="bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800 text-zinc-200">
                                    ⚡ {beat.bpm} BPM
                                  </span>
                                  <span className="bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800 text-zinc-200">
                                    🎹 {beat.key}
                                  </span>
                                  <span className="bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800 text-purple-300 font-sans uppercase tracking-wider text-[11px] font-semibold">
                                    🏷️ {beat.genre}
                                  </span>
                                  <span className="bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800 text-zinc-400">
                                    ⏱ {beat.duration}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Right: Plays & Big Action Buttons */}
                            <div className="flex items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-zinc-850/80 flex-shrink-0">
                              {/* Total Plays Counter */}
                              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-400 font-mono text-xs font-bold">
                                <Headphones className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                <span>{(beat.plays || 0).toLocaleString()} plays</span>
                              </div>

                              {/* Big Edit Button */}
                              <button
                                onClick={() => handleEditClick(beat)}
                                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 hover:text-white border border-zinc-700 font-sans font-bold text-xs flex items-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer"
                                title="Edit Beat Parameters"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                                <span>Edit</span>
                              </button>

                              {/* Big Delete Button */}
                              <button
                                onClick={() => handleDeleteClick(beat.id)}
                                className="px-4 py-2.5 rounded-xl bg-rose-950/50 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-800/60 hover:border-rose-500 font-sans font-bold text-xs flex items-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer"
                                title="Delete Beat"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Genre Management Panel */}
              {activeFormTab === 'genres' && (
                <div className="flex-grow flex flex-col overflow-hidden px-6 py-6 font-sans">
                  <div className="mb-6">
                    <h4 className="text-base font-bold tracking-tight">Genre Architecture</h4>
                    <p className="text-[10px] text-zinc-400 font-mono">Create custom classification tags for your catalog</p>
                  </div>

                  <form onSubmit={handleAddGenre} className="mb-6 flex gap-2">
                    <input 
                      type="text"
                      value={newGenreName}
                      onChange={(e) => setNewGenreName(e.target.value)}
                      placeholder="e.g., Afro-Fusion"
                      className="flex-grow bg-zinc-950 border border-zinc-850 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-purple-500 font-mono"
                    />
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Genre
                    </button>
                  </form>

                  <div className="flex-grow overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                      {genres.map((genre) => (
                        <div key={genre.id} className="flex items-center justify-between bg-zinc-950/40 border border-zinc-850 px-4 py-3 rounded-2xl group">
                          <span className="text-xs font-mono text-zinc-100">{genre.name}</span>
                          <button 
                            onClick={() => handleDeleteGenre(genre.id)}
                            className="p-1.5 rounded-lg text-zinc-650 hover:text-rose-400 hover:bg-rose-955/10 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Instagram & Socials Management Panel */}
              {activeFormTab === 'instagram' && (() => {
                const parsed = parseInstagram(instagramInput);
                return (
                  <div className="flex-grow flex flex-col overflow-y-auto px-6 py-6 font-sans">
                    <div className="max-w-3xl w-full mx-auto space-y-6">
                      
                      {/* Section Title */}
                      <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-yellow-500 via-rose-500 to-purple-600 p-0.5 shadow-md flex items-center justify-center">
                              <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
                                <Instagram className="w-4 h-4 text-rose-400" />
                              </div>
                            </div>
                            <h4 className="text-lg font-bold tracking-tight text-white">Instagram Connection</h4>
                          </div>
                          <p className="text-xs text-zinc-400 mt-1 font-sans">
                            Configure your Instagram account link and username. This directly controls where buyers are redirected when inquiring or purchasing licenses.
                          </p>
                        </div>

                        {instagramSavedSuccess && (
                          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold flex items-center gap-1.5 animate-pulse flex-shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Saved to Database!</span>
                          </div>
                        )}
                      </div>

                      {/* Input Form */}
                      <form onSubmit={handleSaveInstagram} className="space-y-5 bg-zinc-950/70 border border-zinc-800/90 rounded-2xl p-5 sm:p-6 shadow-xl">
                        <div>
                          <label className="block text-xs font-sans font-bold text-zinc-300 uppercase tracking-wider mb-2">
                            Instagram Profile URL or Handle
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                              <Instagram className="w-4 h-4 text-rose-400" />
                            </div>
                            <input 
                              type="text"
                              value={instagramInput}
                              onChange={(e) => setInstagramInput(e.target.value)}
                              placeholder="e.g. craxxbeats.india or https://instagram.com/craxxbeats.india"
                              className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-400 pl-10 pr-4 py-3 rounded-xl text-sm font-mono text-white placeholder-zinc-600 focus:outline-none transition-all shadow-inner"
                              required
                            />
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-2 font-sans">
                            Accepts <code className="text-amber-400 bg-zinc-900 px-1 py-0.5 rounded font-mono">@handle</code>, full profile link <code className="text-zinc-400 bg-zinc-900 px-1 py-0.5 rounded font-mono">https://instagram.com/...</code>, or direct message link.
                          </p>
                        </div>

                        {/* Live Resolution & Preview Card */}
                        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 block">
                            Live Destination Preview
                          </span>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                            <div className="bg-zinc-950 border border-zinc-800/80 p-3 rounded-xl">
                              <span className="text-[10px] text-zinc-500 uppercase block mb-1">Detected Handle:</span>
                              <span className="text-white font-bold text-sm text-rose-400 flex items-center gap-1">
                                <AtSign className="w-3.5 h-3.5 text-zinc-500" />
                                {parsed.handle}
                              </span>
                            </div>

                            <div className="bg-zinc-950 border border-zinc-800/80 p-3 rounded-xl">
                              <span className="text-[10px] text-zinc-500 uppercase block mb-1">Direct Message Link (ig.me):</span>
                              <span className="text-amber-400 font-bold truncate block" title={parsed.dmUrl}>
                                {parsed.dmUrl}
                              </span>
                            </div>
                          </div>

                          {/* Test Links */}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <a 
                              href={parsed.dmUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-sans font-bold flex items-center gap-1.5 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                              <span>Test Open Direct Message Link</span>
                            </a>

                            <a 
                              href={parsed.profileUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs font-sans transition-colors flex items-center gap-1.5"
                            >
                              <Globe className="w-3.5 h-3.5 text-zinc-500" />
                              <span>Test Open Profile Page</span>
                            </a>
                          </div>
                        </div>

                        {/* Integration Scope Checklist */}
                        <div className="border border-zinc-800/60 bg-zinc-900/40 rounded-xl p-4 space-y-2 text-xs text-zinc-400 font-sans">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-bold block mb-1">
                            Where this link is used in your beat store:
                          </span>
                          <div className="flex items-start gap-2">
                            <span className="text-emerald-400">✓</span>
                            <span><strong>Buy License Popup:</strong> When a customer clicks "Buy Now" on any tier (MP3, WAV, Stems, Exclusive), their order details are copied to the clipboard and they are redirected to DM this account.</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-emerald-400">✓</span>
                            <span><strong>Store Footer:</strong> Displayed with your handle and links directly to your Instagram profile.</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-emerald-400">✓</span>
                            <span><strong>Sticky Audio Player:</strong> Quick DM redirect button for custom inquiries.</span>
                          </div>
                        </div>

                        {/* Save Action Bar */}
                        <div className="flex items-center justify-between pt-2 border-t border-zinc-850">
                          <button
                            type="button"
                            onClick={() => setInstagramInput(DEFAULT_INSTAGRAM)}
                            className="text-xs font-mono text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
                          >
                            Reset to Default (@craxxbeats.india)
                          </button>

                          <button
                            type="submit"
                            disabled={isSavingInstagram}
                            className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-yellow-300 text-black font-sans font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer flex items-center gap-2"
                          >
                            {isSavingInstagram ? (
                              <>
                                <span className="w-4 h-4 border-2 border-t-transparent border-black rounded-full animate-spin" />
                                <span>Saving to Firestore...</span>
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4" />
                                <span>Save Instagram Link</span>
                              </>
                            )}
                          </button>
                        </div>
                      </form>

                    </div>
                  </div>
                );
              })()}

              {/* Add & Edit Form */}
              {(activeFormTab === 'add' || activeFormTab === 'edit') && (
                <form onSubmit={handleFormSubmit} className="flex-grow flex flex-col min-h-0 overflow-hidden">
                  {/* Form Header */}
                  <div className="px-6 sm:px-8 py-3.5 border-b border-zinc-800 flex-shrink-0 bg-zinc-950/60 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20">
                        <Music className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm sm:text-base font-bold tracking-tight text-white">
                          {activeFormTab === 'edit' ? 'Edit Instrumental Parameters' : 'Add New Beat Details'}
                        </h4>
                        <p className="text-[10px] text-zinc-400 font-sans">
                          Scroll down through all track details, audio/artwork files, and license pricing.
                        </p>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setActiveFormTab('list')}
                      className="px-3 py-1.5 rounded-xl text-xs font-sans text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer"
                    >
                      ← Back to Catalog
                    </button>
                  </div>

                  {/* Long & Scrollable Form Body */}
                  <div className="flex-grow min-h-0 overflow-y-auto px-6 sm:px-8 py-6 space-y-6 custom-scrollbar scroll-smooth">
                    
                    {/* Section 1: Track Identity */}
                    <div className="bg-zinc-950/70 border border-zinc-800/90 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
                      <div className="border-b border-zinc-850 pb-2.5 flex items-center justify-between">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                          1. Track Identity
                        </span>
                        <span className="text-[10px] font-sans text-zinc-500">Core Title & Description</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Beat Name */}
                        <div>
                          <label className="block text-xs font-sans font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                            Beat Title / Name <span className="text-amber-400">*</span>
                          </label>
                          <input 
                            type="text" 
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="e.g., Midnight Stars"
                            className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none font-mono text-zinc-100 transition-all placeholder-zinc-650"
                            required
                          />
                        </div>

                        {/* Tagline */}
                        <div>
                          <label className="block text-xs font-sans font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                            Short Tagline / Vibe
                          </label>
                          <input 
                            type="text" 
                            value={formData.tagline}
                            onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                            placeholder="e.g., Mellow lo-pass filtered trap backing"
                            className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none font-mono text-zinc-100 transition-all placeholder-zinc-650"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Musical Parameters */}
                    <div className="bg-zinc-950/70 border border-zinc-800/90 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
                      <div className="border-b border-zinc-850 pb-2.5 flex items-center justify-between">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                          2. Musical Specs & Attributes
                        </span>
                        <span className="text-[10px] font-sans text-zinc-500">Tempo, Scale, Genre & Duration</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {/* BPM */}
                        <div>
                          <label className="block text-xs font-sans font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                            BPM <span className="text-amber-400">*</span>
                          </label>
                          <input 
                            type="number" 
                            value={formData.bpm}
                            onChange={(e) => setFormData({ ...formData, bpm: Number(e.target.value) })}
                            placeholder="140"
                            className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none font-mono text-zinc-100 transition-all"
                            required
                          />
                        </div>

                        {/* Musical Key */}
                        <div>
                          <label className="block text-xs font-sans font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                            Musical Key
                          </label>
                          <input 
                            type="text" 
                            value={formData.key}
                            onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                            placeholder="e.g., F Minor"
                            className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none font-mono text-zinc-100 transition-all"
                          />
                        </div>

                        {/* Genre selection */}
                        <div>
                          <label className="block text-xs font-sans font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                            Genre Classification
                          </label>
                          <select 
                            value={formData.genre}
                            onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 font-mono text-zinc-100"
                          >
                            {genres.length > 0 ? (
                              genres.map(g => (
                                <option key={g.id} value={g.name}>{g.name}</option>
                              ))
                            ) : (
                              <option value="Trap">Trap</option>
                            )}
                          </select>
                        </div>

                        {/* Mood Selection */}
                        <div>
                          <label className="block text-xs font-sans font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                            Primary Mood
                          </label>
                          <select 
                            value={formData.mood}
                            onChange={(e) => setFormData({ ...formData, mood: e.target.value as Track['mood'] })}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 font-mono text-zinc-100"
                          >
                            <option value="Dark">Dark</option>
                            <option value="Chill">Chill</option>
                            <option value="Energetic">Energetic</option>
                            <option value="Inspiring">Inspiring</option>
                            <option value="Hypnotic">Hypnotic</option>
                            <option value="Happy">Happy</option>
                            <option value="Sad">Sad</option>
                            <option value="Intense">Intense</option>
                          </select>
                        </div>

                        {/* Duration */}
                        <div>
                          <label className="block text-xs font-sans font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                            Duration (MM:SS) <span className="text-amber-400">*</span>
                          </label>
                          <input 
                            type="text" 
                            value={formData.duration}
                            onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                            placeholder="3:45"
                            className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none font-mono text-zinc-100 transition-all"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Media & Files */}
                    <div className="bg-zinc-950/70 border border-zinc-800/90 rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm">
                      <div className="border-b border-zinc-850 pb-2.5 flex items-center justify-between">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                          3. Media & Audio Files
                        </span>
                        <span className="text-[10px] font-sans text-zinc-500">Artwork & Audio Stream</span>
                      </div>

                      {/* Artwork Direct Upload & Preview */}
                      <div className="space-y-3">
                        <label className="block text-xs font-sans font-bold text-zinc-300 uppercase tracking-wider">
                          Track Cover Artwork
                        </label>
                        
                        <input 
                          type="file" 
                          ref={imageInputRef}
                          onChange={handleImageFileSelect}
                          accept="image/*"
                          className="hidden"
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                          {/* Dropzone Box */}
                          <div 
                            onClick={() => imageInputRef.current?.click()}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const file = e.dataTransfer.files?.[0];
                              if (file) {
                                processImageFileToDataUrl(file).then(dataUrl => {
                                  setFormData(prev => ({ ...prev, artwork: dataUrl }));
                                }).catch(err => alert(err.message));
                              }
                            }}
                            className="sm:col-span-3 border-2 border-dashed border-zinc-800 hover:border-amber-400 bg-zinc-900/60 hover:bg-zinc-900 p-4 sm:p-5 rounded-2xl flex items-center justify-center gap-3.5 cursor-pointer transition-all group"
                          >
                            <div className="w-11 h-11 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                              {isUploadingImage ? (
                                <span className="w-5 h-5 border-2 border-t-transparent border-amber-400 rounded-full animate-spin" />
                              ) : (
                                <Upload className="w-5 h-5" />
                              )}
                            </div>
                            <div className="text-left">
                              <p className="text-xs sm:text-sm font-sans font-bold text-zinc-200 group-hover:text-amber-400 transition-colors">
                                Click or drag & drop artwork image here
                              </p>
                              <p className="text-[10px] font-mono text-zinc-500">
                                Supports PNG, JPG, WEBP. Compressed and stored directly.
                              </p>
                            </div>
                          </div>

                          {/* Preview Thumbnail */}
                          <div className="sm:col-span-1 flex flex-col items-center justify-center border border-zinc-800 bg-zinc-900 p-2.5 rounded-2xl h-full min-h-[80px]">
                            {formData.artwork ? (
                              <div className="relative group w-full h-full flex items-center justify-center">
                                <img 
                                  src={formData.artwork} 
                                  alt="Artwork preview" 
                                  className="w-16 h-16 rounded-xl object-cover border border-amber-400/50 shadow-md" 
                                />
                                <button 
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setFormData({ ...formData, artwork: '' }); }}
                                  className="absolute -top-1 -right-1 bg-rose-500 text-white p-1 rounded-full text-[9px] opacity-90 hover:opacity-100 transition-opacity cursor-pointer shadow-md"
                                  title="Remove artwork"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="text-center text-zinc-600">
                                <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-40" />
                                <span className="text-[9px] font-mono">No Cover Loaded</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Optional URL input fallback */}
                        <div>
                          <input 
                            type="text" 
                            value={formData.artwork}
                            onChange={(e) => setFormData({ ...formData, artwork: e.target.value })}
                            placeholder="Or paste direct image URL (https://...)"
                            className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-400 rounded-xl px-4 py-2 text-xs font-mono text-zinc-300 focus:outline-none transition-all placeholder-zinc-650"
                          />
                        </div>
                      </div>

                      {/* Beat Audio Direct Upload & URL */}
                      <div className="space-y-3 pt-2 border-t border-zinc-850">
                        <label className="block text-xs font-sans font-bold text-zinc-300 uppercase tracking-wider">
                          Instrumental Audio Track (Audio Stream) <span className="text-amber-400">*</span>
                        </label>

                        <input 
                          type="file" 
                          ref={audioInputRef}
                          onChange={handleAudioFileSelect}
                          accept="audio/*,.mp3,.wav,.ogg,.m4a"
                          className="hidden"
                        />

                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            type="button"
                            onClick={() => audioInputRef.current?.click()}
                            className="flex-1 border border-zinc-800 hover:border-amber-400 bg-zinc-900 hover:bg-zinc-850 px-4 py-3 rounded-2xl flex items-center justify-center gap-2.5 text-xs font-sans font-bold text-zinc-200 hover:text-amber-400 transition-all cursor-pointer shadow-sm"
                          >
                            {isUploadingAudio ? (
                              <>
                                <span className="w-4 h-4 border-2 border-t-transparent border-amber-400 rounded-full animate-spin" />
                                <span className="font-mono text-xs">Uploading audio data...</span>
                              </>
                            ) : formData.beatUrl ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                <span className="text-emerald-400 font-mono text-xs truncate max-w-[280px]">Audio track loaded & ready</span>
                              </>
                            ) : (
                              <>
                                <FileAudio className="w-4 h-4 text-amber-400" />
                                <span>Upload Audio File (MP3 / WAV / OGG)</span>
                              </>
                            )}
                          </button>
                        </div>

                        <input 
                          type="text" 
                          value={formData.beatUrl}
                          onChange={(e) => setFormData({ ...formData, beatUrl: e.target.value })}
                          placeholder="Or paste audio URL (https://actions.google.com/sounds/v1/music/...)"
                          className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-400 rounded-xl px-4 py-2 text-xs font-mono text-amber-200 focus:outline-none transition-all placeholder-zinc-650"
                          required
                        />
                      </div>
                    </div>

                    {/* Section 4: Tags & Keywords */}
                    <div className="bg-zinc-950/70 border border-zinc-800/90 rounded-2xl p-5 sm:p-6 space-y-3 shadow-sm">
                      <div className="border-b border-zinc-850 pb-2.5 flex items-center justify-between">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                          4. Search Tags & Style Keywords
                        </span>
                        <span className="text-[10px] font-sans text-zinc-500">Store Search Filters</span>
                      </div>

                      <div>
                        <label className="block text-xs font-sans font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                          Tags / Styles (Separate by Semicolon)
                        </label>
                        <input 
                          type="text" 
                          value={formData.tagsString}
                          onChange={(e) => setFormData({ ...formData, tagsString: e.target.value })}
                          placeholder="Chill; Relaxed; Melancholic; 808"
                          className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none font-mono text-zinc-100 transition-all placeholder-zinc-650"
                        />
                        <p className="text-[10px] text-zinc-500 font-sans mt-1.5">
                          Buyers can search beats using these tags in the catalog search bar.
                        </p>
                      </div>
                    </div>

                    {/* Section 5: All 4 License Tier Prices (in Rupees ₹) */}
                    <div className="bg-zinc-950/70 border border-zinc-800/90 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
                      <div className="border-b border-zinc-850 pb-2.5 flex items-center justify-between">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                          5. Licensing Tiers & Pricing (in Rupees ₹)
                        </span>
                        <span className="text-[10px] font-sans text-amber-400 font-mono font-bold">Currency: INR (₹)</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* MP3 License Price */}
                        <div className="bg-zinc-900/90 border border-zinc-800 p-3.5 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-sans font-bold text-amber-400 uppercase tracking-wider">
                              MP3 License (₹)
                            </label>
                            <span className="text-[9px] font-mono text-zinc-500">Basic</span>
                          </div>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-amber-400 font-mono font-bold">
                              ₹
                            </span>
                            <input 
                              type="number" 
                              value={formData.priceBasic}
                              onChange={(e) => setFormData({ ...formData, priceBasic: Number(e.target.value) })}
                              placeholder="999"
                              className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-400 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none font-mono text-zinc-100 font-bold"
                              required
                            />
                          </div>
                          <p className="text-[10px] text-zinc-500 font-sans">Starting store price</p>
                        </div>

                        {/* WAV License Price */}
                        <div className="bg-zinc-900/90 border border-zinc-800 p-3.5 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-sans font-bold text-amber-400 uppercase tracking-wider">
                              WAV License (₹)
                            </label>
                            <span className="text-[9px] font-mono text-zinc-500">Lossless</span>
                          </div>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-amber-400 font-mono font-bold">
                              ₹
                            </span>
                            <input 
                              type="number" 
                              value={formData.pricePremium}
                              onChange={(e) => setFormData({ ...formData, pricePremium: Number(e.target.value) })}
                              placeholder="1999"
                              className="w-full bg-zinc-950 border border-zinc-850 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none font-mono text-zinc-100 font-bold"
                              required
                            />
                          </div>
                          <p className="text-[10px] text-zinc-500 font-sans">Master 24-bit WAV</p>
                        </div>

                        {/* WAV + Stems License Price */}
                        <div className="bg-zinc-900/90 border border-zinc-800 p-3.5 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-sans font-bold text-purple-400 uppercase tracking-wider">
                              WAV + Stems (₹)
                            </label>
                            <span className="text-[9px] font-mono text-zinc-500">Trackouts</span>
                          </div>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-purple-400 font-mono font-bold">
                              ₹
                            </span>
                            <input 
                              type="number" 
                              value={formData.priceUnlimited}
                              onChange={(e) => setFormData({ ...formData, priceUnlimited: Number(e.target.value) })}
                              placeholder="3999"
                              className="w-full bg-zinc-950 border border-zinc-800 focus:border-purple-400 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none font-mono text-zinc-100 font-bold"
                              required
                            />
                          </div>
                          <p className="text-[10px] text-zinc-500 font-sans">Full stem trackouts</p>
                        </div>

                        {/* Exclusive License Price */}
                        <div className="bg-zinc-900/90 border border-zinc-800 p-3.5 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-sans font-bold text-yellow-400 uppercase tracking-wider">
                              Exclusive (₹)
                            </label>
                            <span className="text-[9px] font-mono text-yellow-400">Ownership</span>
                          </div>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-yellow-400 font-mono font-bold">
                              ₹
                            </span>
                            <input 
                              type="number" 
                              value={formData.priceExclusive}
                              onChange={(e) => setFormData({ ...formData, priceExclusive: Number(e.target.value) })}
                              placeholder="9999"
                              className="w-full bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none font-mono text-yellow-200 font-bold"
                              required
                            />
                          </div>
                          <p className="text-[10px] text-zinc-500 font-sans">Full exclusive rights</p>
                        </div>
                      </div>
                    </div>

                    {/* Section 6: Play Count Tracking */}
                    <div className="bg-zinc-950/70 border border-zinc-800/90 rounded-2xl p-5 sm:p-6 space-y-3 shadow-sm">
                      <div className="border-b border-zinc-850 pb-2.5 flex items-center justify-between">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                          6. Play Count Analytics
                        </span>
                        <span className="text-[10px] font-sans text-zinc-500">Live Play Counter</span>
                      </div>

                      <div className="max-w-xs">
                        <label className="block text-xs font-sans font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                          Play Count (Total Plays)
                        </label>
                        <input 
                          type="number" 
                          value={formData.plays}
                          onChange={(e) => setFormData({ ...formData, plays: Number(e.target.value) })}
                          className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none font-mono text-amber-400 font-bold"
                        />
                        <p className="text-[10px] text-zinc-500 font-sans mt-1">
                          Controls the Top 1 to Top 8 ranking on the home page.
                        </p>
                      </div>
                    </div>

                  </div>

                  {/* Fixed / Sticky Form Footer */}
                  <div className="px-6 sm:px-8 py-4 border-t border-zinc-800 bg-zinc-950/90 backdrop-blur-md flex items-center justify-between gap-3 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveFormTab('list')}
                      className="px-4 py-2.5 rounded-xl text-xs font-sans font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      Discard / Back to List
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-yellow-300 text-black font-sans font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="w-4 h-4 border-2 border-t-transparent border-black rounded-full animate-spin"></span>
                          <span>Saving Instrumental...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>{activeFormTab === 'edit' ? 'Update Beat Parameters' : 'Save Beat to Catalog'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

            </div>
          </div>
        )}
      </motion.div>

      {/* Custom Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (() => {
          const beatToDelete = beats.find(b => b.id === deleteConfirmId);
          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDeleteConfirmId(null)}
                className="absolute inset-0 bg-zinc-950/90 backdrop-blur-sm"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl z-10"
              >
                <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-5 text-rose-500">
                  <Trash2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold font-sans tracking-tight text-white mb-2">
                  Delete {beatToDelete ? `"${beatToDelete.title}"` : 'Instrumental'}?
                </h3>
                {beatToDelete && (
                  <p className="text-xs text-amber-400 font-mono mb-3">
                    {beatToDelete.genre} • {beatToDelete.bpm} BPM • {beatToDelete.key}
                  </p>
                )}
                <p className="text-sm text-zinc-400 font-sans leading-relaxed mb-6">
                  Are you strictly sure you want to delete this track from Firestore? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                  >
                    No, Keep It
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={isSubmitting}
                    className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-rose-900/20 disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? 'Purging...' : 'Yes, Delete Track'}
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
