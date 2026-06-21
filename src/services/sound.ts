import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { SOUND_ASSETS } from '../constants/assets';

type SoundKey = keyof typeof SOUND_ASSETS;

const players: Partial<Record<string, AudioPlayer>> = {};

export const SoundService = {
  async preload(): Promise<void> {
    try {
      await setAudioModeAsync({ playsInSilentMode: true, shouldRouteThroughEarpiece: false });
    } catch (error) {
      console.warn('SoundService: Could not set audio mode', error);
    }
    for (const [key, asset] of Object.entries(SOUND_ASSETS)) {
      try {
        players[key] = createAudioPlayer(asset);
      } catch (error) {
        console.warn(`SoundService: Failed to preload ${key}`, error);
      }
    }
  },

  play(key: SoundKey): void {
    const player = players[key as string];
    if (!player) return;
    try {
      player.seekTo(0);
      player.play();
    } catch (error) {
      console.warn(`SoundService: Error playing ${String(key)}`, error);
    }
  },

  stop(key: SoundKey): void {
    players[key as string]?.pause();
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

// Backward compatibility exports
export const preloadSounds = SoundService.preload;
export const playSound = (key: any) => SoundService.play(String(key).toUpperCase());
export const stopSound = (key: any) => SoundService.stop(String(key).toUpperCase());
export const unloadSounds = SoundService.unload;
