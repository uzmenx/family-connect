import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface LikeUser {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
}

// Simple in-memory cache
const likeCache = new Map<string, { isLiked: boolean; count: number; timestamp: number }>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

export const usePostLikes = (postId: string) => {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [likedUsers, setLikedUsers] = useState<LikeUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Update cache helper
  const updateCache = useCallback((liked: boolean, count: number) => {
    likeCache.set(postId, { isLiked: liked, count, timestamp: Date.now() });
  }, [postId]);

  // Check like status from DB
  const checkLikeStatus = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    
    const { data } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle();
    
    return !!data;
  }, [postId, user]);

  // Get likes count from DB
  const fetchLikesCount = useCallback(async (): Promise<number> => {
    const { count } = await supabase
      .from('post_likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);
    
    return count || 0;
  }, [postId]);

  // Fetch users who liked (for dialog)
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

  // OPTIMISTIC Toggle like
  const toggleLike = useCallback(async () => {
    if (!user || isLoading) return;

    // Cancel pending request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const prevIsLiked = isLiked;
    const prevCount = likesCount;

    // OPTIMISTIC UPDATE - instant UI change
    const newIsLiked = !isLiked;
    const newCount = newIsLiked ? likesCount + 1 : Math.max(0, likesCount - 1);
    
    setIsLiked(newIsLiked);
    setLikesCount(newCount);
    updateCache(newIsLiked, newCount);

    setIsLoading(true);
    abortRef.current = new AbortController();

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
      if (error?.name === 'AbortError') return;
      
      console.error('Error toggling like:', error);
      // ROLLBACK on error
      setIsLiked(prevIsLiked);
      setLikesCount(prevCount);
      updateCache(prevIsLiked, prevCount);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [user, isLoading, isLiked, likesCount, postId, updateCache]);

  // Initialize from cache or fetch from DB
  useEffect(() => {
    if (!postId) return;
    
    let isMounted = true;

    const init = async () => {
      // Check cache first
      const cached = likeCache.get(postId);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        setIsLiked(cached.isLiked);
        setLikesCount(cached.count);
        setIsInitialized(true);
        return;
      }

      // Fetch from DB
      try {
        const [liked, count] = await Promise.all([
          checkLikeStatus(),
          fetchLikesCount()
        ]);

        if (isMounted) {
          setIsLiked(liked);
          setLikesCount(count);
          updateCache(liked, count);
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('Error initializing likes:', error);
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [postId, checkLikeStatus, fetchLikesCount, updateCache]);

  // Re-check when user changes (login/logout)
  useEffect(() => {
    if (isInitialized && user !== undefined) {
      checkLikeStatus().then(liked => {
        setIsLiked(liked);
        updateCache(liked, likesCount);
      });
    }
  }, [user?.id]);

  return {
    isLiked,
    likesCount,
    likedUsers,
    isLoading,
    toggleLike,
    fetchLikedUsers,
    refresh: async () => {
      likeCache.delete(postId);
      const [liked, count] = await Promise.all([
        checkLikeStatus(),
        fetchLikesCount()
      ]);
      setIsLiked(liked);
      setLikesCount(count);
      updateCache(liked, count);
    }
  };
};
