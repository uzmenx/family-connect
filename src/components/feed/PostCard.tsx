import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Post } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { MediaCarousel } from '@/components/post/MediaCarousel';
import { PostActions } from '@/components/post/PostActions';
import { PostCaption } from '@/components/post/PostCaption';
import { PostMenu } from '@/components/post/PostMenu';
import { UserAvatar } from '@/components/user/UserAvatar';
import { UserInfo } from '@/components/user/UserInfo';
import { FollowButton } from '@/components/user/FollowButton';
import { SamsungUltraVideoPlayer } from '@/components/video/SamsungUltraVideoPlayer';

interface PostCardProps {
  post: Post;
  onDelete?: () => void;
  onMediaClick?: () => void;
}

export const PostCard = ({ post, onDelete, onMediaClick }: PostCardProps) => {
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [videoPlayerSrc, setVideoPlayerSrc] = useState('');
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });
  
  const mediaUrls = post.media_urls?.length > 0 
    ? post.media_urls 
    : post.image_url 
      ? [post.image_url] 
      : [];

  const isVideo = (url: string) => url?.includes('.mp4') || url?.includes('.mov') || url?.includes('.webm');
  const firstVideoUrl = mediaUrls.find(url => isVideo(url));

  return (
    <Card className="overflow-hidden border-0 rounded-none md:rounded-lg md:border">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-3">
            <UserAvatar 
              userId={post.user_id}
              avatarUrl={post.author?.avatar_url}
              name={post.author?.full_name}
            />
            <UserInfo 
              userId={post.user_id}
              name={post.author?.full_name}
              username={post.author?.username}
            />
          </div>
          <div className="flex items-center gap-2">
            <FollowButton targetUserId={post.user_id} size="sm" />
            <PostMenu 
              postId={post.id} 
              authorId={post.user_id} 
              onDelete={onDelete}
            />
          </div>
        </div>
        
        {/* Media - ONLY media area triggers fullscreen */}
        {mediaUrls.length > 0 && (
          <div 
            onClick={onMediaClick} 
            className={onMediaClick ? "cursor-pointer" : ""}
          >
            <MediaCarousel mediaUrls={mediaUrls} />
          </div>
        )}
        
        {/* Actions - does NOT trigger fullscreen */}
        <div className="p-3 space-y-2">
          <PostActions 
            postId={post.id}
            initialLikesCount={post.likes_count}
            initialCommentsCount={post.comments_count}
            videoUrl={firstVideoUrl}
            onOpenVideoPlayer={(url) => {
              setVideoPlayerSrc(url);
              setShowVideoPlayer(true);
            }}
          />
          
          {post.content && (
            <PostCaption 
              username={post.author?.username || 'user'}
              content={post.content}
            />
          )}
          
          <p className="text-xs text-muted-foreground uppercase">{timeAgo}</p>
        </div>
      </CardContent>

      {/* Samsung Ultra Video Player overlay */}
      {showVideoPlayer && (
        <div className="fixed inset-0 z-[60]" style={{ overflow: 'hidden' }}>
          <SamsungUltraVideoPlayer
            src={videoPlayerSrc}
            title={post.content?.slice(0, 50) || 'Video'}
            onClose={() => setShowVideoPlayer(false)}
          />
        </div>
      )}
    </Card>
  );
};
