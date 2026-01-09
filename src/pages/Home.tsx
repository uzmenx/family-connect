import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PostCard } from '@/components/feed/PostCard';
import { useAuth } from '@/contexts/AuthContext';
import { Post } from '@/types';

const Home = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    const storedPosts = JSON.parse(localStorage.getItem('family_app_posts') || '[]');
    const users = JSON.parse(localStorage.getItem('family_app_users') || '[]');
    
    const postsWithAuthors = storedPosts.map((post: Post) => ({
      ...post,
      author: users.find((u: any) => u.id === post.user_id),
    })).sort((a: Post, b: Post) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    setPosts(postsWithAuthors);
  }, []);

  const handleLike = (postId: string) => {
    setPosts(prev => prev.map(post => 
      post.id === postId 
        ? { ...post, likes_count: post.likes_count + 1 }
        : post
    ));
    
    const storedPosts = JSON.parse(localStorage.getItem('family_app_posts') || '[]');
    const updatedPosts = storedPosts.map((post: Post) =>
      post.id === postId ? { ...post, likes_count: post.likes_count + 1 } : post
    );
    localStorage.setItem('family_app_posts', JSON.stringify(updatedPosts));
  };

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto">
        <header className="sticky top-0 bg-background/80 backdrop-blur-sm border-b border-border p-4 z-40">
          <h1 className="text-xl font-bold text-center">Oilaviy</h1>
        </header>
        
        <div className="p-4 space-y-4">
          {posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Hozircha postlar yo'q</p>
              <p className="text-sm text-muted-foreground mt-2">Birinchi postni yarating!</p>
            </div>
          ) : (
            posts.map((post) => (
              <PostCard key={post.id} post={post} onLike={handleLike} />
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Home;
