import { registerPlugin } from '@capacitor/core';

interface AppUpdatePlugin {
  installApk(options: { path: string }): Promise<void>;
}

export const AppUpdate = registerPlugin<AppUpdatePlugin>('AppUpdate');
