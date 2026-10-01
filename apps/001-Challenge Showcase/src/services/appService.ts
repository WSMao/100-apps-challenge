import type { AppManifest, GuestbookEntry } from '../types/app';
import {
  fetchRemoteAppStats,
  remoteIncrementLikes,
  remoteDecrementLikes,
  remoteIncrementViews,
  isSupabaseConfigured,
} from './supabaseService';

// 1. 自動掃描 apps/* 目錄下的所有 app-manifest.json
const manifestFiles = import.meta.glob<AppManifest>(
  ['../../../*/app-manifest.json', '../../app-manifest.json'],
  {
    import: 'default',
    eager: true,
  }
);

// 2. 自動掃描 apps/* 目錄下的所有 README.md 檔案以提供即時文件閱讀
const readmeFiles = import.meta.glob<string>(
  ['../../../*/README.md', '../../README.md'],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  }
);

/**
 * 解析所有子應用的 manifest 資料
 */
export function getAllApps(): AppManifest[] {
  const appMap = new Map<string, AppManifest>();

  for (const path in manifestFiles) {
    const rawData = manifestFiles[path];
    const manifest = (rawData && typeof rawData === 'object' && 'default' in rawData
      ? (rawData as { default: AppManifest }).default
      : rawData) as AppManifest;

    if (manifest && manifest.id && manifest.name) {
      appMap.set(manifest.id, {
        ...manifest,
        // 若圖片路徑為相對路徑，校正為合適的預覽路徑
        coverImage: manifest.coverImage?.startsWith('http')
          ? manifest.coverImage
          : manifest.coverImage?.startsWith('/')
          ? manifest.coverImage
          : `/${manifest.coverImage || 'assets/cover.svg'}`,
      });
    }
  }

  // 按照 ID 由小到大排序 (001, 002, ...)
  return Array.from(appMap.values()).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/**
 * 依據 appId 獲取對應的 README.md 內容
 */
export function getAppReadme(appId: string): string {
  // 1. 檢查路徑是否包含該 app 的目錄特徵
  for (const path in readmeFiles) {
    if (path.includes(`/${appId}-`) || path.includes(`/${appId}/`)) {
      return readmeFiles[path];
    }
  }

  // 2. 若為 001 且當前自身目錄有 ../../README.md
  if (appId === '001') {
    if (readmeFiles['../../README.md']) {
      return readmeFiles['../../README.md'];
    }
    const showcaseKey = Object.keys(readmeFiles).find(k => k.includes('Showcase') || k.includes('001'));
    if (showcaseKey) {
      return readmeFiles[showcaseKey];
    }
  }

  // 3. 容錯：若只有一個 README
  const keys = Object.keys(readmeFiles);
  if (keys.length === 1 && appId === '001') {
    return readmeFiles[keys[0]];
  }

  // 如果找不到，提供友善提示
  return `# 專案 #${appId} 文件\n\n目前尚未找到該專案的 README.md 文件。`;
}

// 本地存儲鍵名
const STORAGE_LIKES_KEY = '100apps_likes_v1';
const STORAGE_VIEWS_KEY = '100apps_views_v1';
const STORAGE_USER_LIKED_KEY = '100apps_user_liked_v1';
const STORAGE_GUESTBOOK_KEY = '100apps_guestbook_v1';

// 初始種子數據（讓頁面首次加載就生動且具參考性）
const INITIAL_LIKES: Record<string, number> = {
  '001': 18,
};

const INITIAL_VIEWS: Record<string, number> = {
  '001': 126,
};

const INITIAL_GUESTBOOK: GuestbookEntry[] = [
  {
    id: 'seed-1',
    author: '訪客 Alex',
    appId: '001',
    appName: '001-Challenge Showcase',
    content: '這個 100 Apps 挑戰太酷了！入口網站設計得很舒服，期待接下來的 99 個應用！🔥',
    createdAt: '2026-09-30 11:30',
  },
  {
    id: 'seed-2',
    author: '前端愛好者 Eric',
    appId: '001',
    appName: '001-Challenge Showcase',
    content: '許願未來能做一個「台灣電子發票整合查詢」或「SVG 漸層代碼產生器」的小工具！',
    createdAt: '2026-09-30 12:45',
  },
];

/**
 * 讀取各 App 的按讚與瀏覽反饋
 */
export function getFeedbackData(): {
  likes: Record<string, number>;
  views: Record<string, number>;
  userLiked: Record<string, boolean>;
} {
  try {
    const rawLikes = localStorage.getItem(STORAGE_LIKES_KEY);
    const rawViews = localStorage.getItem(STORAGE_VIEWS_KEY);
    const rawUserLiked = localStorage.getItem(STORAGE_USER_LIKED_KEY);

    return {
      likes: rawLikes ? JSON.parse(rawLikes) : { ...INITIAL_LIKES },
      views: rawViews ? JSON.parse(rawViews) : { ...INITIAL_VIEWS },
      userLiked: rawUserLiked ? JSON.parse(rawUserLiked) : {},
    };
  } catch {
    return {
      likes: { ...INITIAL_LIKES },
      views: { ...INITIAL_VIEWS },
      userLiked: {},
    };
  }
}

/**
 * 切換按讚狀態（增加或取消）
 */
export function toggleAppLike(appId: string): { likes: number; hasLiked: boolean } {
  const data = getFeedbackData();
  const currentlyLiked = !!data.userLiked[appId];
  const currentCount = data.likes[appId] ?? 0;

  let newCount: number;
  let newLikedState: boolean;

  if (currentlyLiked) {
    newCount = Math.max(0, currentCount - 1);
    newLikedState = false;
    // 遠端同步收回按讚
    if (isSupabaseConfigured) {
      remoteDecrementLikes(appId).catch((err: unknown) =>
        console.warn('[Supabase] Decrement likes failed:', err)
      );
    }
  } else {
    newCount = currentCount + 1;
    newLikedState = true;
    // 遠端同步增加按讚
    if (isSupabaseConfigured) {
      remoteIncrementLikes(appId).catch((err: unknown) =>
        console.warn('[Supabase] Increment likes failed:', err)
      );
    }
  }

  data.likes[appId] = newCount;
  data.userLiked[appId] = newLikedState;

  try {
    localStorage.setItem(STORAGE_LIKES_KEY, JSON.stringify(data.likes));
    localStorage.setItem(STORAGE_USER_LIKED_KEY, JSON.stringify(data.userLiked));
  } catch (e) {
    console.error('Failed to save like state:', e);
  }

  return { likes: newCount, hasLiked: newLikedState };
}

/**
 * 增加瀏覽次數
 */
export function recordAppView(appId: string): number {
  const data = getFeedbackData();
  const newCount = (data.views[appId] ?? 0) + 1;
  data.views[appId] = newCount;

  try {
    localStorage.setItem(STORAGE_VIEWS_KEY, JSON.stringify(data.views));
  } catch (e) {
    console.error('Failed to save view count:', e);
  }

  // 遠端同步增加瀏覽數
  if (isSupabaseConfigured) {
    remoteIncrementViews(appId).catch((err: unknown) =>
      console.warn('[Supabase] Increment views failed:', err)
    );
  }

  return newCount;
}

/**
 * 與遠端 Supabase 同步統計數據
 */
export async function syncFeedbackWithRemote(): Promise<{
  likes: Record<string, number>;
  views: Record<string, number>;
  userLiked: Record<string, boolean>;
}> {
  const local = getFeedbackData();
  if (!isSupabaseConfigured) {
    return local;
  }

  const remoteStats = await fetchRemoteAppStats();
  if (!remoteStats) {
    return local;
  }

  // 合併遠端真實數據（遠端統計數值作為主要來源，保留本地的使用者個人點讚狀態）
  const mergedLikes = { ...local.likes };
  const mergedViews = { ...local.views };

  for (const appId in remoteStats) {
    mergedLikes[appId] = remoteStats[appId].likes;
    mergedViews[appId] = remoteStats[appId].views;
  }

  try {
    localStorage.setItem(STORAGE_LIKES_KEY, JSON.stringify(mergedLikes));
    localStorage.setItem(STORAGE_VIEWS_KEY, JSON.stringify(mergedViews));
  } catch (e) {
    console.error('Failed to sync merged stats to localStorage:', e);
  }

  return {
    likes: mergedLikes,
    views: mergedViews,
    userLiked: local.userLiked,
  };
}

/**
 * 獲取留言板清單
 */
export function getGuestbookList(): GuestbookEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_GUESTBOOK_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_GUESTBOOK_KEY, JSON.stringify(INITIAL_GUESTBOOK));
      return INITIAL_GUESTBOOK;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_GUESTBOOK;
  }
}

/**
 * 新增一則留言或許願
 */
export function addGuestbookComment(entry: {
  author: string;
  content: string;
  appId?: string;
  appName?: string;
}): GuestbookEntry {
  const list = getGuestbookList();
  const newEntry: GuestbookEntry = {
    id: `guestbook-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    author: entry.author.trim() || '熱心訪客',
    content: entry.content.trim(),
    appId: entry.appId,
    appName: entry.appName,
    createdAt: new Date().toLocaleString('zh-TW', { hour12: false }),
  };

  const updated = [newEntry, ...list];
  try {
    localStorage.setItem(STORAGE_GUESTBOOK_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save guestbook entry:', e);
  }

  return newEntry;
}
