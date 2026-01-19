import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Settings, Edit, Grid3X3, Bookmark, Bell } from 'lucide-react';
import { useUserPosts } from '@/hooks/useUserPosts';
import { useFollow } from '@/hooks/useFollow';
import { useNotifications } from '@/hooks/useNotifications';
import { PostCard } from '@/components/feed/PostCard';
import { FullScreenViewer } from '@/components/feed/FullScreenViewer';
import { PullToRefresh } from '@/components/feed/PullToRefresh';
import { EndOfFeed } from '@/components/feed/EndOfFeed';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatCount } from '@/lib/formatCount';

const Profile = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const { posts, isLoading, postsCount, refetch, removePost } = useUserPosts(user?.id);
  const { followersCount, followingCount } = useFollow(user?.id);
  const { unreadCount } = useNotifications();
  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const openViewer = (index: number) => {
    setViewerInitialIndex(index);
    setViewerOpen(true);
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-background pb-20">
        {/* Cover Image */}
        <div className="h-32 bg-gradient-to-r from-primary to-accent" />
        
        {/* Profile Info */}
        <div className="px-4">
          <div className="relative -mt-16 mb-4">
            <Avatar className="h-24 w-24 border-4 border-background">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                {getInitials(profile?.name)}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">{profile?.name || 'Foydalanuvchi'}</h1>
              <p className="text-muted-foreground">
                @{profile?.username || user?.email?.split('@')[0] || 'username'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => navigate('/messages?tab=notifications')}
                className="relative"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Badge>
                )}
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => navigate('/settings')}
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => navigate('/edit-profile')}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {profile?.bio && (
            <p className="text-sm mb-4">{profile.bio}</p>
          )}

          {/* Stats */}
          <Card className="mb-6">
            <CardContent className="py-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{formatCount(postsCount)}</p>
                  <p className="text-sm text-muted-foreground">Postlar</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCount(followersCount)}</p>
                  <p className="text-sm text-muted-foreground">Kuzatuvchilar</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCount(followingCount)}</p>
                  <p className="text-sm text-muted-foreground">Kuzatilmoqda</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <div className="flex border-b border-border mb-4">
            <button
              onClick={() => setActiveTab('posts')}
              className={cn(
                "flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors",
                activeTab === 'posts' 
                  ? "border-primary text-primary" 
                  : "border-transparent text-muted-foreground"
              )}
            >
              <Grid3X3 className="h-5 w-5" />
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={cn(
                "flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors",
                activeTab === 'saved' 
                  ? "border-primary text-primary" 
                  : "border-transparent text-muted-foreground"
              )}
            >
              <Bookmark className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Posts Grid / List */}
        {activeTab === 'posts' && (
          <PullToRefresh onRefresh={refetch}>
            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Yuklanmoqda...</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Grid3X3 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">Hozircha postlar yo'q</p>
                <p className="text-sm text-muted-foreground mt-1">Birinchi postingizni yarating!</p>
              </div>
            ) : (
              <div className="space-y-4 px-0 md:px-4">
                {posts.map((post, index) => (
                  <div key={post.id} onClick={() => openViewer(index)} className="cursor-pointer">
                    <PostCard 
                      post={post} 
                      onDelete={() => removePost(post.id)}
                    />
                  </div>
                ))}
                <EndOfFeed />
              </div>
            )}
          </PullToRefresh>
        )}

        {activeTab === 'saved' && (
          <div className="text-center py-12 px-4">
            <Bookmark className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground">Saqlangan postlar yo'q</p>
          </div>
        )}

        {/* Full screen viewer */}
        {viewerOpen && (
          <FullScreenViewer
            posts={posts}
            initialIndex={viewerInitialIndex}
            onClose={() => setViewerOpen(false)}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default Profile;
