import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

interface BackNavigationPlugin {
  setIntercepting(options: { enabled: boolean }): Promise<void>;
  addListener(eventName: 'backPressed', listener: () => void): Promise<PluginListenerHandle>;
}

export const BackNavigation = registerPlugin<BackNavigationPlugin>('BackNavigation');
