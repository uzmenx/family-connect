import { useState } from 'react';
import { Heart, MessageCircle, Share2, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePostLikes } from '@/hooks/usePostLikes';
import { LikersDialog } from './LikersDialog';
import { CommentsSheet } from './CommentsSheet';
import { ShareDialog } from './ShareDialog';
import { cn } from '@/lib/utils';

interface PostActionsProps {
  postId: string;
  initialLikesCount?: number;
  initialCommentsCount?: number;
  variant?: 'default' | 'fullscreen';
}

export const PostActions = ({ 
  postId, 
  initialLikesCount = 0,
  initialCommentsCount = 0,
  variant = 'default' 
}: PostActionsProps) => {
  const { isLiked, likesCount, likedUsers, toggleLike, fetchLikedUsers, isLoading } = usePostLikes(postId);
  const [showLikers, setShowLikers] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

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

  const isFullscreen = variant === 'fullscreen';
  const displayLikesCount = likesCount || initialLikesCount;

  return (
    <>
      <div className={cn(
        "flex items-center",
        isFullscreen ? "gap-6 text-white" : "justify-between"
      )}>
        <div className="flex items-center gap-3">
          {/* Like button */}
          <button 
            className={cn(
              "flex items-center gap-1.5 transition-colors",
              isFullscreen && "hover:opacity-80"
            )}
            onClick={handleLikeClick}
            disabled={isLoading}
          >
            <Heart 
              className={cn(
                "h-6 w-6 transition-all",
                isLiked && "fill-destructive text-destructive",
                isAnimating && "scale-125"
              )} 
            />
            {isFullscreen && (
              <span className="text-sm">{displayLikesCount}</span>
            )}
          </button>
          
          {/* Comment button */}
          <button 
            className={cn(
              "flex items-center gap-1.5 transition-colors",
              isFullscreen && "hover:opacity-80"
            )}
            onClick={handleCommentsClick}
          >
            <MessageCircle className="h-6 w-6" />
            {isFullscreen && (
              <span className="text-sm">{initialCommentsCount}</span>
            )}
          </button>
          
          {/* Share button */}
          <button 
            className={cn(
              "transition-colors",
              isFullscreen && "hover:opacity-80"
            )}
            onClick={handleShareClick}
          >
            <Share2 className="h-6 w-6" />
          </button>
        </div>
        
        <button 
          className={cn(
            "transition-colors",
            !isFullscreen && "ml-auto",
            isFullscreen && "ml-auto hover:opacity-80"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Bookmark className="h-6 w-6" />
        </button>
      </div>

      {/* Counts - only show in default variant */}
      {!isFullscreen && (
        <div className="space-y-1">
          {displayLikesCount > 0 && (
            <button 
              onClick={handleLikesCountClick}
              className="font-semibold text-sm hover:underline"
            >
              {displayLikesCount} ta yoqtirish
            </button>
          )}
          
          {initialCommentsCount > 0 && (
            <button 
              onClick={handleCommentsClick}
              className="block text-sm text-muted-foreground hover:underline"
            >
              {initialCommentsCount} ta izohni ko'rish
            </button>
          )}
        </div>
      )}

      {/* Dialogs */}
      <LikersDialog 
        open={showLikers} 
        onOpenChange={setShowLikers}
        users={likedUsers}
        likesCount={displayLikesCount}
      />
      
      <CommentsSheet
        open={showComments}
        onOpenChange={setShowComments}
        postId={postId}
      />
      
      <ShareDialog
        open={showShare}
        onOpenChange={setShowShare}
        postId={postId}
      />
    </>
  );
};
