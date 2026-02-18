import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Grid3X3, Bookmark, Users } from 'lucide-react';
import { useStoryHighlights } from '@/hooks/useStoryHighlights';
import { usePostCollections } from '@/hooks/usePostCollections';
import { HighlightsRow } from '@/components/profile/HighlightsRow';
import { CollectionsFilter } from '@/components/profile/CollectionsFilter';
import { useUserPosts } from '@/hooks/useUserPosts';
import { useFollow } from '@/hooks/useFollow';
import { PostCard } from '@/components/feed/PostCard';
import { FullScreenViewer } from '@/components/feed/FullScreenViewer';
import { PullToRefresh } from '@/components/feed/PullToRefresh';
import { EndOfFeed } from '@/components/feed/EndOfFeed';
import { FollowButton } from '@/components/user/FollowButton';
import { MessageButton } from '@/components/chat/MessageButton';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { formatCount } from '@/lib/formatCount';
import { useFamilyTree } from '@/hooks/useFamilyTree';
import { SelectMemberDialog } from '@/components/family/SelectMemberDialog';
import { AddRelativeDialog } from '@/components/family/AddRelativeDialog';
import { useToast } from '@/hooks/use-toast';

interface UserProfile {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
}

const UserProfilePage = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { posts, isLoading: postsLoading, postsCount, refetch } = useUserPosts(userId);
  const { followersCount, followingCount } = useFollow(userId);
  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  
  const { highlights } = useStoryHighlights(userId);
  const { collections, selectedCollectionId, setSelectedCollectionId, collectionPosts } = usePostCollections(userId);

  // Family tree states
  const { members, addMember, sendInvitation } = useFamilyTree();
  const [selectMemberOpen, setSelectMemberOpen] = useState(false);
  const [addRelativeOpen, setAddRelativeOpen] = useState(false);

  // Redirect to own profile if viewing self
  useEffect(() => {
    if (currentUser?.id && userId === currentUser.id) {
      navigate('/profile', { replace: true });
    }
  }, [currentUser?.id, userId, navigate]);

  const fetchProfile = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const openViewer = (index: number) => {
    setViewerInitialIndex(index);
    setViewerOpen(true);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">Yuklanmoqda...</p>
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">Foydalanuvchi topilmadi</p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Orqaga
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen pb-20">
        {/* Header with back button */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-semibold">{profile.name || 'Foydalanuvchi'}</h1>
            <p className="text-xs text-muted-foreground">{postsCount} ta post</p>
          </div>
        </div>

        {/* Cover Image */}
        <div className="h-32 bg-gradient-to-r from-primary to-accent" />
        
        {/* Profile Info */}
        <div className="px-4">
          <div className="relative -mt-16 mb-4 flex items-end justify-between">
            <Avatar className="h-24 w-24 border-4 border-background">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                {getInitials(profile.name)}
              </AvatarFallback>
            </Avatar>
            
            {userId && (
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectMemberOpen(true)}
                  className="gap-1"
                >
                  <Users className="h-4 w-4" />
                  Qarindoshim
                </Button>
                <FollowButton targetUserId={userId} />
                <MessageButton userId={userId} />
              </div>
            )}
          </div>

          <div className="mb-4">
            <h1 className="text-2xl font-bold">{profile.name || 'Foydalanuvchi'}</h1>
            <p className="text-muted-foreground">
              @{profile.username || 'username'}
            </p>
          </div>

          {profile.bio && (
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
            {postsLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Yuklanmoqda...</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Grid3X3 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">Hozircha postlar yo'q</p>
              </div>
            ) : (
              <div className="space-y-4 px-0 md:px-4">
                {posts.map((post, index) => (
                  <div key={post.id} onClick={() => openViewer(index)} className="cursor-pointer">
                    <PostCard post={post} />
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

        {/* Select member dialog */}
        <SelectMemberDialog
          open={selectMemberOpen}
          onOpenChange={setSelectMemberOpen}
          members={members}
          targetUserName={profile?.name || 'Foydalanuvchi'}
          onSelectMember={async (member) => {
            if (userId) {
              await sendInvitation(userId, member.id, member.relation_type);
              setSelectMemberOpen(false);
            }
          }}
          onCreateNew={() => {
            setSelectMemberOpen(false);
            setAddRelativeOpen(true);
          }}
        />

        {/* Add relative dialog */}
        <AddRelativeDialog
          open={addRelativeOpen}
          onOpenChange={setAddRelativeOpen}
          onAdd={async (relative) => {
            const newMember = await addMember({
              member_name: relative.relative_name,
              relation_type: relative.relation_type,
              avatar_url: relative.avatar_url,
              gender: relative.gender,
            });
            if (newMember && userId) {
              await sendInvitation(userId, newMember.id, newMember.relation_type);
            }
            setAddRelativeOpen(false);
          }}
          relatives={[]}
        />
      </div>
    </AppLayout>
  );
};

export default UserProfilePage;
