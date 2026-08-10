export type LogType = 'feeding' | 'sleep' | 'diaper' | 'growth';

export type TimeInferenceMode = 'start' | 'end';

export type FeedingType = 'breast' | 'bottle' | 'solids';

export interface BreastFeedingMetadata {
  leftMinutes: number;
  rightMinutes: number;
}

export interface BottleFeedingMetadata {
  volumeMl: number;
  fluidType: 'formula' | 'breastmilk';
}

export interface SolidsMetadata {
  foodName: string;
  amount: string; // e.g. "50g", "3 spoonfuls"
  reaction: 'none' | 'mild' | 'severe';
}

export interface FeedingMetadata {
  feedingType: FeedingType;
  breast?: BreastFeedingMetadata;
  bottle?: BottleFeedingMetadata;
  solids?: SolidsMetadata;
}

export interface SleepMetadata {
  startTime: string; // ISO string
  endTime?: string;  // ISO string (undefined/null indicates sleep is active)
  durationMinutes?: number;
}

export interface DiaperMetadata {
  pee: boolean;
  poop: boolean;
  poopColor?: 'yellow' | 'green' | 'brown' | 'other';
  poopConsistency?: 'watery' | 'normal' | 'hard';
}

export interface GrowthMetadata {
  weightKg?: number;
  heightCm?: number;
  headCircumferenceCm?: number;
  temperatureC?: number;
}

export interface ActivityLog {
  id: string;
  babyId: string;
  timestamp: string; // ISO string
  logType: LogType;
  metadata: Partial<FeedingMetadata & SleepMetadata & DiaperMetadata & GrowthMetadata>;
}

export interface GuideAgeStage {
  id: string;
  ageRange: string; // e.g., "新生儿 (0-28天)"
  milkRequirement: {
    amountDesc: string; // e.g., "每次 30-90ml"
    frequencyDesc: string; // e.g., "每2-3小时一次，每天8-12次"
    breastfeedingTips: string; // e.g., "按需喂养，单侧吸吮15-20分钟"
  };
  solidsGuide?: {
    stageTitle: string; // e.g., "尝试泥糊状食物"
    textureDesc: string; // e.g., "细腻的十倍粥、蔬菜泥、水果泥"
    allergenChecklist: string[]; // e.g., ["蛋黄", "小麦"]
    tips: string; // e.g., "每次只添加一种新食物，观察3天"
  };
  vaccineGuide?: {
    title: string;
    vaccines: { name: string; age: string; note?: string }[];
  };
  milestones: {
    grossMotor: string[]; // 大动作
    fineMotor: string[]; // 精细动作
    languageSocial: string[]; // 语言与社交
  };
}
