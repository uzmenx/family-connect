import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Post } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { MediaCarousel } from '@/components/post/MediaCarousel';
import { PostActions } from '@/components/post/PostActions';
import { PostCaption } from '@/components/post/PostCaption';
import { PostMenu } from '@/components/post/PostMenu';

interface PostCardProps {
  post: Post;
  onDelete?: () => void;
}

export const PostCard = ({ post, onDelete }: PostCardProps) => {
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });
  
  const mediaUrls = post.media_urls?.length > 0 
    ? post.media_urls 
    : post.image_url 
      ? [post.image_url] 
      : [];

  return (
    <Card className="overflow-hidden border-0 rounded-none md:rounded-lg md:border">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 ring-2 ring-primary/20">
              <AvatarImage src={post.author?.avatar_url} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                {post.author?.full_name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-sm">{post.author?.full_name || 'Foydalanuvchi'}</p>
            </div>
          </div>
          <PostMenu 
            postId={post.id} 
            authorId={post.user_id} 
            onDelete={onDelete}
          />
        </div>
        
        {/* Media */}
        {mediaUrls.length > 0 && (
          <MediaCarousel mediaUrls={mediaUrls} />
        )}
        
        {/* Actions */}
        <div className="p-3 space-y-2">
          <PostActions 
            postId={post.id}
            initialLikesCount={post.likes_count}
            initialCommentsCount={post.comments_count}
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
    </Card>
  );
};
