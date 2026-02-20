import { Audio } from 'expo-audio';

type SoundKey = 'chest_suspense' | 'chest_open' | 'chest_reveal';

const SOUND_ASSETS: Record<SoundKey, ReturnType<typeof require> | null> = {
  chest_suspense: null,
  chest_open: null,
  chest_reveal: null,
};

try {
  SOUND_ASSETS.chest_suspense = require('../../assets/sounds/chest_suspense.mp3');
} catch { /* asset not yet available */ }

try {
  SOUND_ASSETS.chest_open = require('../../assets/sounds/chest_open.mp3');
} catch { /* asset not yet available */ }

try {
  SOUND_ASSETS.chest_reveal = require('../../assets/sounds/chest_reveal.mp3');
} catch { /* asset not yet available */ }

const loadedSounds: Partial<Record<SoundKey, Audio.Sound>> = {};

async function ensureAudioMode() {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    });
  } catch {
    // non-critical
  }
}

export async function preloadSounds(): Promise<void> {
  await ensureAudioMode();
  for (const [key, asset] of Object.entries(SOUND_ASSETS)) {
    if (!asset) continue;
    try {
      const { sound } = await Audio.Sound.createAsync(asset);
      loadedSounds[key as SoundKey] = sound;
    } catch {
      // gracefully skip if asset can't load
    }
  }
}

export async function playSound(key: SoundKey): Promise<void> {
  const sound = loadedSounds[key];
  if (!sound) return;
  try {
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch {
    // non-critical
  }
}

export async function stopSound(key: SoundKey): Promise<void> {
  const sound = loadedSounds[key];
  if (!sound) return;
  try {
    await sound.stopAsync();
  } catch {
    // non-critical
  }
}

export async function unloadSounds(): Promise<void> {
  for (const sound of Object.values(loadedSounds)) {
    try {
      await sound?.unloadAsync();
    } catch {
      // non-critical
    }
  }
}
