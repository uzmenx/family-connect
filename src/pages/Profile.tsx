import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Settings, Edit, Grid3X3, Bookmark, Bell, AtSign, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { SocialLinksList } from '@/components/profile';
import { useUserPosts } from '@/hooks/useUserPosts';
import { useSavedPosts } from '@/hooks/useSavedPosts';
import { useFollow } from '@/hooks/useFollow';
import { useNotifications } from '@/hooks/useNotifications';
import { useStoryHighlights } from '@/hooks/useStoryHighlights';
import { useMentionsCollabs } from '@/hooks/useMentionsCollabs';
import { usePostCollections } from '@/hooks/usePostCollections';
import { useSmoothScroll } from '@/hooks/useSmoothScroll';
import { PostCard } from '@/components/feed/PostCard';
import { FullScreenViewer } from '@/components/feed/FullScreenViewer';
import { PullToRefresh } from '@/components/feed/PullToRefresh';
import { EndOfFeed } from '@/components/feed/EndOfFeed';
import { HighlightsRow } from '@/components/profile/HighlightsRow';
import { HighlightEditor } from '@/components/profile/HighlightEditor';
import { CollectionsFilter } from '@/components/profile/CollectionsFilter';
import { CollabRequestsSheet } from '@/components/post/CollabRequestsSheet';
import { NotificationsSheet } from '@/components/notifications/NotificationsSheet';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatCount } from '@/lib/formatCount';

