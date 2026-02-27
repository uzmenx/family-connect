import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Grid3X3, Bookmark, Users, AtSign, ChevronDown, ChevronUp, Grid2X2, LayoutList, Columns2 } from 'lucide-react';
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
import { useActiveStories } from '@/hooks/useActiveStories';
import { getStoryRingGradient } from '@/components/stories/storyRings';
import { StoryViewer } from '@/components/stories/StoryViewer';
import type { StoryGroup, Story } from '@/hooks/useStories';
import { Post } from '@/types';
import { useAutoPreviewVideo } from '@/hooks/useAutoPreviewVideo';

const UserProfileMasonryItem = ({ post }: { post: Post }) => {
  const mediaUrl = ((post.media_urls && post.media_urls.length > 0 ? post.media_urls[0] : (post.image_url || '')) || '') as string;
  const isVideo = !!mediaUrl && (mediaUrl.includes('.mp4') || mediaUrl.includes('.mov') || mediaUrl.includes('.webm'));
  const videoRef = useRef<HTMLVideoElement>(null);
  useAutoPreviewVideo(videoRef, { enabled: isVideo, delayMs: 3000, threshold: 0.6 });
  return (
    <div className="relative aspect-[3/4] rounded-[20px] overflow-hidden bg-muted/80 shadow-xl shadow-black/20 border border-white/10">
      {mediaUrl ? (
        isVideo ? (
          <video
            ref={videoRef}
            src={mediaUrl}
            className="w-full h-full object-cover"
            muted
            playsInline
            loop
            preload="metadata"
          />
        ) : (
          <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
        )
      ) : (
        <div className="w-full h-full bg-muted" />
      )}
    </div>
  );
};

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
  const { getStoryInfo } = useActiveStories();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { posts, isLoading: postsLoading, postsCount, refetch } = useUserPosts(userId);
  const { followersCount, followingCount } = useFollow(userId);
  const [activeTab, setActiveTab] = useState<'posts' | 'saved' | 'mentions'>('posts');
  const [postsLayout, setPostsLayout] = useState<'pinterest2' | 'pinterest1' | 'list'>('pinterest2');
  const lastPostsTabTapTsRef = useRef<number>(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [showPostsStats, setShowPostsStats] = useState(false);
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [profileStoryGroups, setProfileStoryGroups] = useState<StoryGroup[]>([]);
  
  // Bio expand/collapse states
  const [bioExpanded, setBioExpanded] = useState(false);
  const [needsMoreButton, setNeedsMoreButton] = useState(false);
  const bioRef = useRef<HTMLDivElement>(null);
  
  const { highlights } = useStoryHighlights(userId);
  const { collections, selectedCollectionId, setSelectedCollectionId, collectionPosts } = usePostCollections(userId);
  const { mentionedPosts: userMentionedPosts, collabPosts: userCollabPosts } = useMentionsCollabs(userId);

  const cyclePostsLayout = useCallback(() => {
    setPostsLayout((prev) => (prev === 'pinterest2' ? 'pinterest1' : prev === 'pinterest1' ? 'list' : 'pinterest2'));
  }, []);

  const togglePostsLayoutHidden = useCallback(() => {
    setPostsLayout((prev) => (prev === 'list' ? 'pinterest2' : 'list'));
  }, []);

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

  // Bio overflow detection
  useEffect(() => {
    if (bioRef.current && profile?.bio) {
      // Check if bio text overflows 3 lines
      const lineHeight = parseInt(window.getComputedStyle(bioRef.current).lineHeight) || 20;
      const maxHeight = lineHeight * 3;
      setNeedsMoreButton(bioRef.current.scrollHeight > maxHeight);
    }
  }, [profile?.bio]);

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

  const fetchStoryGroupForUser = useCallback(async (targetUserId: string): Promise<StoryGroup | null> => {
    try {
      const { data: stories, error } = await supabase
        .from('stories')
        .select('*')
        .eq('user_id', targetUserId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!stories || stories.length === 0) return null;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .in('id', [targetUserId]);

      const authorProfile = profiles?.find(p => p.id === targetUserId);

      const viewerId = currentUser?.id;

      const [viewsRes, likesRes] = await Promise.all([
        viewerId
          ? supabase
              .from('story_views')
              .select('story_id')
              .eq('viewer_id', viewerId)
              .in('story_id', stories.map(s => s.id))
          : Promise.resolve({ data: [] as any[] }),
        viewerId
          ? supabase
              .from('story_likes')
              .select('story_id')
              .eq('user_id', viewerId)
              .in('story_id', stories.map(s => s.id))
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const viewedStoryIds = new Set((viewsRes as any)?.data?.map((v: any) => v.story_id) || []);
      const likedStoryIds = new Set((likesRes as any)?.data?.map((l: any) => l.story_id) || []);

      const normalizedStories: Story[] = stories.map((s: any) => ({
        ...s,
        media_type: s.media_type as 'image' | 'video',
        ring_id: s.ring_id || 'default',
        author: authorProfile
          ? {
              id: authorProfile.id,
              name: authorProfile.name,
              username: authorProfile.username,
              avatar_url: authorProfile.avatar_url,
            }
          : undefined,
        has_viewed: viewerId ? viewedStoryIds.has(s.id) : false,
        has_liked: viewerId ? likedStoryIds.has(s.id) : false,
      }));

      const hasUnviewed = normalizedStories.some(s => !s.has_viewed);

      return {
        user_id: targetUserId,
        user: authorProfile || { id: targetUserId, name: null, username: null, avatar_url: null },
        stories: normalizedStories,
        has_unviewed: hasUnviewed,
      };
    } catch (err) {
      console.error('Error fetching profile stories:', err);
      return null;
    }
  }, [currentUser?.id]);

  const openProfileStories = useCallback(async () => {
    if (!userId) return;
    const g = await fetchStoryGroupForUser(userId);
    if (!g) {
      toast({ title: 'Hikoya topilmadi' });
      return;
    }
    setProfileStoryGroups([g]);
    setStoryViewerOpen(true);
  }, [fetchStoryGroupForUser, toast, userId]);

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
          <div className="flex items-end justify-between gap-1 mb-2">

            {/* LEFT: Followers */}
            <div className="flex-1 flex flex-col items-center justify-center bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl px-2 py-2 shadow-lg min-w-0">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                Kuzatuvchilar
              </span>
              <span className="text-xl font-extrabold text-foreground leading-none">
                {formatCount(followersCount)}
              </span>
            </div>

            {/* CENTER: Avatar (with story ring when user has active story) */}
            <div className="flex-shrink-0 flex flex-col items-center">
              {(() => {
                const info = userId ? getStoryInfo(userId) : undefined;
                if (info) {
                  return (
                    <div
                      className="h-20 w-20 rounded-full p-[3px] cursor-pointer shadow-2xl"
                      style={{
                        background: info.has_unviewed ? getStoryRingGradient(info.ring_id as any) : 'var(--muted-foreground)',
                      }}
                      onClick={openProfileStories}
                    >
                      <div className="w-full h-full rounded-full bg-background p-[2px]">
                        <Avatar className="h-full w-full">
                          <AvatarImage src={profile.avatar_url || undefined} />
                          <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-accent text-white font-bold">
                            {getInitials(profile.name)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </div>
                  );
                }

                return (
                  <Avatar className="h-20 w-20 border-4 border-background shadow-2xl ring-2 ring-primary/30">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-accent text-white font-bold">
                      {getInitials(profile.name)}
                    </AvatarFallback>
                  </Avatar>
                );
              })()}
            </div>

            {/* RIGHT: Postlar */}
            <div className="flex-1 flex flex-col items-center justify-center bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl px-2 py-2 shadow-lg min-w-0 relative">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                Postlar
              </span>
              <span className="text-xl font-extrabold text-foreground leading-none">
                {formatCount(postsCount)}
              </span>
              <button
                onClick={() => setShowPostsStats(!showPostsStats)}
                className="absolute -bottom-2 right-2 h-5 w-5 bg-muted rounded-full flex items-center justify-center hover:bg-muted-foreground/20 transition-all"
                style={{ transform: showPostsStats ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}
              >
                <ChevronDown className="h-3 w-3 text-foreground" />
              </button>
            </div>
          </div>

          {/* ROW 2: Name & Username */}
          <div className="text-center mb-2">
            <h1 className="text-xl font-extrabold text-foreground leading-tight">
              {profile.name || 'Foydalanuvchi'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              @{profile.username || 'username'}
            </p>
          </div>

          {/* ROW 3: Kuzatilmoqda — centered */}
          {showPostsStats && (
            <div className="flex justify-center mb-2">
              <div className="flex flex-col items-center justify-center bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl px-6 py-2 shadow-lg">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                  Kuzatilmoqda
                </span>
                <span className="text-xl font-extrabold text-foreground leading-none">
                  {formatCount(followingCount)}
                </span>
              </div>
            </div>
          )}

          {/* Bio */}
          {profile.bio && (
            <div className="mb-2 px-4">
              <div className="bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl p-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
                <div className="relative">
                  <div 
                    ref={bioRef}
                    className={`text-sm text-muted-foreground leading-relaxed transition-all duration-300 cursor-pointer ${
                      !bioExpanded && needsMoreButton ? 'line-clamp-3' : ''
                    }`}
                    style={{
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: bioExpanded ? 'unset' : '3'
                    }}
                    onClick={() => needsMoreButton && setBioExpanded(!bioExpanded)}
                  >
                    {profile.bio}
                    {!bioExpanded && needsMoreButton && (
                      <span className="inline-flex items-center gap-1 ml-1">
                        <span className="text-blue-500 hover:underline">...</span>
                        <ChevronDown 
                          className="h-4 w-4"
                          style={{ color: 'rgba(255,255,255,0.6)', transition: 'transform 0.2s' }}
                        />
                      </span>
                    )}
                    {bioExpanded && (
                      <span className="inline-flex items-center gap-1 ml-1">
                        <ChevronUp 
                          className="h-4 w-4"
                          style={{ color: 'rgba(255,255,255,0.6)', transition: 'transform 0.2s' }}
                        />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Social Links */}
          {profile.social_links && (
            <div className="flex justify-center mb-2">
              <SocialLinksList links={profile.social_links} className="justify-center" />
            </div>
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
          <CollectionsFilter
            collections={collections}
            selectedId={selectedCollectionId}
            onSelect={setSelectedCollectionId}
            isOwner={false}
          />
        )}

        {/* ═══════════════════════════════════════
            TABS
        ═══════════════════════════════════════ */}
        <div className="px-4">
          <div className="flex border-b border-border mb-2">
            <button
              onClick={() => {
                const now = Date.now();
                if (activeTab === 'posts') {
                  togglePostsLayoutHidden();
                  return;
                }

                if (now - lastPostsTabTapTsRef.current < 350) {
                  setActiveTab('posts');
                  togglePostsLayoutHidden();
                } else {
                  setActiveTab('posts');
                }

                lastPostsTabTapTsRef.current = now;
              }}
              className={cn(
                'flex-1 py-2 flex items-center justify-center border-b-2 transition-colors',
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
                'flex-1 py-2 flex items-center justify-center border-b-2 transition-colors',
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
                'flex-1 py-2 flex items-center justify-center border-b-2 transition-colors',
                activeTab === 'mentions'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground'
              )}
            >
              <AtSign className="h-5 w-5" />
            </button>

            {activeTab === 'posts' && false && (
              <button
                type="button"
                onClick={cyclePostsLayout}
                className={cn(
                  'py-2 px-3 flex items-center justify-center border-b-2 transition-colors',
                  'border-transparent text-muted-foreground hover:text-foreground'
                )}
                aria-label="Toggle posts layout"
              >
                {postsLayout === 'list' ? (
                  <LayoutList className="h-5 w-5" />
                ) : postsLayout === 'pinterest1' ? (
                  <Columns2 className="h-5 w-5" />
                ) : (
                  <Grid2X2 className="h-5 w-5" />
                )}
              </button>
            )}
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
            ) : postsLayout === 'list' ? (
              <div className="space-y-4 px-0 md:px-4">
                {displayPosts.map((post, index) => (
                  <div key={post.id} onClick={() => openViewer(index)} className="cursor-pointer">
                    <PostCard post={post} />
                  </div>
                ))}
                <EndOfFeed />
              </div>
            ) : postsLayout === 'pinterest1' ? (
              <div className="pb-20 px-px">
                <div className="flex flex-col gap-1 p-1">
                  {displayPosts.map((post, idx) => (
                    <div key={post.id} onClick={() => openViewer(idx)} className="cursor-pointer">
                      <UserProfileMasonryItem post={post} />
                    </div>
                  ))}
                </div>
                <EndOfFeed />
              </div>
            ) : (
              <div className="pb-20 px-px">
                <div className="flex gap-1 p-1">
                  <div className="flex-1 flex flex-col gap-1">
                    {displayPosts
                      .filter((_, i) => i % 2 === 0)
                      .map((post) => {
                        const idx = displayPosts.findIndex((p) => p.id === post.id);
                        return (
                          <div key={post.id} onClick={() => openViewer(idx)} className="cursor-pointer">
                            <UserProfileMasonryItem post={post} />
                          </div>
                        );
                      })}
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    {displayPosts
                      .filter((_, i) => i % 2 === 1)
                      .map((post) => {
                        const idx = displayPosts.findIndex((p) => p.id === post.id);
                        return (
                          <div key={post.id} onClick={() => openViewer(idx)} className="cursor-pointer">
                            <UserProfileMasonryItem post={post} />
                          </div>
                        );
                      })}
                  </div>
                </div>
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

        {/* Story Viewer for this profile only */}
        {storyViewerOpen && profileStoryGroups.length > 0 && (
          <StoryViewer
            storyGroups={profileStoryGroups}
            initialGroupIndex={0}
            onClose={() => setStoryViewerOpen(false)}
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
