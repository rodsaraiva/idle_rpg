import { Audio } from 'expo-audio';
import { SOUND_ASSETS } from '../constants/assets';

type SoundKey = keyof typeof SOUND_ASSETS;

const loadedSounds: Partial<Record<string, Audio.Sound>> = {};

async function ensureAudioMode() {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    });
  } catch (error) {
    console.warn('SoundService: Could not set audio mode', error);
  }
}

export const SoundService = {
  async preload(): Promise<void> {
    await ensureAudioMode();
    
    const preloads = Object.entries(SOUND_ASSETS).map(async ([key, asset]) => {
      try {
        const { sound } = await Audio.Sound.createAsync(asset);
        loadedSounds[key] = sound;
      } catch (error) {
        console.warn(`SoundService: Failed to preload ${key}`, error);
      }
    });

    await Promise.all(preloads);
  },

  async play(key: SoundKey): Promise<void> {
    const sound = loadedSounds[key];
    if (!sound) return;

    try {
      await sound.setPositionAsync(0);
      await sound.playAsync();
    } catch (error) {
      console.warn(`SoundService: Error playing ${key}`, error);
    }
  },

  async stop(key: SoundKey): Promise<void> {
    const sound = loadedSounds[key];
    if (!sound) return;

    try {
      await sound.stopAsync();
    } catch (error) {
      // ignore
    }
  },

  async unload(): Promise<void> {
    const unloads = Object.values(loadedSounds).map(async (sound) => {
      try {
        await sound?.unloadAsync();
      } catch {
        // ignore
      }
    });
    await Promise.all(unloads);
  },
};

// Backward compatibility exports
export const preloadSounds = SoundService.preload;
export const playSound = (key: any) => SoundService.play(key.toUpperCase());
export const stopSound = (key: any) => SoundService.stop(key.toUpperCase());
export const unloadSounds = SoundService.unload;
