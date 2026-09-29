import { registerPlugin } from '@capacitor/core';

interface WidgetChartsPlugin {
  updateSnapshot(options: { daily: string }): Promise<void>;
}

export const WidgetCharts = registerPlugin<WidgetChartsPlugin>('WidgetCharts');
