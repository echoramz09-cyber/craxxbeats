import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, FileAudio, Layers, Sparkles, Crown, Instagram, Copy, ExternalLink, Music } from 'lucide-react';
import { Track } from '../types';
import { parseInstagram } from '../lib/settingsService';

interface LicenseModalProps {
  track: Track | null;
  isOpen: boolean;
  onClose: () => void;
  instagramLink?: string;
}

export default function LicenseModal({ track, isOpen, onClose, instagramLink }: LicenseModalProps) {
  const [selectedTierForConfirm, setSelectedTierForConfirm] = useState<{
    name: string;
    price: number;
    text: string;
  } | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  const igInfo = parseInstagram(instagramLink);

  if (!isOpen || !track) return null;

  const mp3Price = track.priceBasic || 999;
  const wavPrice = track.pricePremium || 1999;
  const stemsPrice = track.priceUnlimited || 3999;
  const exclusivePrice = track.priceExclusive || 9999;

  const licenses = [
    {
      id: 'mp3',
      name: 'MP3 License',
      price: mp3Price,
      format: 'Standard Untagged MP3 (320kbps)',
      icon: Music,
      badgeColor: 'border-zinc-750 bg-zinc-900/80 text-zinc-200',
      accentColor: 'text-amber-400',
      popular: false,
      features: [
        'Untagged 320kbps MP3 Audio File',
        'Up to 50,000 Audio Streams (Spotify, Apple, etc.)',
        '1 Music Video / Social Media Distribution',
        'Non-Exclusive Commercial Rights'
      ]
    },
    {
      id: 'wav',
      name: 'WAV License',
      price: wavPrice,
      format: 'Studio 24-bit Lossless WAV + MP3',
      icon: FileAudio,
      badgeColor: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
      accentColor: 'text-amber-400',
      popular: true,
      features: [
        'Lossless 24-bit WAV Master + Untagged MP3',
        'Up to 250,000 Audio Streams',
        'Radio Broadcasting & Live Performance Rights',
        'Commercial Monetization on All Platforms'
      ]
    },
    {
      id: 'stems',
      name: 'WAV + Stems License',
      price: stemsPrice,
      format: 'Full Trackout Stems + Master WAV + MP3',
      icon: Layers,
      badgeColor: 'border-purple-500/40 bg-purple-500/10 text-purple-300',
      accentColor: 'text-purple-400',
      popular: false,
      features: [
        'Individual Trackout Stems (Drums, Bass, Synths, FX)',
        'Unlimited Audio Streams & Video Views',
        'Full Arrangement & Mixing Freedom for Engineers',
        'Non-Exclusive Unlimited Commercial Rights'
      ]
    },
    {
      id: 'exclusive',
      name: 'Exclusive License',
      price: exclusivePrice,
      format: '100% Full Ownership Transfer',
      icon: Crown,
      badgeColor: 'border-yellow-400 bg-yellow-400/15 text-yellow-300',
      accentColor: 'text-yellow-400',
      popular: false,
      features: [
        '100% Exclusive Master Rights & Full Ownership',
        'Beat permanently removed from store catalog',
        'Unlimited Sync Licensing, TV, Film & Radio',
        'All Stems, WAV, MP3 + Official Signed Agreement'
      ]
    }
  ];

  const handleSelectLicense = (licenseName: string, price: number) => {
    const inquiryText = `Hi Craxx! I would like to purchase the "${licenseName}" for the beat "${track.title}" (₹${price.toLocaleString()}).\nTempo: ${track.bpm} BPM | Key: ${track.key} | Genre: ${track.genre}`;
    
    // Copy to clipboard immediately
    navigator.clipboard.writeText(inquiryText).catch(() => {});
    setHasCopied(true);

    // Open confirmation popup
    setSelectedTierForConfirm({
      name: licenseName,
      price,
      text: inquiryText
    });
  };

  const handleProceedToInstagram = () => {
    if (selectedTierForConfirm) {
      navigator.clipboard.writeText(selectedTierForConfirm.text).catch(() => {});
    }
    window.open(igInfo.dmUrl, '_blank');
    setSelectedTierForConfirm(null);
  };

  const handleCopyAgain = () => {
    if (selectedTierForConfirm) {
      navigator.clipboard.writeText(selectedTierForConfirm.text);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-zinc-950/90 backdrop-blur-md"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative bg-zinc-900 border border-zinc-800 w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white font-sans z-10 my-auto"
      >
        {/* Header with Track Details */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-5 sm:px-6 py-4 bg-zinc-950/70">
          <div className="flex items-center gap-3.5 min-w-0">
            <img 
              src={track.artwork} 
              alt={track.title} 
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover border border-zinc-800 flex-shrink-0 shadow-md"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                  Select License
                </span>
                <span className="text-[10px] font-mono text-zinc-500">
                  {track.genre} • {track.bpm} BPM • {track.key}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold font-sans tracking-tight text-white truncate mt-0.5">
                {track.title}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex-shrink-0 cursor-pointer"
            aria-label="Close licensing modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: 4 License Options */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(92vh-150px)] space-y-4">
          <div className="text-center sm:text-left mb-2">
            <p className="text-xs sm:text-sm text-zinc-400 font-sans">
              Choose your licensing tier below. All licenses include instant untagged delivery and commercial rights.
            </p>
          </div>

          {/* Licenses Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {licenses.map((lic) => {
              const Icon = lic.icon;
              return (
                <div 
                  key={lic.id}
                  className={`relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl border transition-all duration-200 ${
                    lic.popular 
                      ? 'bg-zinc-950/80 border-amber-400/50 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/30' 
                      : 'bg-zinc-950/50 border-zinc-800/80 hover:border-zinc-700'
                  }`}
                >
                  {/* Popular Badge */}
                  {lic.popular && (
                    <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full bg-amber-400 text-black font-sans font-black text-[9px] uppercase tracking-wider shadow-sm">
                      Most Popular
                    </span>
                  )}

                  {/* Top: License Name & Price in Rupees (₹) */}
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-xl border ${lic.badgeColor}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm sm:text-base font-bold font-sans text-white">
                            {lic.name}
                          </h4>
                          <p className="text-[10px] text-zinc-400 font-mono">
                            {lic.format}
                          </p>
                        </div>
                      </div>

                      {/* Price in Rupees */}
                      <div className="text-right flex-shrink-0">
                        <span className="text-lg sm:text-xl font-mono font-black text-amber-400">
                          ₹{lic.price.toLocaleString()}
                        </span>
                        <span className="block text-[9px] font-mono text-zinc-500 uppercase">INR</span>
                      </div>
                    </div>

                    {/* Features list */}
                    <ul className="mt-4 space-y-2 border-t border-zinc-850/80 pt-3 text-xs text-zinc-300 font-sans">
                      {lic.features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-2 text-[11px] leading-tight">
                          <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Bottom Action Button */}
                  <div className="mt-5 pt-3 border-t border-zinc-850/80">
                    <button
                      onClick={() => handleSelectLicense(lic.name, lic.price)}
                      className={`w-full py-2.5 px-4 rounded-xl font-sans font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer shadow-sm ${
                        lic.popular 
                          ? 'bg-amber-400 hover:bg-yellow-300 text-black font-black shadow-amber-500/20' 
                          : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700/60'
                      }`}
                    >
                      <Instagram className="w-3.5 h-3.5" />
                      <span>Get {lic.name} (₹{lic.price.toLocaleString()})</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer info & Direct DM Link */}
        <div className="border-t border-zinc-800/80 px-5 sm:px-6 py-3.5 bg-zinc-950/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-zinc-400 text-[11px] font-sans">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Need custom beat arrangement or inquiry? DM directly on Instagram</span>
          </div>

          <a 
            href={igInfo.dmUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 font-mono text-[11px] font-bold transition-colors"
          >
            <Instagram className="w-3 h-3" />
            <span>{igInfo.displayHandle}</span>
            <ExternalLink className="w-3 h-3 text-zinc-500" />
          </a>
        </div>

        {/* Toast alert on copy */}
        <AnimatePresence>
          {selectedTierForConfirm && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedTierForConfirm(null)}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm"
              />

              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ duration: 0.2 }}
                className="relative bg-zinc-900 border border-amber-400/40 w-full max-w-lg rounded-3xl shadow-2xl p-6 sm:p-7 text-white z-20 space-y-5 ring-1 ring-amber-400/20"
              >
                {/* Header Icon & Title */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-yellow-500 via-rose-500 to-purple-600 p-0.5 shadow-lg flex items-center justify-center">
                      <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
                        <Instagram className="w-6 h-6 text-rose-400" />
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400">
                        Instagram Direct Message
                      </span>
                      <h4 className="text-lg sm:text-xl font-bold font-sans tracking-tight text-white">
                        Order Details Ready!
                      </h4>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedTierForConfirm(null)}
                    className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Instructions Box */}
                <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2.5 text-emerald-400 text-xs font-sans font-bold">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-emerald-400" />
                    </div>
                    <span>Beat & license details copied to your clipboard!</span>
                  </div>

                  <p className="text-xs sm:text-sm text-zinc-300 font-sans leading-relaxed">
                    Instagram will open when you click <strong className="text-amber-400">OK</strong>. Check your clipboard and simply <strong className="text-white">paste (Ctrl+V / Paste)</strong> the message into the chat with <strong className="text-amber-400 font-mono">{igInfo.displayHandle}</strong>.
                  </p>

                  {/* Message Preview Box */}
                  <div className="mt-2 bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-[11px] font-mono text-zinc-400 relative">
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1 pb-1 border-b border-zinc-800 font-sans">
                      <span>Message Preview:</span>
                      <button
                        onClick={handleCopyAgain}
                        className="text-amber-400 hover:text-yellow-300 flex items-center gap-1 font-mono cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{hasCopied ? 'Copied!' : 'Copy again'}</span>
                      </button>
                    </div>
                    <p className="whitespace-pre-line text-zinc-300">
                      {selectedTierForConfirm.text}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-1">
                  <button
                    onClick={() => setSelectedTierForConfirm(null)}
                    className="w-full sm:w-1/3 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-sans font-bold text-xs transition-colors cursor-pointer text-center"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleProceedToInstagram}
                    className="w-full sm:w-2/3 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:brightness-105 text-black font-sans font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98] cursor-pointer"
                  >
                    <Instagram className="w-4 h-4 text-black" />
                    <span>OK, Open Instagram DM</span>
                    <ExternalLink className="w-3.5 h-3.5 text-black/70" />
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
