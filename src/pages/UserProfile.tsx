import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Grid3X3, Bookmark, Users, AtSign } from 'lucide-react';
import { SocialLinksList } from '@/components/profile';
import { SocialLink } from '@/components/profile/SocialLinksEditor';
import { useStoryHighlights } from '@/hooks/useStoryHighlights';
import { usePostCollections } from '@/hooks/usePostCollections';
import { HighlightsRow } from '@/components/profile/HighlightsRow';
import { CollectionsFilter } from '@/components/profile/CollectionsFilter';
import { useUserPosts } from '@/hooks/useUserPosts';
import { useFollow } from '@/hooks/useFollow';
import { useMentionsCollabs } from '@/hooks/useMentionsCollabs';
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
  cover_url: string | null;
  social_links: SocialLink[] | null;
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
  const [activeTab, setActiveTab] = useState<'posts' | 'saved' | 'mentions'>('posts');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  
  const { highlights } = useStoryHighlights(userId);
  const { collections, selectedCollectionId, setSelectedCollectionId, collectionPosts } = usePostCollections(userId);
  const { mentionedPosts: userMentionedPosts, collabPosts: userCollabPosts } = useMentionsCollabs(userId);

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
      if (data) {
        setProfile({
          ...data,
          social_links: (data.social_links as unknown as SocialLink[] | null) || null,
        });
      }
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
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 z-10 h-9 w-9 rounded-full"
          style={{
            backgroundColor: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(8px)'
          }}
        >
          <ArrowLeft className="h-5 w-5 text-white" />
        </Button>

        {/* Cover Image */}
        <div className="relative h-36 overflow-hidden">
          {profile.cover_url ? (
            <img src={profile.cover_url} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary via-accent to-primary/60" />
          )}
          {/* Dark overlay for readability */}
          <div className="absolute inset-0 bg-black/20" />
        </div>
        
        {/* Profile Info */}
        <div className="px-4 -mt-10 relative z-10">
          {/* ROW 1: Followers | Avatar | Postlar */}
          <div className="flex items-end justify-between gap-3 mb-3">

            {/* LEFT: Followers */}
            <div className="flex-1 flex flex-col items-center justify-center bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl px-3 py-3 shadow-lg min-w-0">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                Kuzatuvchilar
              </span>
              <span className="text-xl font-extrabold text-foreground leading-none">
                {formatCount(followersCount)}
              </span>
            </div>

            {/* CENTER: Avatar */}
            <div className="flex-shrink-0 flex flex-col items-center">
              <Avatar className="h-24 w-24 border-4 border-background shadow-2xl ring-2 ring-primary/30">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-accent text-white font-bold">
                  {getInitials(profile.name)}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* RIGHT: Postlar */}
            <div className="flex-1 flex flex-col items-center justify-center bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl px-3 py-3 shadow-lg min-w-0">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                Postlar
              </span>
              <span className="text-xl font-extrabold text-foreground leading-none">
                {formatCount(postsCount)}
              </span>
            </div>
          </div>

          {/* ROW 2: Name & Username */}
          <div className="text-center mb-3">
            <h1 className="text-xl font-extrabold text-foreground leading-tight">
              {profile.name || 'Foydalanuvchi'}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              @{profile.username || 'username'}
            </p>
          </div>

          {/* ROW 3: Kuzatilmoqda — centered */}
          <div className="flex justify-center mb-3">
            <div className="flex flex-col items-center justify-center bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl px-8 py-3 shadow-lg">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                Kuzatilmoqda
              </span>
              <span className="text-xl font-extrabold text-foreground leading-none">
                {formatCount(followingCount)}
              </span>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-center text-sm text-muted-foreground mb-3 max-w-xs mx-auto leading-relaxed">
              {profile.bio}
            </p>
          )}

          {/* Action Buttons */}
          {userId && (
            <div className="flex justify-center gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 dark:bg-white/5 border-white/20 hover:bg-white/20 text-foreground h-9 text-sm"
                onClick={() => setSelectMemberOpen(true)}
              >
                <Users className="h-4 w-4 mr-2" />
                Qarindoshim
              </Button>
              <FollowButton targetUserId={userId} />
              <MessageButton userId={userId} />
            </div>
          )}

          {/* Social Links */}
          {profile.social_links && profile.social_links.length > 0 && (
            <SocialLinksList links={profile.social_links} className="justify-center mb-3" />
          )}
        </div>

        {/* Story Highlights */}
        {highlights.length > 0 && (
          <div className="flex justify-center">
            <HighlightsRow highlights={highlights} isOwner={false} />
          </div>
        )}

        {/* Collections filter */}
        {collections.length > 0 && activeTab === 'posts' && (
          <div className="flex justify-center">
            <CollectionsFilter
              collections={collections}
              selectedId={selectedCollectionId}
              onSelect={setSelectedCollectionId}
              isOwner={false}
            />
          </div>
        )}

        {/* ═══════════════════════════════════════
            TABS
        ═══════════════════════════════════════ */}
        <div className="px-4">
          <div className="flex border-b border-border mb-4">
            <button
              onClick={() => setActiveTab('posts')}
              className={cn(
                'flex-1 py-3 flex items-center justify-center border-b-2 transition-colors',
                activeTab === 'posts'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground'
              )}
            >
              <Grid3X3 className="h-5 w-5" />
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={cn(
                'flex-1 py-3 flex items-center justify-center border-b-2 transition-colors',
                activeTab === 'saved'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground'
              )}
            >
              <Bookmark className="h-5 w-5" />
            </button>
            <button
              onClick={() => setActiveTab('mentions')}
              className={cn(
                'flex-1 py-3 flex items-center justify-center border-b-2 transition-colors',
                activeTab === 'mentions'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground'
              )}
            >
              <AtSign className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Posts Grid / List */}
        {activeTab === 'posts' && (() => {
          const displayPosts = selectedCollectionId ? collectionPosts : posts;
          return (
          <PullToRefresh onRefresh={refetch}>
            {postsLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Yuklanmoqda...</p>
              </div>
            ) : displayPosts.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Grid3X3 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">{selectedCollectionId ? "Bu ro'yxatda postlar yo'q" : "Hozircha postlar yo'q"}</p>
              </div>
            ) : (
              <div className="space-y-4 px-0 md:px-4">
                {displayPosts.map((post, index) => (
                  <div key={post.id} onClick={() => openViewer(index)} className="cursor-pointer">
                    <PostCard post={post} />
                  </div>
                ))}
                <EndOfFeed />
              </div>
            )}
          </PullToRefresh>
          );
        })()}

        {activeTab === 'saved' && (
          <div className="text-center py-12 px-4">
            <Bookmark className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground">Saqlangan postlar yo'q</p>
          </div>
        )}

        {/* Mentions tab */}
        {activeTab === 'mentions' && (
          <div>
            {userMentionedPosts.length === 0 && userCollabPosts.length === 0 ? (
              <div className="text-center py-12 px-4">
                <AtSign className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">Belgilangan postlar yo'q</p>
              </div>
            ) : (
              <div className="space-y-4 px-0 md:px-4">
                {[...userMentionedPosts, ...userCollabPosts]
                  .filter((v, i, a) => a.findIndex(p => p.id === v.id) === i)
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((post, index) => (
                    <div key={post.id} onClick={() => openViewer(index)} className="cursor-pointer">
                      <PostCard post={post} />
                    </div>
                  ))}
                <EndOfFeed />
              </div>
            )}
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
