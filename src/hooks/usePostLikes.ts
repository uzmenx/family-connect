import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface LikeUser {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
}

export const usePostLikes = (postId: string) => {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [likedUsers, setLikedUsers] = useState<LikeUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Check if user has liked this post
  const checkLikeStatus = useCallback(async () => {
    if (!user) {
      setIsLiked(false);
      return;
    }

    const { data } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle();

    setIsLiked(!!data);
  }, [postId, user]);

  // Fetch likes count
  const fetchLikesCount = useCallback(async () => {
    const { count } = await supabase
      .from('post_likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);

    setLikesCount(count || 0);
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

  // Toggle like
  const toggleLike = async () => {
    if (!user || isLoading) return;

    setIsLoading(true);
    
    try {
      if (isLiked) {
        // Unlike
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
        
        setIsLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));
      } else {
        // Like
        await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: user.id });
        
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert optimistic update
      await checkLikeStatus();
      await fetchLikesCount();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkLikeStatus();
    fetchLikesCount();
  }, [checkLikeStatus, fetchLikesCount]);

  return {
    isLiked,
    likesCount,
    likedUsers,
    isLoading,
    toggleLike,
    fetchLikedUsers,
    refresh: () => {
      checkLikeStatus();
      fetchLikesCount();
    }
  };
};
