import { useState, useEffect, FormEvent } from 'react';
import { Mail, Instagram, Youtube, Radio, Check, Send, Heart, Sparkles, Shield } from 'lucide-react';
import { PRODUCER_PROFILE } from '../data';
import { parseInstagram } from '../lib/settingsService';
import { motion } from 'motion/react';

interface FooterProps {
  onAdminClick?: () => void;
  instagramLink?: string;
}

export default function Footer({ onAdminClick, instagramLink }: FooterProps) {
  const igInfo = parseInstagram(instagramLink);
  const [formData, setFormData] = useState({ name: '', email: '', subject: 'Custom Beat Inquiry', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) return;
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      setFormData({ name: '', email: '', subject: 'Custom Beat Inquiry', message: '' });
      setTimeout(() => setSubmitted(false), 5000);
    }, 1200);
  };

  return (
    <footer className="bg-zinc-950 border-t border-zinc-900 pb-36 pt-16">
      
      {/* Base footer lines */}
      <div className="max-w-7xl mx-auto px-6 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-zinc-650 text-[10px] font-sans font-bold uppercase tracking-wider">
        <div className="flex items-center gap-1.5 font-sans font-bold">
          <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>© 2026 craxx. All licensing rights reserved.</span>
        </div>

        <div className="flex items-center gap-4">
          <a 
            href={igInfo.profileUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-amber-400 text-zinc-400 transition-colors"
          >
            <Instagram className="w-3.5 h-3.5 text-amber-400" />
            <span>{igInfo.displayHandle}</span>
          </a>

          {onAdminClick && (
            <button 
              type="button" 
              onClick={onAdminClick}
              className="flex items-center gap-1.5 hover:text-amber-400 transition-colors cursor-pointer group"
            >
              <Shield className="w-3.5 h-3.5 text-amber-500 group-hover:text-amber-400 transition-colors" />
              <span>Admin Portal</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 font-sans font-bold uppercase tracking-wider">
          <span>Forged in sonic obsidian</span>
          <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
          <span>Frequency perfected</span>
        </div>
      </div>

    </footer>
  );
}
