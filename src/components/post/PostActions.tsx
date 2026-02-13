import { useState, useEffect } from 'react';
import { Heart, MessageCircle, Share2, Bookmark } from 'lucide-react';
import { usePostLikes } from '@/hooks/usePostLikes';
import { useSavedPosts } from '@/hooks/useSavedPosts';
import { LikersDialog } from './LikersDialog';
import { CommentsSheet } from './CommentsSheet';
import { ShareDialog } from './ShareDialog';
import { cn } from '@/lib/utils';
import { formatCount } from '@/lib/formatCount';

interface PostActionsProps {
  postId: string;
  initialLikesCount?: number;
  initialCommentsCount?: number;
}

export const PostActions = ({
  postId,
  initialLikesCount = 0,
  initialCommentsCount = 0
}: PostActionsProps) => {
  const { isLiked, likesCount, likedUsers, toggleLike, fetchLikedUsers, isLoading } = usePostLikes(postId);
  const { isPostSaved, toggleSavePost } = useSavedPosts();
  const [showLikers, setShowLikers] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsSaved(isPostSaved(postId));
  }, [isPostSaved, postId]);

  const handleSaveClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSaving) return;

    setIsSaving(true);
    const result = await toggleSavePost(postId);
    setIsSaved(result);
    setIsSaving(false);
  };

  const handleLikeClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoading) return;

    setIsAnimating(true);
    await toggleLike();
    setTimeout(() => setIsAnimating(false), 300);
  };

  const handleLikesCountClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fetchLikedUsers();
    setShowLikers(true);
  };

  const handleCommentsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowComments(true);
  };

  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowShare(true);
  };

  const displayLikesCount = likesCount || initialLikesCount;

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Like button */}
          <button
            className="flex items-center gap-1.5 transition-colors"
            onClick={handleLikeClick}
            disabled={isLoading}>

            <Heart
              className={cn(
                "h-6 w-6 transition-all",
                isLiked && "fill-destructive text-destructive",
                isAnimating && "scale-125"
              )} />

          </button>
          
          {/* Comment button */}
          <button
            className="flex items-center gap-1.5 transition-colors"
            onClick={handleCommentsClick}>

            <MessageCircle className="h-6 w-6" />
          </button>
          
          {/* Share button */}
          <button
            className="transition-colors"
            onClick={handleShareClick}>

            <Share2 className="h-6 w-6" />
          </button>
        </div>
        
        <button
          className="ml-auto transition-colors"
          onClick={handleSaveClick}
          disabled={isSaving}>

          <Bookmark className={cn(
            "h-6 w-6 transition-all",
            isSaved && "fill-primary text-primary"
          )} />
        </button>
      </div>

      {/* Counts */}
      <div className="space-y-1">
        {displayLikesCount > 0 &&
        <button
          onClick={handleLikesCountClick}
          className="font-semibold text-sm hover:underline text-slate-800 bg-primary-foreground">

            {formatCount(displayLikesCount)} ta yoqtirish
          </button>
        }
        
        {initialCommentsCount > 0 &&
        <button
          onClick={handleCommentsClick}
          className="block text-sm text-muted-foreground hover:underline">

            {formatCount(initialCommentsCount)} ta izohni ko'rish
          </button>
        }
      </div>

      {/* Dialogs */}
      <LikersDialog
        open={showLikers}
        onOpenChange={setShowLikers}
        users={likedUsers}
        likesCount={displayLikesCount} />

      
      <CommentsSheet
        open={showComments}
        onOpenChange={setShowComments}
        postId={postId} />

      
      <ShareDialog
        open={showShare}
        onOpenChange={setShowShare}
        postId={postId} />

    </>);

};