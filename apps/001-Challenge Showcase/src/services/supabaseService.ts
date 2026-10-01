import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl: string | undefined = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured: boolean = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project-id.supabase.co' &&
  !supabaseUrl.includes('placeholder')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured && supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface AppStatRecord {
  app_id: string;
  likes: number;
  views: number;
}

/**
 * 從 Supabase 取得全網即時累計統計數據
 */
export async function fetchRemoteAppStats(): Promise<Record<string, { likes: number; views: number }> | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('app_stats')
      .select('app_id, likes, views');

    if (error || !data) {
      console.warn('[Supabase] Failed to fetch stats:', error);
      return null;
    }

    const result: Record<string, { likes: number; views: number }> = {};
    (data as AppStatRecord[]).forEach((row: AppStatRecord) => {
      result[row.app_id] = {
        likes: row.likes ?? 0,
        views: row.views ?? 0,
      };
    });
    return result;
  } catch (err: unknown) {
    console.error('[Supabase] fetchRemoteAppStats error:', err);
    return null;
  }
}

/**
 * 遠端原子增加按讚
 */
export async function remoteIncrementLikes(appId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.rpc('increment_likes', { target_app_id: appId });
    if (error) {
      console.warn('[Supabase] RPC increment_likes error:', error);
      return false;
    }
    return true;
  } catch (err: unknown) {
    console.error('[Supabase] remoteIncrementLikes error:', err);
    return false;
  }
}

/**
 * 遠端原子收回按讚
 */
export async function remoteDecrementLikes(appId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.rpc('decrement_likes', { target_app_id: appId });
    if (error) {
      console.warn('[Supabase] RPC decrement_likes error:', error);
      return false;
    }
    return true;
  } catch (err: unknown) {
    console.error('[Supabase] remoteDecrementLikes error:', err);
    return false;
  }
}

/**
 * 遠端原子增加瀏覽數
 */
export async function remoteIncrementViews(appId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.rpc('increment_views', { target_app_id: appId });
    if (error) {
      console.warn('[Supabase] RPC increment_views error:', error);
      return false;
    }
    return true;
  } catch (err: unknown) {
    console.error('[Supabase] remoteIncrementViews error:', err);
    return false;
  }
}
