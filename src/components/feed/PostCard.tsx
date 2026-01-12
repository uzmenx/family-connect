import { Heart, MessageCircle, MoreHorizontal, Send, Bookmark } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Post } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { MediaCarousel } from '@/components/post/MediaCarousel';

interface PostCardProps {
  post: Post;
  onLike: (postId: string) => void;
}

export const PostCard = ({ post, onLike }: PostCardProps) => {
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });
  
  // Support both old image_url and new media_urls
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
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Media */}
        {mediaUrls.length > 0 && (
          <MediaCarousel mediaUrls={mediaUrls} />
        )}
        
        {/* Actions */}
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon"
                className="h-9 w-9"
                onClick={() => onLike(post.id)}
              >
                <Heart className="h-6 w-6" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <MessageCircle className="h-6 w-6" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Send className="h-6 w-6" />
              </Button>
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Bookmark className="h-6 w-6" />
            </Button>
          </div>
          
          {post.likes_count > 0 && (
            <p className="font-semibold text-sm">{post.likes_count} ta yoqtirish</p>
          )}
          
          {post.content && (
            <p className="text-sm">
              <span className="font-semibold">{post.author?.username || 'user'}</span>{' '}
              {post.content}
            </p>
          )}
          
          {post.comments_count > 0 && (
            <button className="text-sm text-muted-foreground">
              {post.comments_count} ta izohni ko'rish
            </button>
          )}
          
          <p className="text-xs text-muted-foreground uppercase">{timeAgo}</p>
        </div>
      </CardContent>
    </Card>
  );
};
