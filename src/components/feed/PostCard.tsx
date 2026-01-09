import { Heart, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Post } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface PostCardProps {
  post: Post;
  onLike: (postId: string) => void;
}

export const PostCard = ({ post, onLike }: PostCardProps) => {
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center gap-3 p-4">
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.author?.avatar_url} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {post.author?.full_name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-semibold text-sm">{post.author?.full_name || 'Foydalanuvchi'}</p>
            <p className="text-xs text-muted-foreground">@{post.author?.username} · {timeAgo}</p>
          </div>
        </div>
        
        {post.image_url && (
          <img 
            src={post.image_url} 
            alt="Post" 
            className="w-full aspect-square object-cover"
          />
        )}
        
        <div className="p-4 space-y-3">
          {post.content && (
            <p className="text-sm">{post.content}</p>
          )}
          
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-2"
              onClick={() => onLike(post.id)}
            >
              <Heart className="h-5 w-5" />
              <span>{post.likes_count}</span>
            </Button>
            <Button variant="ghost" size="sm" className="gap-2">
              <MessageCircle className="h-5 w-5" />
              <span>{post.comments_count}</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
