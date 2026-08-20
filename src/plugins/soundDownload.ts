import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface SoundDownloadProgress {
  id: string;
  bytes: number;
  total: number;
  percent: number;
}

interface SoundDownloadPlugin {
  download(options: { id: string; url: string; path: string }): Promise<void>;
  cancel(options: { id: string }): Promise<void>;
  addListener(eventName: 'downloadProgress', listener: (event: SoundDownloadProgress) => void): Promise<PluginListenerHandle>;
}

export const SoundDownload = registerPlugin<SoundDownloadPlugin>('SoundDownload');
