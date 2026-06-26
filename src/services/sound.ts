import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { SOUND_ASSETS, type SoundKey } from '../constants/assets';

const players: Partial<Record<SoundKey, AudioPlayer>> = {};

export const SoundService = {
  async preload(): Promise<void> {
    try {
      await setAudioModeAsync({ playsInSilentMode: true, shouldRouteThroughEarpiece: false });
    } catch (error) {
      console.warn('SoundService: Could not set audio mode', error);
    }
    for (const [key, asset] of Object.entries(SOUND_ASSETS) as [SoundKey, any][]) {
      try {
        players[key] = createAudioPlayer(asset);
      } catch (error) {
        console.warn(`SoundService: Failed to preload ${key}`, error);
      }
    }
  },

  play(key: SoundKey): void {
    const player = players[key];
    if (!player) return;
    try {
      player.seekTo(0);
      player.play();
    } catch (error) {
      console.warn(`SoundService: Error playing ${key}`, error);
    }
  },

  stop(key: SoundKey): void {
    players[key]?.pause();
  },

  unload(): void {
    for (const player of Object.values(players)) {
      try {
        player?.remove();
      } catch {
        // ignore
      }
    }
  },
};

// Backward compatibility exports — tipados por SoundKey (call sites usam lowercase)
export const preloadSounds = () => SoundService.preload();
export const playSound = (key: SoundKey) => SoundService.play(key);
export const stopSound = (key: SoundKey) => SoundService.stop(key);
export const unloadSounds = () => SoundService.unload();
