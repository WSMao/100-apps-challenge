export type AppStatus = 'in-progress' | 'completed' | 'planned' | 'archived';

export interface AppManifest {
  id: string;
  name: string;
  description: string;
  tags: string[];
  platform: 'Web' | 'Desktop' | 'Mobile' | 'CLI' | 'Cross-platform' | string;
  status: AppStatus;
  demoUrl?: string;
  docUrl?: string;
  coverImage?: string;
}

export interface AppFeedback {
  likes: number;
  views: number;
  hasLiked?: boolean;
}

export interface GuestbookEntry {
  id: string;
  author: string;
  appId?: string; // 可指定是針對哪個 App，或全站回饋
  appName?: string;
  content: string;
  createdAt: string;
}
