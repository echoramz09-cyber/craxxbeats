import { useEffect, useState, useRef, ChangeEvent } from 'react';
import { Track } from '../types';
import AudioEngine from '../utils/AudioEngine';
import AudioVisualizer from './AudioVisualizer';
import { Play, Pause, Volume2, VolumeX, RotateCcw, HelpCircle, Laptop, Radio, Tag, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseInstagram } from '../lib/settingsService';

interface CustomAudioPlayerProps {
  onOpenLicense?: (track: Track) => void;
  instagramLink?: string;
}

export default function CustomAudioPlayer({ onOpenLicense, instagramLink }: CustomAudioPlayerProps) {
  const igInfo = parseInstagram(instagramLink);
  const [playerState, setPlayerState] = useState({
    isPlaying: false,
    currentTrack: null as Track | null,
    volume: 0.8,
    progress: 0
  });

  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(0.8);
  const [isLooping, setIsLooping] = useState(true); // Loop by default since it plays continuous beautiful retro beats

  const [showCopyPopup, setShowCopyPopup] = useState(false);

  // Hook into AudioEngine state triggers
  useEffect(() => {
    const handleStateChange = (state: any) => {
      setPlayerState({
        isPlaying: state.isPlaying,
        currentTrack: state.currentTrack,
        volume: state.volume,
        progress: state.progress
      });
    };

    const unsubscribe = AudioEngine.subscribe(handleStateChange);
    return () => unsubscribe();
  }, []);

  const handleBuyNow = () => {
    if (!playerState.currentTrack) return;
    
    const track = playerState.currentTrack;

    if (onOpenLicense) {
      onOpenLicense(track);
      return;
    }
    
    const info = `I'm interested in licensing: "${track.title}"\nGenre: ${track.genre}\nTempo: ${track.bpm} BPM\nDuration: ${track.duration}`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(info).then(() => {
      setShowCopyPopup(true);
      setTimeout(() => setShowCopyPopup(false), 3000);
      
      // Redirect to Instagram DM after a short delay
      setTimeout(() => {
        window.open(igInfo.dmUrl, '_blank');
      }, 1000);
    });
  };

  const { isPlaying, currentTrack, volume, progress } = playerState;

  if (!currentTrack) return null;

  const parseDuration = (durationStr: string) => {
    if (!durationStr) return 180; // default 3 min
    const parts = durationStr.split(':').map(Number);
    if (parts.length === 2) {
      return (parts[0] * 60) + parts[1];
    }
    return 180;
  };

  const handlePlayPause = () => {
    AudioEngine.togglePlay(currentTrack);
  };

  const handleVolumeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setIsMuted(newVol === 0);
    AudioEngine.setVolume(newVol);
  };

  const handleMuteToggle = () => {
    if (isMuted) {
      AudioEngine.setVolume(previousVolume);
      setIsMuted(false);
    } else {
      setPreviousVolume(volume);
      AudioEngine.setVolume(0);
      setIsMuted(true);
    }
  };

  const handleRestart = () => {
    // Reset play positions
    AudioEngine.stop();
    AudioEngine.togglePlay(currentTrack);
  };

  const handleClose = () => {
    AudioEngine.stop();
  };

  // Format progress ticks to readable time (infinite loop progress simulation styled as bars)
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const durationSeconds = parseDuration(currentTrack.duration);
  const formattedProgress = formatTime(progress);
  const progressPercent = Math.min(100, (progress / durationSeconds) * 100);

  const handleSeek = (e: ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    AudioEngine.seek(newTime);
  };

  return (
    <motion.div 
      id="sticky-audio-player" 
      initial={{ y: 80, opacity: 0, x: '-50%' }}
      animate={{ y: 0, opacity: 1, x: '-50%' }}
      exit={{ y: 80, opacity: 0, x: '-50%' }}
      transition={{ type: 'spring', damping: 26, stiffness: 200 }}
      className="fixed bottom-3 sm:bottom-5 left-1/2 w-[94%] sm:w-[88%] md:w-[680px] max-w-[700px] bg-zinc-950/95 backdrop-blur-xl border border-zinc-800/90 rounded-2xl p-3 md:p-3.5 z-50 shadow-[0_14px_40px_rgba(0,0,0,0.85),0_0_25px_rgba(234,179,8,0.12)]"
    >
      <div className="flex flex-col gap-2.5 w-full">
        
        {/* Main Row: Track Info + Play/Pause Controls + Buy Action */}
        <div className="flex items-center justify-between gap-3 w-full">
          
          {/* Left: Track Artwork & Info */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <img 
              src={currentTrack.artwork} 
              alt={currentTrack.title} 
              className="w-10 h-10 md:w-11 md:h-11 rounded-xl object-cover border border-zinc-800 flex-shrink-0 animate-spin-slow"
              style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0 pr-1">
              <h4 className="text-white text-xs md:text-sm font-sans font-bold truncate tracking-tight">
                {currentTrack.title}
              </h4>
              <p className="text-[10px] text-zinc-500 font-mono truncate">
                {currentTrack.genre} • {currentTrack.bpm} BPM
              </p>
            </div>
          </div>

          {/* Center: Playback Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <button
              onClick={handleRestart}
              className="hidden sm:flex p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Restart"
              aria-label="Restart Beat"
            >
              <RotateCcw className="w-3.5 h-3.5 scale-x-[-1]" />
            </button>

            <button
              onClick={handlePlayPause}
              className="w-10 h-10 rounded-full bg-amber-400 hover:bg-yellow-300 hover:scale-105 active:scale-95 text-black flex items-center justify-center transition-all shadow-md shadow-amber-500/25"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black translate-x-0.5" />}
            </button>
          </div>

          {/* Right: Buy Button & Volume & Close */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button 
              onClick={handleBuyNow}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-amber-400 hover:bg-yellow-300 text-black font-sans font-black text-[11px] uppercase tracking-wider shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Tag className="w-3.5 h-3.5 fill-black" />
              <span>₹{(currentTrack.priceBasic || 999).toLocaleString()} • Buy</span>
            </button>

            {/* Volume toggle */}
            <div className="hidden md:flex items-center gap-1.5 pl-1">
              <button 
                onClick={handleMuteToggle} 
                className="text-zinc-500 hover:text-zinc-200 transition-colors"
                aria-label="Mute / Unmute"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05" 
                value={isMuted ? 0 : volume} 
                onChange={handleVolumeChange} 
                className="w-14 accent-amber-400 h-1 bg-zinc-900 rounded-lg cursor-pointer" 
              />
            </div>

            {/* Close / Cut Preview Cross Button */}
            <button
              onClick={handleClose}
              className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800/80 active:scale-90 rounded-lg transition-all"
              title="Close Preview"
              aria-label="Close Preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Timeline & Full-Width Equalizer Visualizer */}
        <div className="flex items-center gap-2.5 w-full text-zinc-500 text-[10px] font-mono group px-1">
          <span className="w-7 text-right">{formattedProgress}</span>
          
          <div className="flex-1 relative flex flex-col justify-center gap-1">
            {/* Audio Visualizer Waveform spanning the exact same width as timeline with energetic beat height */}
            <div className="w-full flex items-center justify-center h-6 sm:h-7 overflow-hidden rounded-md bg-black/25 px-1">
              <AudioVisualizer 
                barWidth={3} 
                gap={2.5} 
                className="w-full h-6 sm:h-7" 
              />
            </div>

            {/* Scrubber Progress Bar */}
            <div className="relative flex items-center h-3">
              <input 
                type="range"
                min="0"
                max={durationSeconds}
                step="0.1"
                value={progress}
                onChange={handleSeek}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                aria-label="Seek track position"
              />
              <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden relative">
                <motion.div 
                  className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-yellow-400 via-amber-400 to-amber-500"
                  initial={false}
                  animate={{ width: `${progressPercent}%` }}
                />
              </div>
              <div 
                className="absolute w-2.5 h-2.5 bg-amber-300 rounded-full shadow-[0_0_8px_rgba(234,179,8,0.9)] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ left: `calc(${progressPercent}% - 5px)` }}
              />
            </div>
          </div>

          <span className="w-7 text-zinc-400">{currentTrack.duration}</span>
        </div>

      </div>

      {/* Copy Confirmation Toast */}
      <AnimatePresence>
        {showCopyPopup && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: -20, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{ left: '50%', x: '-50%' }}
            className="absolute -top-14 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 bg-zinc-900 border border-amber-500/40 text-white rounded-xl shadow-2xl flex items-center gap-2.5 whitespace-nowrap"
          >
            <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
              <Tag className="w-3 h-3" />
            </div>
            <div className="font-sans">
              <p className="text-[10px] font-black text-white uppercase tracking-wider">Details Copied! Opening IG DM</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
