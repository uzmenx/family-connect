import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  likes_count: number;
  created_at: string;
  author?: {
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  isLiked?: boolean;
  replies?: Comment[];
}

export const useComments = (postId: string) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsCount, setCommentsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch comments with authors
  const fetchComments = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: commentsData } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: false });

      if (!commentsData || commentsData.length === 0) {
        setComments([]);
        setCommentsCount(0);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(commentsData.map(c => c.user_id))];
      
      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .in('id', userIds);

      // Check which comments user has liked
      let userLikes: string[] = [];
      if (user) {
        const { data: likes } = await supabase
          .from('comment_likes')
          .select('comment_id')
          .eq('user_id', user.id)
          .in('comment_id', commentsData.map(c => c.id));
        
        userLikes = likes?.map(l => l.comment_id) || [];
      }

      // Combine data
      const enrichedComments: Comment[] = commentsData.map(comment => ({
        ...comment,
        author: profiles?.find(p => p.id === comment.user_id),
        isLiked: userLikes.includes(comment.id)
      }));

      // Organize into parent/child structure
      const parentComments = enrichedComments.filter(c => !c.parent_id);
      const childComments = enrichedComments.filter(c => c.parent_id);

      const organizedComments = parentComments.map(parent => ({
        ...parent,
        replies: childComments.filter(child => child.parent_id === parent.id)
      }));

      setComments(organizedComments);
      setCommentsCount(commentsData.length);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [postId, user]);

  // Add comment
  const addComment = async (content: string, parentId?: string) => {
    if (!user || !content.trim()) return null;

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content: content.trim(),
          parent_id: parentId || null
        })
        .select()
        .single();

      if (error) throw error;
      
      await fetchComments();
      return data;
    } catch (error) {
      console.error('Error adding comment:', error);
      return null;
    }
  };

  // Delete comment
  const deleteComment = async (commentId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', user.id);

      if (error) throw error;
      
      await fetchComments();
      return true;
    } catch (error) {
      console.error('Error deleting comment:', error);
      return false;
    }
  };

  // Toggle comment like
  const toggleCommentLike = async (commentId: string) => {
    if (!user) return;

    const comment = comments.find(c => c.id === commentId) || 
                    comments.flatMap(c => c.replies || []).find(c => c.id === commentId);
    
    if (!comment) return;

    try {
      if (comment.isLiked) {
        await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('comment_likes')
          .insert({ comment_id: commentId, user_id: user.id });
      }

      // Update local state optimistically
      setComments(prev => prev.map(c => {
        if (c.id === commentId) {
          return {
            ...c,
            isLiked: !c.isLiked,
            likes_count: c.isLiked ? c.likes_count - 1 : c.likes_count + 1
          };
        }
        if (c.replies) {
          return {
            ...c,
            replies: c.replies.map(r => 
              r.id === commentId
                ? { ...r, isLiked: !r.isLiked, likes_count: r.isLiked ? r.likes_count - 1 : r.likes_count + 1 }
                : r
            )
          };
        }
        return c;
      }));
    } catch (error) {
      console.error('Error toggling comment like:', error);
    }
  };

  return {
    comments,
    commentsCount,
    isLoading,
    fetchComments,
    addComment,
    deleteComment,
    toggleCommentLike
  };
};
