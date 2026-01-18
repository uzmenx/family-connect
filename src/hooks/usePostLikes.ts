import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface LikeUser {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
}

// Local cache for like states - prevents re-fetching on every render
const likeCache = new Map<string, { isLiked: boolean; count: number; timestamp: number }>();
const LIKE_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

export const usePostLikes = (postId: string) => {
  const { user } = useAuth();
  const cached = likeCache.get(postId);
  const isCacheValid = cached && (Date.now() - cached.timestamp) < LIKE_CACHE_TTL;

  const [isLiked, setIsLiked] = useState(isCacheValid ? cached.isLiked : false);
  const [likesCount, setLikesCount] = useState(isCacheValid ? cached.count : 0);
  const [likedUsers, setLikedUsers] = useState<LikeUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const pendingRequestRef = useRef<AbortController | null>(null);
  const hasInitializedRef = useRef(isCacheValid);

  // Update cache when state changes
  const updateCache = useCallback((liked: boolean, count: number) => {
    likeCache.set(postId, {
      isLiked: liked,
      count: count,
      timestamp: Date.now()
    });
  }, [postId]);

  // Check if user has liked this post
  const checkLikeStatus = useCallback(async () => {
    if (!user) {
      setIsLiked(false);
      return;
    }

    // Skip if we have valid cache
    if (hasInitializedRef.current) return;

    const { data } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle();

    const liked = !!data;
    setIsLiked(liked);
    return liked;
  }, [postId, user]);

  // Fetch likes count
  const fetchLikesCount = useCallback(async () => {
    // Skip if we have valid cache
    if (hasInitializedRef.current) return;

    const { count } = await supabase
      .from('post_likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);

    const actualCount = count || 0;
    setLikesCount(actualCount);
    return actualCount;
  }, [postId]);

  // Fetch users who liked
  const fetchLikedUsers = useCallback(async () => {
    const { data: likes } = await supabase
      .from('post_likes')
      .select('user_id')
      .eq('post_id', postId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (likes && likes.length > 0) {
      const userIds = likes.map(l => l.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .in('id', userIds);

      setLikedUsers(profiles || []);
    } else {
      setLikedUsers([]);
    }
  }, [postId]);

  // OPTIMISTIC Toggle like - UI updates instantly
  const toggleLike = async () => {
    if (!user || isLoading) return;

    // Cancel any pending request
    if (pendingRequestRef.current) {
      pendingRequestRef.current.abort();
    }

    // Store previous state for rollback
    const prevIsLiked = isLiked;
    const prevCount = likesCount;

    // 🔥 OPTIMISTIC UPDATE - UI changes instantly
    const newIsLiked = !isLiked;
    const newCount = newIsLiked ? likesCount + 1 : Math.max(0, likesCount - 1);
    
    setIsLiked(newIsLiked);
    setLikesCount(newCount);
    updateCache(newIsLiked, newCount);

    setIsLoading(true);
    pendingRequestRef.current = new AbortController();

    try {
      if (prevIsLiked) {
        // Unlike
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
        
        if (error) throw error;
      } else {
        // Like
        const { error } = await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: user.id });
        
        if (error) throw error;
      }
    } catch (error: any) {
      // Don't rollback on abort
      if (error?.name === 'AbortError') return;
      
      console.error('Error toggling like:', error);
      // 🔄 ROLLBACK on error
      setIsLiked(prevIsLiked);
      setLikesCount(prevCount);
      updateCache(prevIsLiked, prevCount);
    } finally {
      setIsLoading(false);
      pendingRequestRef.current = null;
    }
  };

  useEffect(() => {
    const initialize = async () => {
      // Use cache if valid
      if (isCacheValid) {
        hasInitializedRef.current = true;
        return;
      }

      const [liked, count] = await Promise.all([
        checkLikeStatus(),
        fetchLikesCount()
      ]);

      if (liked !== undefined && count !== undefined) {
        updateCache(liked, count);
        hasInitializedRef.current = true;
      }
    };

    initialize();
  }, [checkLikeStatus, fetchLikesCount, isCacheValid, updateCache]);

  return {
    isLiked,
    likesCount,
    likedUsers,
    isLoading,
    toggleLike,
    fetchLikedUsers,
    refresh: async () => {
      hasInitializedRef.current = false;
      likeCache.delete(postId);
      await Promise.all([checkLikeStatus(), fetchLikesCount()]);
    }
  };
};