const Profile = () => {
  const { profile, user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { posts, isLoading, postsCount, refetch, removePost } = useUserPosts(user?.id);
  const { savedPosts, isLoading: savedLoading, fetchSavedPosts } = useSavedPosts();
  const { followersCount, followingCount } = useFollow(user?.id);
  const { unreadCount } = useNotifications();
  const { highlights, fetchHighlights } = useStoryHighlights();
  const { collections, selectedCollectionId, setSelectedCollectionId, collectionPosts, createCollection } = usePostCollections();
  const { mentionedPosts, collabPosts, pendingCollabs, respondToCollab } = useMentionsCollabs();
  const [activeTab, setActiveTab] = useState<'posts' | 'saved' | 'mentions'>('posts');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [viewerPosts, setViewerPosts] = useState<typeof posts>([]);
  const [showNewHighlight, setShowNewHighlight] = useState(false);
  const [showCollabRequests, setShowCollabRequests] = useState(false);
  const [showPostsStats, setShowPostsStats] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [needsMoreButton, setNeedsMoreButton] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const bioRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bioRef.current && profile?.bio) {
      // Check if bio text overflows 3 lines
      const lineHeight = parseInt(window.getComputedStyle(bioRef.current).lineHeight) || 20;
      const maxHeight = lineHeight * 3;
      setNeedsMoreButton(bioRef.current.scrollHeight > maxHeight);
    }
  }, [profile?.bio]);
  const scrollContainerRef = useSmoothScroll(true, true);

  const hideHighlights = (profile as any)?.hide_highlights === true;
  const hideCollections = (profile as any)?.hide_collections === true;

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const openViewer = (index: number, postsList: typeof posts) => {
    setViewerInitialIndex(index);
    setViewerPosts(postsList);
    setViewerOpen(true);
  };

  const displayPosts = selectedCollectionId ? collectionPosts : posts;

  return (
    <AppLayout>
      <div className="min-h-screen pb-20 bg-background relative">
        {/* Animated Background - Behind all content */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-orange-900/20 animate-gradient-shift pointer-events-none" />
        
        {/* Content Container - Above background */}
        <div className="relative z-10">

        {/* ═══════════════════════════════════════
               COVER IMAGE
            ═══════════════════════════════════════ */}
        <div className="relative h-36 overflow-hidden">
          {(profile as any)?.cover_url ?
            <img
              src={(profile as any).cover_url}
              alt="Cover"
              className="w-full h-full object-cover" /> :


            <div className="w-full h-full bg-gradient-to-br from-primary via-accent to-primary/60" />
            }
          {/* Dark overlay for readability */}
          <div className="absolute inset-0 bg-black/20" />

          {/* Action buttons — top right */}
          <div className="absolute top-3 right-3 flex gap-2 z-10">
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setNotificationsOpen(true)}
                className="relative h-9 w-9 bg-black/30 backdrop-blur-md border border-white/20 hover:bg-black/50 text-white rounded-xl">

              <Bell className="h-4 w-4" />
              {unreadCount > 0 &&
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">

                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
                }
            </Button>
            <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/settings')}
                className="h-9 w-9 bg-black/30 backdrop-blur-md border border-white/20 hover:bg-black/50 text-white rounded-xl">

              <Settings className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/edit-profile')}
                className="h-9 w-9 bg-black/30 backdrop-blur-md border border-white/20 hover:bg-black/50 text-white rounded-xl">

              <Edit className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ═══════════════════════════════════════
               PROFILE HEADER BLOCK
            ═══════════════════════════════════════ */}
        <div className="px-4 -mt-10 relative z-10">

          {/* ROW 1: Followers | Avatar | Postlar */}
          <div className="flex items-end justify-between gap-1 mb-2">

            {/* LEFT: Followers */}
            <div className="flex-1 flex flex-col items-center justify-center bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl px-2 py-2 shadow-lg min-w-0">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                {t('followers')}
              </span>
              <span className="text-xl font-extrabold text-foreground leading-none">
                {formatCount(followersCount)}
              </span>
            </div>

            {/* CENTER: Avatar */}
            <div className="flex-shrink-0 flex flex-col items-center">
              <Avatar className="h-20 w-20 border-4 border-background shadow-2xl ring-2 ring-primary/30">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-accent text-white font-bold">
                  {getInitials(profile?.name)}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* RIGHT: Postlar */}
            <div className="flex-1 flex flex-col items-center justify-center bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl px-2 py-2 shadow-lg min-w-0 relative">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                {t('posts')}
              </span>
              <span className="text-xl font-extrabold text-foreground leading-none">
                {formatCount(postsCount)}
              </span>
              <button
                  onClick={() => setShowPostsStats(!showPostsStats)}
                  className="absolute -bottom-2 right-2 h-5 w-5 bg-muted rounded-full flex items-center justify-center hover:bg-muted-foreground/20 transition-all opacity-85"
                  style={{ transform: showPostsStats ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>

                <ChevronDown className="h-3 w-3 text-foreground" />
              </button>
            </div>
          </div>

          {/* ROW 2: Name & Username */}
          <div className="text-center mb-2">
            <h1 className="text-xl font-extrabold text-foreground leading-tight">
              {profile?.name || t('user')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              @{profile?.username || user?.email?.split('@')[0] || 'username'}
            </p>
          </div>

          {/* ROW 3: Kuzatilmoqda — centered */}
          {showPostsStats &&
            <div className="flex justify-center mb-2">
              <div className="flex flex-col items-center justify-center bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl px-6 py-2 shadow-lg">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                  {t('following')}
                </span>
                <span className="text-xl font-extrabold text-foreground leading-none">
                  {formatCount(followingCount)}
                </span>
              </div>
            </div>
            }

          {/* Bio */}
          {profile?.bio &&
            <div className="mb-2 px-4">
              <div className="bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl p-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
                <div className="relative">
                  <div
                    ref={bioRef}
                    className={`text-sm text-muted-foreground leading-relaxed transition-all duration-300 cursor-pointer ${
                    !bioExpanded && needsMoreButton ? 'line-clamp-3' : ''}`
                    }
                    style={{
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: bioExpanded ? 'unset' : '3'
                    }}
                    onClick={() => needsMoreButton && setBioExpanded(!bioExpanded)}>

                    {profile.bio}
                    {!bioExpanded && needsMoreButton &&
                    <span className="inline-flex items-center gap-1 ml-1">
                        <span className="text-blue-500 hover:underline">...</span>
                        <ChevronDown
                        className="h-4 w-4"
                        style={{ color: 'rgba(255,255,255,0.6)', transition: 'transform 0.2s' }} />

                      </span>
                    }
                    {bioExpanded &&
                    <span className="inline-flex items-center gap-1 ml-1">
                        <ChevronUp
                        className="h-4 w-4"
                        style={{ color: 'rgba(255,255,255,0.6)', transition: 'transform 0.2s' }} />

                      </span>
                    }
                  </div>
                </div>
              </div>
            </div>
            }

          {/* Social Links */}
          {(profile as any)?.social_links &&
            <div className="flex justify-center mb-2">
              <SocialLinksList links={(profile as any).social_links} className="justify-center" />
            </div>
            }
        </div>

        {/* ═══════════════════════════════════════
               STORY HIGHLIGHTS
            ═══════════════════════════════════════ */}
        {!hideHighlights &&
          <div className="flex justify-center">
            <HighlightsRow
              highlights={highlights}
              isOwner={true}
              onCreateNew={() => setShowNewHighlight(true)}
              onRefresh={fetchHighlights} />

          </div>
          }

        {/* ═══════════════════════════════════════
               COLLECTIONS FILTER
            ═══════════════════════════════════════ */}
        {!hideCollections && activeTab === 'posts' &&
          <div className="flex justify-center">
            <CollectionsFilter
              collections={collections}
              selectedId={selectedCollectionId}
              onSelect={setSelectedCollectionId}
              isOwner={true}
              onCreateCollection={(name) => createCollection(name)} />

          </div>
          }

        {/* ═══════════════════════════════════════
               TABS
            ═══════════════════════════════════════ */}
        <div className="px-4">
          <div className="flex border-b border-border mb-2">
            <button
                onClick={() => {setActiveTab('posts');setSelectedCollectionId(null);}}
                className={cn(
                  'flex-1 py-2 flex items-center justify-center border-b-2 transition-colors',
                  activeTab === 'posts' ?
                  'border-primary text-primary' :
                  'border-transparent text-muted-foreground'
                )}>

              <Grid3X3 className="h-5 w-5" />
            </button>
            <button
                onClick={() => setActiveTab('saved')}
                className={cn(
                  'flex-1 py-2 flex items-center justify-center border-b-2 transition-colors',
                  activeTab === 'saved' ?
                  'border-primary text-primary' :
                  'border-transparent text-muted-foreground'
                )}>

              <Bookmark className="h-5 w-5" />
            </button>
            <button
                onClick={() => setActiveTab('mentions')}
                className={cn(
                  'flex-1 py-2 flex items-center justify-center border-b-2 transition-colors',
                  activeTab === 'mentions' ?
                  'border-primary text-primary' :
                  'border-transparent text-muted-foreground'
                )}>

              <AtSign className="h-5 w-5" />
            </button>
            {pendingCollabs.length > 0 &&
              <button
                onClick={() => setShowCollabRequests(true)}
                className="py-3 px-3 flex items-center justify-center border-b-2 border-transparent text-muted-foreground relative">

                <Users className="h-5 w-5" />
                <Badge
                  variant="destructive"
                  className="absolute -top-0.5 -right-0.5 h-4 w-4 p-0 flex items-center justify-center text-[10px]">

                  {pendingCollabs.length}
                </Badge>
              </button>
              }
          </div>
        </div>

        <NotificationsSheet open={notificationsOpen} onOpenChange={setNotificationsOpen} />

        {/* ═══════════════════════════════════════
               POSTS TAB
            ═══════════════════════════════════════ */}
        {activeTab === 'posts' &&
          <PullToRefresh onRefresh={refetch}>
            {isLoading ?
            <div className="text-center py-12">
                <p className="text-muted-foreground">{t('loading')}</p>
              </div> :
            displayPosts.length === 0 ?
            <div className="text-center py-12 px-4">
                <Grid3X3 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  {selectedCollectionId ? "Bu ro'yxatda postlar yo'q" : t('noPosts')}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {!selectedCollectionId && t('createFirst')}
                </p>
              </div> :

            <div ref={scrollContainerRef} className="smooth-scroll-container space-y-4 px-0 md:px-4">
                {displayPosts.map((post, index) =>
              <div
                key={post.id}
                onClick={() => openViewer(index, displayPosts)}
                className="cursor-pointer smooth-scroll-item scroll-transition">

                    <PostCard post={post} onDelete={() => removePost(post.id)} />
                  </div>
              )}
                <EndOfFeed />
              </div>
            }
          </PullToRefresh>
          }

        {/* ═══════════════════════════════════════
               SAVED TAB
            ═══════════════════════════════════════ */}
        {activeTab === 'saved' &&
          <PullToRefresh onRefresh={fetchSavedPosts}>
            {savedLoading ?
            <div className="text-center py-12">
                <p className="text-muted-foreground">{t('loading')}</p>
              </div> :
            savedPosts.length === 0 ?
            <div className="text-center py-12 px-4">
                <Bookmark className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">{t('noSaved')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('savedHint')}</p>
              </div> :

            <div className="smooth-scroll-container space-y-4 px-0 md:px-4">
                {savedPosts.map((post, index) =>
              <div
                key={post.id}
                onClick={() => openViewer(index, savedPosts)}
                className="cursor-pointer smooth-scroll-item scroll-transition">

                    <PostCard post={post} />
                  </div>
              )}
                <EndOfFeed />
              </div>
            }
          </PullToRefresh>
          }

        {/* ═══════════════════════════════════════
               MENTIONS TAB
            ═══════════════════════════════════════ */}
        {activeTab === 'mentions' &&
          <div>
            {mentionedPosts.length === 0 && collabPosts.length === 0 ?
            <div className="text-center py-12 px-4">
                <AtSign className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">Hozircha belgilanmagan</p>
              </div> :

            <div className="smooth-scroll-container space-y-4 px-0 md:px-4">
                {[...mentionedPosts, ...collabPosts].
              filter((v, i, a) => a.findIndex((p) => p.id === v.id) === i).
              sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).
              map((post, index) =>
              <div
                key={post.id}
                onClick={() => openViewer(index, [...mentionedPosts, ...collabPosts])}
                className="cursor-pointer smooth-scroll-item scroll-transition">

                      <PostCard post={post} />
                    </div>
              )}
                <EndOfFeed />
              </div>
            }
          </div>
          }

        {/* ═══════════════════════════════════════
               MODALS
            ═══════════════════════════════════════ */}
        {viewerOpen && viewerPosts.length > 0 &&
          <FullScreenViewer
            posts={viewerPosts}
            initialIndex={viewerInitialIndex}
            onClose={() => setViewerOpen(false)} />

          }

        {showNewHighlight &&
          <HighlightEditor
            open={showNewHighlight}
            onClose={() => {setShowNewHighlight(false);fetchHighlights();}}
            isNew />

          }

        <CollabRequestsSheet
            open={showCollabRequests}
            onOpenChange={setShowCollabRequests}
            requests={pendingCollabs}
            onRespond={respondToCollab} />

        </div>
      </div>
    </AppLayout>);

};

export default Profile;