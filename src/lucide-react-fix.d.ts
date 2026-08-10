declare module 'lucide-react' {
  import * as React from 'react';

  export interface IconProps extends React.SVGProps<SVGSVGElement> {
    size?: string | number;
    color?: string;
    strokeWidth?: string | number;
  }

  export type Icon = React.ForwardRefExoticComponent<IconProps & React.RefAttributes<SVGSVGElement>>;

  // Define components for all icons used in the app
  export const Milk: Icon;
  export const Moon: Icon;
  export const Droplets: Icon;
  export const Scale: Icon;
  export const Plus: Icon;
  export const Minus: Icon;
  export const Trash2: Icon;
  export const Check: Icon;
  export const Sun: Icon;
  export const Calendar: Icon;
  export const BookOpen: Icon;
  export const BarChart2: Icon;
  export const Edit2: Icon;
  export const TrendingUp: Icon;
  export const Sparkles: Icon;
  export const Activity: Icon;
  export const Award: Icon;
  export const CheckCircle2: Icon;
  export const HelpCircle: Icon;
  export const AlertTriangle: Icon;
  export const Utensils: Icon;
  export const Settings: Icon;
  export const Clock3: Icon;
  export const CloudRain: Icon;
  export const Music2: Icon;
  export const Pause: Icon;
  export const Play: Icon;
  export const Radio: Icon;
  export const Repeat: Icon;
  export const Repeat1: Icon;
  export const SkipBack: Icon;
  export const SkipForward: Icon;
  export const Timer: Icon;
  export const Volume2: Icon;
  export const Waves: Icon;
  export const X: Icon;
  export const Bird: Icon;
  export const Database: Icon;
  export const Download: Icon;
  export const Upload: Icon;
  export const Info: Icon;
  export const RefreshCw: Icon;

  const icons: { [key: string]: Icon };
  export default icons;
}

// Injected by Vite `define` from package.json version
declare const __APP_VERSION__: string;
