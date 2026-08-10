import type { ActivityLog } from '../types/baby';

export const mockLogs: ActivityLog[] = [
  // 2026-07-07
  {
    id: 'log-7-1',
    babyId: 'baby-1',
    timestamp: '2026-07-07T08:00:00Z',
    logType: 'feeding',
    metadata: {
      pee: false,
      poop: false,
      feedingType: 'bottle',
      bottle: {
        volumeMl: 120,
        fluidType: 'formula'
      }
    }
  },
  {
    id: 'log-7-2',
    babyId: 'baby-1',
    timestamp: '2026-07-07T10:15:00Z',
    logType: 'sleep',
    metadata: {
      pee: false,
      poop: false,
      feedingType: 'breast', // dummy but satisfies type, wait: metadata has intersection, we can just supply optional values.
      startTime: '2026-07-07T10:15:00Z',
      endTime: '2026-07-07T11:30:00Z',
      durationMinutes: 75
    }
  },
  {
    id: 'log-7-3',
    babyId: 'baby-1',
    timestamp: '2026-07-07T12:00:00Z',
    logType: 'diaper',
    metadata: {
      feedingType: 'breast',
      pee: true,
      poop: true,
      poopColor: 'yellow',
      poopConsistency: 'normal'
    }
  },
  {
    id: 'log-7-4',
    babyId: 'baby-1',
    timestamp: '2026-07-07T13:30:00Z',
    logType: 'feeding',
    metadata: {
      pee: false,
      poop: false,
      feedingType: 'breast',
      breast: {
        leftMinutes: 12,
        rightMinutes: 10
      }
    }
  },
  {
    id: 'log-7-5',
    babyId: 'baby-1',
    timestamp: '2026-07-07T14:45:00Z',
    logType: 'diaper',
    metadata: {
      feedingType: 'breast',
      pee: true,
      poop: false
    }
  },
  {
    id: 'log-7-6',
    babyId: 'baby-1',
    timestamp: '2026-07-07T15:30:00Z',
    logType: 'feeding',
    metadata: {
      pee: false,
      poop: false,
      feedingType: 'solids',
      solids: {
        foodName: '南瓜泥',
        amount: '40g',
        reaction: 'none'
      }
    }
  },
  {
    id: 'log-7-7',
    babyId: 'baby-1',
    timestamp: '2026-07-07T16:00:00Z',
    logType: 'growth',
    metadata: {
      feedingType: 'breast',
      pee: false,
      poop: false,
      weightKg: 6.3,
      heightCm: 62.0,
      headCircumferenceCm: 41.0,
      temperatureC: 36.5
    }
  },

  // 2026-07-06
  {
    id: 'log-6-1',
    babyId: 'baby-1',
    timestamp: '2026-07-06T03:15:00Z',
    logType: 'feeding',
    metadata: {
      pee: false,
      poop: false,
      feedingType: 'bottle',
      bottle: {
        volumeMl: 100,
        fluidType: 'breastmilk'
      }
    }
  },
  {
    id: 'log-6-2',
    babyId: 'baby-1',
    timestamp: '2026-07-06T03:30:00Z',
    logType: 'diaper',
    metadata: {
      feedingType: 'breast',
      pee: true,
      poop: false
    }
  },
  {
    id: 'log-6-3',
    babyId: 'baby-1',
    timestamp: '2026-07-06T08:30:00Z',
    logType: 'feeding',
    metadata: {
      pee: false,
      poop: false,
      feedingType: 'breast',
      breast: {
        leftMinutes: 15,
        rightMinutes: 15
      }
    }
  },
  {
    id: 'log-6-4',
    babyId: 'baby-1',
    timestamp: '2026-07-06T09:30:00Z',
    logType: 'sleep',
    metadata: {
      pee: false,
      poop: false,
      feedingType: 'breast',
      startTime: '2026-07-06T09:30:00Z',
      endTime: '2026-07-06T11:00:00Z',
      durationMinutes: 90
    }
  },
  {
    id: 'log-6-5',
    babyId: 'baby-1',
    timestamp: '2026-07-06T12:30:00Z',
    logType: 'diaper',
    metadata: {
      feedingType: 'breast',
      pee: true,
      poop: true,
      poopColor: 'green',
      poopConsistency: 'watery'
    }
  },
  {
    id: 'log-6-6',
    babyId: 'baby-1',
    timestamp: '2026-07-06T14:00:00Z',
    logType: 'feeding',
    metadata: {
      pee: false,
      poop: false,
      feedingType: 'bottle',
      bottle: {
        volumeMl: 140,
        fluidType: 'formula'
      }
    }
  },
  {
    id: 'log-6-7',
    babyId: 'baby-1',
    timestamp: '2026-07-06T15:30:00Z',
    logType: 'sleep',
    metadata: {
      pee: false,
      poop: false,
      feedingType: 'breast',
      startTime: '2026-07-06T15:30:00Z',
      endTime: '2026-07-06T17:00:00Z',
      durationMinutes: 90
    }
  },
  {
    id: 'log-6-8',
    babyId: 'baby-1',
    timestamp: '2026-07-06T18:00:00Z',
    logType: 'feeding',
    metadata: {
      pee: false,
      poop: false,
      feedingType: 'solids',
      solids: {
        foodName: '大米米粉',
        amount: '30g',
        reaction: 'none'
      }
    }
  },
  {
    id: 'log-6-9',
    babyId: 'baby-1',
    timestamp: '2026-07-06T20:30:00Z',
    logType: 'sleep',
    metadata: {
      pee: false,
      poop: false,
      feedingType: 'breast',
      startTime: '2026-07-06T20:30:00Z',
      endTime: '2026-07-06T22:30:00Z',
      durationMinutes: 120
    }
  },

  // 2026-07-05
  {
    id: 'log-5-1',
    babyId: 'baby-1',
    timestamp: '2026-07-05T08:00:00Z',
    logType: 'feeding',
    metadata: {
      pee: false,
      poop: false,
      feedingType: 'bottle',
      bottle: {
        volumeMl: 130,
        fluidType: 'formula'
      }
    }
  },
  {
    id: 'log-5-2',
    babyId: 'baby-1',
    timestamp: '2026-07-05T09:00:00Z',
    logType: 'sleep',
    metadata: {
      pee: false,
      poop: false,
      feedingType: 'breast',
      startTime: '2026-07-05T09:00:00Z',
      endTime: '2026-07-05T10:30:00Z',
      durationMinutes: 90
    }
  },
  {
    id: 'log-5-3',
    babyId: 'baby-1',
    timestamp: '2026-07-05T12:00:00Z',
    logType: 'diaper',
    metadata: {
      feedingType: 'breast',
      pee: true,
      poop: true,
      poopColor: 'brown',
      poopConsistency: 'hard'
    }
  },
  {
    id: 'log-5-4',
    babyId: 'baby-1',
    timestamp: '2026-07-05T13:00:00Z',
    logType: 'feeding',
    metadata: {
      pee: false,
      poop: false,
      feedingType: 'breast',
      breast: {
        leftMinutes: 10,
        rightMinutes: 12
      }
    }
  },
  {
    id: 'log-5-5',
    babyId: 'baby-1',
    timestamp: '2026-07-05T15:00:00Z',
    logType: 'sleep',
    metadata: {
      pee: false,
      poop: false,
      feedingType: 'breast',
      startTime: '2026-07-05T15:00:00Z',
      endTime: '2026-07-05T16:30:00Z',
      durationMinutes: 90
    }
  },
  {
    id: 'log-5-6',
    babyId: 'baby-1',
    timestamp: '2026-07-05T17:30:00Z',
    logType: 'feeding',
    metadata: {
      pee: false,
      poop: false,
      feedingType: 'bottle',
      bottle: {
        volumeMl: 120,
        fluidType: 'formula'
      }
    }
  },
  {
    id: 'log-5-7',
    babyId: 'baby-1',
    timestamp: '2026-07-05T20:00:00Z',
    logType: 'sleep',
    metadata: {
      pee: false,
      poop: false,
      feedingType: 'breast',
      startTime: '2026-07-05T20:00:00Z',
      endTime: '2026-07-05T21:30:00Z',
      durationMinutes: 90
    }
  },
  {
    id: 'log-5-8',
    babyId: 'baby-1',
    timestamp: '2026-07-05T22:00:00Z',
    logType: 'growth',
    metadata: {
      feedingType: 'breast',
      pee: false,
      poop: false,
      weightKg: 6.2,
      heightCm: 61.5,
      headCircumferenceCm: 40.8,
      temperatureC: 36.6
    }
  }
];
