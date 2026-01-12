import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PostCard } from '@/components/feed/PostCard';
import { useAuth } from '@/contexts/AuthContext';
import { Post } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { Grid2X2, Grid3X3, LayoutList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type GridLayout = 1 | 2 | 3;

const Home = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [gridLayout, setGridLayout] = useState<GridLayout>(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      const { data: postsData, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles for authors
      if (postsData && postsData.length > 0) {
        const userIds = [...new Set(postsData.map(p => p.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);

        const postsWithAuthors = postsData.map(post => ({
          ...post,
          media_urls: post.media_urls || [],
          author: profiles?.find(p => p.id === post.user_id) ? {
            id: post.user_id,
            email: profiles.find(p => p.id === post.user_id)?.email || '',
            full_name: profiles.find(p => p.id === post.user_id)?.name || 'Foydalanuvchi',
            username: profiles.find(p => p.id === post.user_id)?.username || 'user',
            bio: profiles.find(p => p.id === post.user_id)?.bio || '',
            avatar_url: profiles.find(p => p.id === post.user_id)?.avatar_url || '',
            cover_url: '',
            instagram: '',
            telegram: '',
            followers_count: 0,
            following_count: 0,
            relatives_count: 0,
            created_at: post.created_at,
          } : undefined
        }));

        setPosts(postsWithAuthors);
      } else {
        setPosts([]);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async (postId: string) => {
    setPosts(prev => prev.map(post => 
      post.id === postId 
        ? { ...post, likes_count: post.likes_count + 1 }
        : post
    ));
    
    await supabase
      .from('posts')
      .update({ likes_count: posts.find(p => p.id === postId)!.likes_count + 1 })
      .eq('id', postId);
  };

  const cycleGridLayout = () => {
    setGridLayout(prev => {
      if (prev === 1) return 2;
      if (prev === 2) return 3;
      return 1;
    });
  };

  const getGridIcon = () => {
    switch (gridLayout) {
      case 1: return <LayoutList className="h-5 w-5" />;
      case 2: return <Grid2X2 className="h-5 w-5" />;
      case 3: return <Grid3X3 className="h-5 w-5" />;
    }
  };

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto">
        <header className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 z-40 flex items-center justify-between">
          <h1 className="text-xl font-bold">Oilaviy</h1>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={cycleGridLayout}
            className="h-9 w-9"
          >
            {getGridIcon()}
          </Button>
        </header>
        
        <div className={cn(
          "p-2",
          gridLayout === 1 && "space-y-4 p-0",
          gridLayout === 2 && "grid grid-cols-2 gap-1",
          gridLayout === 3 && "grid grid-cols-3 gap-0.5"
        )}>
          {isLoading ? (
            <div className="text-center py-12 col-span-full">
              <p className="text-muted-foreground">Yuklanmoqda...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 col-span-full">
              <p className="text-muted-foreground">Hozircha postlar yo'q</p>
              <p className="text-sm text-muted-foreground mt-2">Birinchi postni yarating!</p>
            </div>
          ) : gridLayout === 1 ? (
            posts.map((post) => (
              <PostCard key={post.id} post={post} onLike={handleLike} />
            ))
          ) : (
            posts.map((post) => (
              <div key={post.id} className="aspect-square overflow-hidden bg-muted">
                {post.media_urls && post.media_urls[0] ? (
                  post.media_urls[0].includes('.mp4') || post.media_urls[0].includes('.mov') ? (
                    <video 
                      src={post.media_urls[0]} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img 
                      src={post.media_urls[0]} 
                      alt="Post"
                      className="w-full h-full object-cover"
                    />
                  )
                ) : post.image_url ? (
                  <img 
                    src={post.image_url} 
                    alt="Post"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs p-2 text-center">
                    {post.content?.substring(0, 50)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Home;
