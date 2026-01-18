import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Heart, Send, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useComments, Comment } from '@/hooks/useComments';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface CommentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
}

export const CommentsSheet = ({ open, onOpenChange, postId }: CommentsSheetProps) => {
  const { user } = useAuth();
  const { comments, commentsCount, isLoading, fetchComments, addComment, deleteComment, toggleCommentLike } = useComments(postId);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ALWAYS fetch fresh comments when sheet opens
  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen) {
      // Force fresh fetch every time sheet opens
      fetchComments();
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    await addComment(newComment, replyTo?.id);
    setNewComment('');
    setReplyTo(null);
    setIsSubmitting(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const CommentItem = ({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) => {
    const timeAgo = formatDistanceToNow(new Date(comment.created_at), { addSuffix: false });

    return (
      <div className={cn("flex gap-3", isReply && "ml-10")}>
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={comment.author?.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs">
            {comment.author?.name?.charAt(0) || 'U'}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-sm">
                <span className="font-semibold">{comment.author?.name || 'Foydalanuvchi'}</span>
                {' • '}
                <span className="text-muted-foreground text-xs">{timeAgo}</span>
              </p>
              <p className="text-sm mt-0.5">{comment.content}</p>
              
              <div className="flex items-center gap-4 mt-1.5">
                <button 
                  onClick={() => setReplyTo({ id: comment.id, name: comment.author?.name || 'Foydalanuvchi' })}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Javob berish
                </button>
                {comment.isLiked && (
                  <span className="text-xs text-primary">Sizga yoqdi</span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              <button 
                onClick={() => toggleCommentLike(comment.id)}
                className="flex items-center gap-1 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Heart className={cn("h-4 w-4", comment.isLiked && "fill-destructive text-destructive")} />
                {comment.likes_count > 0 && (
                  <span className="text-xs">{comment.likes_count}</span>
                )}
              </button>
              
              {user?.id === comment.user_id && (
                <button
                  onClick={() => deleteComment(comment.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            Izohlar
            <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
              {commentsCount}
            </span>
          </SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Yuklanmoqda...
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Hozircha izohlar yo'q. Birinchi bo'lib izoh qoldiring!
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {comments.map((comment) => (
                <div key={comment.id}>
                  <CommentItem comment={comment} />
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="mt-3 space-y-3">
                      {comment.replies.map((reply) => (
                        <CommentItem key={reply.id} comment={reply} isReply />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        {/* Input area */}
        <div className="flex-shrink-0 border-t pt-4 -mx-6 px-6">
          {replyTo && (
            <div className="flex items-center justify-between bg-muted/50 px-3 py-2 rounded-lg mb-2 text-sm">
              <span>
                <span className="text-muted-foreground">Javob: </span>
                <span className="font-medium">{replyTo.name}</span>
              </span>
              <button 
                onClick={() => setReplyTo(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
          )}
          
          {user ? (
            <div className="flex items-center gap-2">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Izoh yozing..."
                className="flex-1"
                disabled={isSubmitting}
              />
              <Button 
                size="icon" 
                onClick={handleSubmit}
                disabled={!newComment.trim() || isSubmitting}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-2">
              Izoh qoldirish uchun tizimga kiring
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
