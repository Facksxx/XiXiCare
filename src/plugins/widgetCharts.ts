import { registerPlugin } from '@capacitor/core';

interface WidgetChartsPlugin {
  updateSnapshot(options: { daily: string }): Promise<void>;
  consumeLaunchTarget(): Promise<{ target: string; chartType: string }>;
  requestPinWidget(options: { kind: 'native' | 'vivo' }): Promise<{ supported: boolean; requested: boolean }>;
}

export const WidgetCharts = registerPlugin<WidgetChartsPlugin>('WidgetCharts');
