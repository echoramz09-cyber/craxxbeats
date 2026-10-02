import { useState, useEffect, useRef } from 'react';
import { Track } from './types';
import { fetchBeats, incrementBeatPlay } from './lib/beatService';
import { fetchGenres, Genre } from './lib/genreService';
import { fetchSettings, DEFAULT_INSTAGRAM } from './lib/settingsService';
import AudioEngine from './utils/AudioEngine';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Sparkles } from 'lucide-react';

// Import UI sub-components
import Header from './components/Header';
import Hero from './components/Hero';
import TrackList from './components/TrackList';
import Footer from './components/Footer';
import CustomAudioPlayer from './components/CustomAudioPlayer';
import AdminPanel from './components/AdminPanel';
import LoadingScreen from './components/LoadingScreen';
import LicenseModal from './components/LicenseModal';

const COSMIC_PARTICLES = [
  { id: 1, size: 6, left: "8%", top: "12%", delay: 0, duration: 18, color: "#d946ef", driftX: [0, 60, -40, 0], driftY: [0, -50, 70, 0] },
  { id: 2, size: 8, left: "85%", top: "8%", delay: 0.5, duration: 25, color: "#a855f7", driftX: [0, -70, 50, 0], driftY: [0, 70, -50, 0] },
  { id: 3, size: 5, left: "25%", top: "35%", delay: 1, duration: 16, color: "#3b82f6", driftX: [0, 50, -50, 0], driftY: [0, -60, 50, 0] },
  { id: 4, size: 7, left: "78%", top: "58%", delay: 0.2, duration: 22, color: "#f43f5e", driftX: [0, -55, 45, 0], driftY: [0, 60, -55, 0] },
  { id: 5, size: 6, left: "12%", top: "72%", delay: 1.2, duration: 19, color: "#06b6d4", driftX: [0, 55, -55, 0], driftY: [0, -45, 55, 0] },
  { id: 6, size: 9, left: "45%", top: "22%", delay: 2.5, duration: 28, color: "#ec4899", driftX: [0, -75, 65, 0], driftY: [0, 50, -70, 0] },
  { id: 7, size: 5, left: "92%", top: "28%", delay: 0.8, duration: 20, color: "#a855f7", driftX: [0, -45, 45, 0], driftY: [0, 55, -55, 0] },
  { id: 8, size: 8, left: "40%", top: "78%", delay: 3, duration: 23, color: "#e879f9", driftX: [0, 50, -50, 0], driftY: [0, -60, 40, 0] },
  { id: 9, size: 6, left: "18%", top: "48%", delay: 1.8, duration: 17, color: "#22d3ee", driftX: [0, -50, 50, 0], driftY: [0, 45, -50, 0] },
  { id: 10, size: 7, left: "62%", top: "50%", delay: 2.2, duration: 26, color: "#ca8a04", driftX: [0, 60, -45, 0], driftY: [0, -60, 45, 0] },
  { id: 11, size: 5, left: "75%", top: "82%", delay: 1.4, duration: 24, color: "#f43f5e", driftX: [0, -50, 45, 0], driftY: [0, 55, -45, 0] },
  { id: 12, size: 8, left: "5%", top: "90%", delay: 2.8, duration: 21, color: "#8b5cf6", driftX: [0, 45, -45, 0], driftY: [0, -50, 50, 0] },
  { id: 13, size: 6, left: "55%", top: "68%", delay: 3.2, duration: 27, color: "#3b82f6", driftX: [0, -55, 55, 0], driftY: [0, 45, -55, 0] },
  { id: 14, size: 7, left: "90%", top: "92%", delay: 0.4, duration: 23, color: "#ec4899", driftX: [0, -40, 40, 0], driftY: [0, 50, -50, 0] },
  { id: 15, size: 5, left: "50%", top: "5%", delay: 4, duration: 30, color: "#06b6d4", driftX: [0, 65, -65, 0], driftY: [0, -55, 65, 0] },
];

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dynamic beats list state from Firestore
  const [tracks, setTracks] = useState<Track[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(true);
  const [selectedLicenseTrack, setSelectedLicenseTrack] = useState<Track | null>(null);
  const [instagramLink, setInstagramLink] = useState(DEFAULT_INSTAGRAM);

  // Load catalog data from Firestore
  const loadCatalogData = async () => {
    setIsLoadingTracks(true);
    try {
      const [liveTracks, liveGenres, liveSettings] = await Promise.all([
        fetchBeats(),
        fetchGenres(),
        fetchSettings()
      ]);
      setTracks(liveTracks);
      setGenres(liveGenres);
      if (liveSettings?.instagramLink) {
        setInstagramLink(liveSettings.instagramLink);
      }
    } catch (e) {
      console.error("Failed to sync catalog:", e);
    } finally {
      setIsLoadingTracks(false);
    }
  };

  const handleSettingsRefresh = async () => {
    try {
      const updated = await fetchSettings();
      if (updated?.instagramLink) {
        setInstagramLink(updated.instagramLink);
      }
    } catch (e) {
      console.error("Failed to refresh settings:", e);
    }
  };

  useEffect(() => {
    loadCatalogData();
  }, []);

  const recordedPlayTrackIdRef = useRef<string | null>(null);

  const recordPlay = (trackId: string) => {
    // Increment in Firestore
    incrementBeatPlay(trackId);
    // Update local state in real-time
    setTracks(prev =>
      prev.map(t => (t.id === trackId ? { ...t, plays: (t.plays || 0) + 1 } : t))
    );
  };

  // Sync isPlaying & activeTrack with state changes from the central AudioEngine singleton
  useEffect(() => {
    const handleEngineChange = (state: any) => {
      setIsPlaying(state.isPlaying);
      setActiveTrack(state.currentTrack);

      if (state.isPlaying && state.currentTrack?.id) {
        if (recordedPlayTrackIdRef.current !== state.currentTrack.id) {
          recordedPlayTrackIdRef.current = state.currentTrack.id;
          recordPlay(state.currentTrack.id);
        }
      } else if (!state.isPlaying) {
        recordedPlayTrackIdRef.current = null;
      }
    };

    const unsubscribe = AudioEngine.subscribe(handleEngineChange);
    return () => unsubscribe();
  }, []);

  // Play controls
  const handlePlayToggle = (track: Track) => {
    if (!isPlaying || activeTrack?.id !== track.id) {
      recordPlay(track.id);
    }
    AudioEngine.togglePlay(track);
  };

  // Top 1 to Top 8 beats ranked dynamically by play count
  const topTracks = [...tracks]
    .sort((a, b) => {
      const playsA = typeof a.plays === 'number' ? a.plays : 0;
      const playsB = typeof b.plays === 'number' ? b.plays : 0;
      return playsB - playsA;
    })
    .slice(0, 8);

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-purple-600 selection:text-white flex flex-col justify-between transition-colors duration-500 relative">
      
      {/* Immersive Background Image Layer - Optimized for performance */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div 
          className="absolute inset-0 opacity-[0.12] grayscale contrast-[1.1] will-change-transform"
          style={{
            backgroundImage: 'url("https://images.unsplash.com/photo-1598653222000-6b7b7a552625?auto=format&fit=crop&q=80&w=1280")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
        {/* Dark Vignette Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(9,9,11,0.88)_100%)]" />
      </div>
      
      <AnimatePresence mode="wait">
        {isLoadingTracks && <LoadingScreen key="loader" />}
      </AnimatePresence>

      {/* Dynamic Ambient Background Light Leaks - Optimized GPU layers */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Soft Pink cosmic leak top left */}
        <motion.div 
          animate={{
            x: [-40, 60, -40],
            y: [-30, 45, -30],
            scale: [1, 1.25, 1],
            opacity: [0.15, 0.22, 0.15],
          }}
          transition={{
            duration: 16,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ willChange: "transform, opacity" }}
          className="absolute -top-40 -left-40 w-[450px] h-[450px] rounded-full bg-pink-500/15 blur-[120px]"
        />

        {/* Purple Space Glow Center Right */}
        <motion.div 
          animate={{
            x: [30, -40, 30],
            y: [60, -30, 60],
            scale: [1.15, 0.9, 1.15],
            opacity: [0.12, 0.20, 0.12],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ willChange: "transform, opacity" }}
          className="absolute top-1/4 -right-20 w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[140px]"
        />

        {/* Lens-flare horizontal light leak bar */}
        <motion.div
          animate={{
            y: [-120, 1200, -120],
            opacity: [0.03, 0.1, 0.03],
          }}
          transition={{
            duration: 28,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ willChange: "transform, opacity" }}
          className="absolute inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-purple-500/20 to-transparent blur-[35px]"
        />
      </div>

      {/* Floating Glowing Cosmic Particles Overlay - Optimized count for mobile */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
        {COSMIC_PARTICLES.slice(0, typeof window !== 'undefined' && window.innerWidth < 768 ? 6 : 15).map((particle) => (
          <motion.div
            key={particle.id}
            initial={{ 
              left: particle.left, 
              top: particle.top, 
              opacity: 0,
              scale: 0.6
            }}
            animate={{
              x: particle.driftX,
              y: particle.driftY,
              opacity: [0.5, 0.9, 0.5],
              scale: [0.9, 1.3, 0.9]
            }}
            transition={{
              duration: particle.duration,
              delay: particle.delay,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              backgroundColor: particle.color,
              boxShadow: `0 0 14px 3px ${particle.color}`,
              borderRadius: "50%",
              position: "absolute",
              willChange: "transform, opacity"
            }}
          />
        ))}
      </div>

      {/* Upper Navigation Header */}
      <Header 
        searchQuery={searchQuery} 
        setSearchQuery={setSearchQuery} 
        tracks={tracks}
        isPlaying={isPlaying}
        activeTrackId={activeTrack?.id}
        onPlayToggle={handlePlayToggle}
      />

      {/* Main Core Body */}
      <main className="flex-grow pt-20 pb-12 relative z-10">
        
        {/* Banner/Hero Section */}
        <Hero 
          topTracks={topTracks}
          isPlaying={isPlaying}
          activeTrackId={activeTrack?.id}
          onPlayToggle={handlePlayToggle}
        />

        {/* Beats Selector Section */}
        <TrackList 
          tracks={tracks}
          genresList={genres}
          onPlayToggle={handlePlayToggle}
          activeTrackId={activeTrack?.id}
          isPlaying={isPlaying}
          searchQuery={searchQuery}
          onOpenLicense={(track) => setSelectedLicenseTrack(track)}
        />

      </main>

       {/* Contract comparison & Message grids */}
       <div className="relative z-10 w-full">
         <Footer 
           onAdminClick={() => setIsAdminOpen(true)}
           instagramLink={instagramLink}
         />
       </div>
 
       {/* Admin Panel Console Overlay Drawer */}
       <AdminPanel 
         isOpen={isAdminOpen} 
         onClose={() => setIsAdminOpen(false)} 
         onCatalogRefresh={loadCatalogData} 
         onSettingsRefresh={handleSettingsRefresh}
       />

      {/* Sticky Player HUD */}
      <CustomAudioPlayer 
        onOpenLicense={(track) => setSelectedLicenseTrack(track)}
        instagramLink={instagramLink}
      />

      {/* Licensing Tiers Popup Modal (MP3, WAV, WAV+Stems, Exclusive in ₹) */}
      <LicenseModal 
        track={selectedLicenseTrack}
        isOpen={!!selectedLicenseTrack}
        onClose={() => setSelectedLicenseTrack(null)}
        instagramLink={instagramLink}
      />

    </div>
  );
}
