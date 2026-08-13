import { registerPlugin } from '@capacitor/core';

interface BackgroundState {
  trackId: string;
  positionMs: number;
  playing: boolean;
}

interface BackgroundAudioPlugin {
  start(options: { urls: string[]; trackIds: string[]; index: number; positionMs: number; loopMode: 'track' | 'list' | 'once'; volume: number }): Promise<void>;
  stop(): Promise<BackgroundState>;
}

export const BackgroundAudio = registerPlugin<BackgroundAudioPlugin>('BackgroundAudio');
