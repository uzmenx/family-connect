import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, Maximize2, Users, TreeDeciduous } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TreeFullscreenView } from '@/components/family-v2/TreeFullscreenView';
import { FamilyMember } from '@/types/family';
import { TreeOverlay } from '@/hooks/useTreePosts';
import { formatCount } from '@/lib/formatCount';
import { motion } from 'framer-motion';

interface TreePostCardProps {
  post: {
    id: string;
    user_id: string;
    title: string | null;
    tree_data: Record<string, FamilyMember>;
    positions_data: Record<string, { x: number; y: number }>;
    overlays: TreeOverlay[];
    caption: string | null;
    created_at: string;
    likes_count?: number;
  };
  author?: {
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  index?: number;
}

export const TreePostCard = ({ post, author, index = 0 }: TreePostCardProps) => {
  const { user } = useAuth();
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);

  const memberCount = Object.keys(post.tree_data || {}).length;
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  // Check if already liked on mount
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('tree_post_likes').select('id').eq('tree_post_id', post.id).eq('user_id', user.id).maybeSingle()
      .then(({ data }: any) => { if (data) setLiked(true); });
  }, [user?.id, post.id]);

  const handleLike = useCallback(async () => {
    if (!user?.id) return;
    if (liked) {
      setLiked(false);
      setLikesCount(c => Math.max(0, c - 1));
      await supabase.from('tree_post_likes').delete().eq('tree_post_id', post.id).eq('user_id', user.id);
    } else {
      setLiked(true);
      setLikesCount(c => c + 1);
      await supabase.from('tree_post_likes').insert({ tree_post_id: post.id, user_id: user.id });
    }
  }, [liked, post.id, user?.id]);

  // Build mini tree preview - show member names in a visual grid
  const memberNames = Object.values(post.tree_data || {}).slice(0, 9);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: Math.min(index * 0.06, 0.4) }}
        className="py-0 my-[5px]"
      >
        <Card className="overflow-hidden border-0 rounded-[20px] border border-border/20 bg-card/80 backdrop-blur-[10px] shadow-xl shadow-black/10">
          <CardContent className="p-0">
            {/* Header */}
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={author?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs bg-primary/20">{(author?.name || 'U')[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold text-foreground">{author?.name || 'Foydalanuvchi'}</p>
                  <p className="text-xs text-muted-foreground">@{author?.username || 'user'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10">
                <TreeDeciduous className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">{memberCount} a'zo</span>
              </div>
            </div>

            {/* Tree preview - clickable */}
            <div
              className="relative w-full h-52 bg-gradient-to-br from-primary/5 to-primary/10 cursor-pointer overflow-hidden"
              onClick={() => setShowFullscreen(true)}
            >
              {/* Mini visual preview of tree members */}
              <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-2 p-4">
                {memberNames.map((member, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                    {member.photoUrl ? (
                      <img src={member.photoUrl} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                        <span className="text-xs font-medium text-primary">{(member.name || 'U')[0]}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[50px]">{member.name}</span>
                  </div>
                ))}
                {memberCount > 9 && (
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-10 h-10 rounded-full bg-muted/50 border border-border/30 flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">+{memberCount - 9}</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Title overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/80 to-transparent p-3">
                <p className="text-sm font-medium text-foreground">{post.title || 'Oila daraxti'}</p>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8 bg-background/60 backdrop-blur-sm rounded-full"
                onClick={(e) => { e.stopPropagation(); setShowFullscreen(true); }}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Actions */}
            <div className="p-3 space-y-2">
              <div className="flex items-center gap-4">
                <button onClick={handleLike} className="flex items-center gap-1.5">
                  <Heart className={`h-5 w-5 transition-colors ${liked ? 'fill-destructive text-destructive' : 'text-foreground'}`} />
                  <span className="text-sm">{formatCount(likesCount)}</span>
                </button>
                <div className="flex items-center gap-1.5">
                  <Users className="h-5 w-5 text-foreground" />
                  <span className="text-sm">{memberCount}</span>
                </div>
              </div>

              {post.caption && (
                <p className="text-sm text-foreground">
                  <span className="font-semibold mr-1">{author?.username || 'user'}</span>
                  {post.caption}
                </p>
              )}

              <p className="text-xs text-muted-foreground uppercase">{timeAgo}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <TreeFullscreenView
        isOpen={showFullscreen}
        onClose={() => setShowFullscreen(false)}
        members={post.tree_data}
        positions={post.positions_data}
        overlays={post.overlays}
        caption={post.caption}
      />
    </>
  );
};
