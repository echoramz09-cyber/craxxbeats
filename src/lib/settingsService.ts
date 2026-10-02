import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';

export interface SiteSettings {
  id: string;
  instagramLink: string;
  instagramHandle: string;
  producerName?: string;
  updatedAt?: string;
}

export interface InstagramInfo {
  handle: string;
  displayHandle: string;
  profileUrl: string;
  dmUrl: string;
  raw: string;
}

const SETTINGS_DOC_ID = 'general';
const COLLECTION_NAME = 'settings';
const LOCAL_STORAGE_KEY = 'craxx_site_settings';

export const DEFAULT_INSTAGRAM = 'craxxbeats.india';

export function parseInstagram(input?: string): InstagramInfo {
  if (!input || !input.trim()) {
    const defaultHandle = DEFAULT_INSTAGRAM;
    return {
      handle: defaultHandle,
      displayHandle: `@${defaultHandle}`,
      profileUrl: `https://instagram.com/${defaultHandle}`,
      dmUrl: `https://ig.me/m/${defaultHandle}`,
      raw: defaultHandle
    };
  }

  let cleaned = input.trim();

  // Strip leading and trailing slashes, spaces
  cleaned = cleaned.replace(/^\/+|\/+$/g, '');

  // If it's a URL, extract the path/username
  cleaned = cleaned
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^https?:\/\/(www\.)?ig\.me\/m\//i, '')
    .replace(/^instagram\.com\//i, '')
    .replace(/^ig\.me\/m\//i, '');

  // Remove query params or hashes (e.g. ?hl=en or /)
  cleaned = cleaned.split('?')[0].split('#')[0].replace(/\/+$/, '');

  // Strip @ prefix if present
  if (cleaned.startsWith('@')) {
    cleaned = cleaned.substring(1);
  }

  // Fallback if empty after stripping
  const finalHandle = cleaned.trim() || DEFAULT_INSTAGRAM;

  return {
    handle: finalHandle,
    displayHandle: `@${finalHandle}`,
    profileUrl: `https://instagram.com/${finalHandle}`,
    dmUrl: `https://ig.me/m/${finalHandle}`,
    raw: input.trim()
  };
}

export async function fetchSettings(): Promise<SiteSettings> {
  // First check localStorage for immediate render
  let localSettings: SiteSettings | null = null;
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      localSettings = JSON.parse(saved);
    }
  } catch (e) {
    // Ignore localStorage parse errors
  }

  try {
    const docRef = doc(db, COLLECTION_NAME, SETTINGS_DOC_ID);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data() as Partial<SiteSettings>;
      const parsed = parseInstagram(data.instagramLink || data.instagramHandle || DEFAULT_INSTAGRAM);
      const settings: SiteSettings = {
        id: SETTINGS_DOC_ID,
        instagramLink: data.instagramLink || parsed.raw,
        instagramHandle: parsed.handle,
        producerName: data.producerName || 'craxx',
        updatedAt: data.updatedAt || new Date().toISOString()
      };
      // Cache locally
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
      } catch (e) {}
      return settings;
    } else {
      // Document doesn't exist yet, return defaults
      const parsed = parseInstagram(DEFAULT_INSTAGRAM);
      const initialSettings: SiteSettings = {
        id: SETTINGS_DOC_ID,
        instagramLink: DEFAULT_INSTAGRAM,
        instagramHandle: parsed.handle,
        producerName: 'craxx',
        updatedAt: new Date().toISOString()
      };
      return localSettings || initialSettings;
    }
  } catch (error) {
    console.warn('Could not fetch settings from Firestore, using local fallback:', error);
    if (localSettings) {
      return localSettings;
    }
    const parsed = parseInstagram(DEFAULT_INSTAGRAM);
    return {
      id: SETTINGS_DOC_ID,
      instagramLink: DEFAULT_INSTAGRAM,
      instagramHandle: parsed.handle,
      producerName: 'craxx',
      updatedAt: new Date().toISOString()
    };
  }
}

export async function updateSettings(newSettings: Partial<SiteSettings>): Promise<SiteSettings> {
  const parsed = parseInstagram(newSettings.instagramLink || newSettings.instagramHandle);
  
  const payload: SiteSettings = {
    id: SETTINGS_DOC_ID,
    instagramLink: newSettings.instagramLink ? newSettings.instagramLink.trim() : parsed.raw,
    instagramHandle: parsed.handle,
    producerName: newSettings.producerName?.trim() || 'craxx',
    updatedAt: new Date().toISOString()
  };

  // Cache locally immediately so UI is always responsive
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {}

  try {
    const docRef = doc(db, COLLECTION_NAME, SETTINGS_DOC_ID);
    await setDoc(docRef, payload, { merge: true });
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${SETTINGS_DOC_ID}`);
    throw error;
  }
}
