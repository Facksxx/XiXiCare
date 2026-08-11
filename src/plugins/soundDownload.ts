import { registerPlugin } from '@capacitor/core';

interface SoundDownloadPlugin {
  download(options: { id: string; url: string; path: string }): Promise<void>;
  cancel(options: { id: string }): Promise<void>;
}

export const SoundDownload = registerPlugin<SoundDownloadPlugin>('SoundDownload');
