import { registerPlugin } from '@capacitor/core';

interface WidgetChartsPlugin {
  updateSnapshot(options: { daily: string }): Promise<void>;
  consumeLaunchTarget(): Promise<{ target: string; chartType: string; recordType: string }>;
}

export const WidgetCharts = registerPlugin<WidgetChartsPlugin>('WidgetCharts');
