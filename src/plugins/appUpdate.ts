import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

interface DownloadResult {
  path: string;
  paused: boolean;
  completed: boolean;
  bytes: number;
}

interface DownloadProgressEvent {
  bytes: number;
  contentLength: number;
  lengthComputable: boolean;
}

interface AppUpdatePlugin {
  downloadApk(options: { url: string; path: string }): Promise<DownloadResult>;
  pauseDownload(): Promise<void>;
  installApk(options: { path: string }): Promise<void>;
  addListener(eventName: 'downloadProgress', listener: (event: DownloadProgressEvent) => void): Promise<PluginListenerHandle>;
}

export const AppUpdate = registerPlugin<AppUpdatePlugin>('AppUpdate');
