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

  return `# ${appId} Documentation\n\n尚無說明文件。`;
}

// ==========================================
// 互動統計數據（愛心按讚、瀏覽計數、留言許願板）
// ==========================================

const STORAGE_LIKES_KEY = 'showcase_app_likes_v1';
const STORAGE_VIEWS_KEY = 'showcase_app_views_v1';
const STORAGE_USER_LIKED_KEY = 'showcase_user_liked_v1';
const STORAGE_GUESTBOOK_KEY = 'showcase_guestbook_comments_v1';
const STORAGE_LAST_VIEW_KEY = 'showcase_app_last_view_timestamps_v1';

/**
 * 瀏覽計數冷卻時間（預設 5 分鐘，同一使用者/瀏覽器在 5 分鐘內重複點擊同一個 App 不重複計算）
 */
export const VIEW_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * 檢查特定 App 是否已度過瀏覽冷卻期
 */
export function canRecordView(appId: string): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_LAST_VIEW_KEY);
    const timestamps: Record<string, number> = raw ? JSON.parse(raw) : {};
    const lastTime = timestamps[appId] || 0;
    return Date.now() - lastTime >= VIEW_COOLDOWN_MS;
  } catch {
    return true;
  }
}

/**
 * 記錄 App 本次被瀏覽的時間戳記
 */
function updateLastViewTimestamp(appId: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_LAST_VIEW_KEY);
    const timestamps: Record<string, number> = raw ? JSON.parse(raw) : {};
    timestamps[appId] = Date.now();
    localStorage.setItem(STORAGE_LAST_VIEW_KEY, JSON.stringify(timestamps));
  } catch (e) {
    console.error('Failed to update last view timestamp:', e);
  }
}

// 初始種子數據
const INITIAL_LIKES: Record<string, number> = {
  '001': 18,
};

const INITIAL_VIEWS: Record<string, number> = {
  '001': 126,
};

const INITIAL_GUESTBOOK: GuestbookEntry[] = [
  {
    id: 'seed-1',
    author: 'Leo (前端工程師)',
    appId: '001',
    appName: '001-Challenge Showcase',
    content: '這個 Showcase 入口網站的資料驅動架構很棒！期待後續 100 款應用推出！🎉',
    createdAt: '2026-09-30 09:30',
  },
  {
    id: 'seed-2',
    author: 'Alice',
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
 * 增加瀏覽次數（具備 5 分鐘冷卻防刷保護）
 * @param appId App 編號
 * @param force 是否忽略冷卻期強制累計（預設 false）
 * @returns 當前或累計後的瀏覽次數
 */
export function recordAppView(appId: string, force = false): number {
  const data = getFeedbackData();

  // 若在 5 分鐘冷卻期間內且非強制更新，直接回傳當前次數，不重複累計與發送請求
  if (!force && !canRecordView(appId)) {
    return data.views[appId] ?? 0;
  }

  const newCount = (data.views[appId] ?? 0) + 1;
  data.views[appId] = newCount;

  try {
    localStorage.setItem(STORAGE_VIEWS_KEY, JSON.stringify(data.views));
  } catch (e) {
    console.error('Failed to save view count:', e);
  }

  // 更新最後造訪時間戳記
  updateLastViewTimestamp(appId);

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
 * 將訪客免帳號留言發送至 Vercel API，由 GitHub Bot 寫入對應 Discussion 討論串
 */
export async function sendGuestCommentToGithub(params: {
  term: string;
  author: string;
  content: string;
}): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch('/api/guest-comment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        message: data.error || data.details?.[0]?.message || '發送失敗，請稍後再試',
      };
    }

    return { success: true };
  } catch (err: unknown) {
    console.error('Failed to send guest comment to API:', err);
    return {
      success: false,
      message: err instanceof Error ? err.message : '連線逾時或網路錯誤',
    };
  }
}

