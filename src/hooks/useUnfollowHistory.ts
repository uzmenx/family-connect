import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UnfollowRecord {
  id: string;
  unfollowed_user_id: string;
  created_at: string;
  profile?: { name: string | null; username: string | null; avatar_url: string | null };
}

export const useUnfollowHistory = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<UnfollowRecord[]>([]);

  const fetchHistory = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('unfollow_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data && data.length > 0) {
      const userIds = data.map(d => d.unfollowed_user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .in('id', userIds);
      
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      setHistory(data.map(d => ({ ...d, profile: profileMap.get(d.unfollowed_user_id) || undefined })));
    } else {
      setHistory([]);
    }
  }, [user?.id]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const recordUnfollow = useCallback(async (unfollowedUserId: string) => {
    if (!user?.id) return;
    await supabase.from('unfollow_history').insert({ user_id: user.id, unfollowed_user_id: unfollowedUserId });
  }, [user?.id]);

  return { history, recordUnfollow, refetch: fetchHistory };
};
