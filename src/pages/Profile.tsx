import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Settings, Edit, Grid3X3, Bookmark, Bell, AtSign, Users, ChevronDown } from 'lucide-react';
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
  const [showPostsStats, setShowPostsStats] = useState(false); // Dropdown state
  const scrollContainerRef = useSmoothScroll(true, true); // Enable snap and swipe gestures

  const hideHighlights = (profile as any)?.hide_highlights === true;
  const hideCollections = (profile as any)?.hide_collections === true;

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const openViewer = (index: number, postsList: typeof posts) => {
    setViewerInitialIndex(index);
    setViewerPosts(postsList);
    setViewerOpen(true);
  };

  const displayPosts = selectedCollectionId ? collectionPosts : posts;

  return (
    <AppLayout>
      <div className="min-h-screen pb-20">
        {/* Cover Image */}
        <div className="relative h-32 bg-gradient-to-r from-primary to-accent overflow-hidden">
          {(profile as any)?.cover_url && (
            <img src={(profile as any).cover_url} alt="Cover" className="w-full h-full object-cover" />
          )}
          
          {/* Action buttons - top right */}
          <div className="absolute top-4 right-4 flex gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/messages?tab=notifications')} 
              className="relative bg-white/20 backdrop-blur-md border border-white/30 hover:bg-white/30 text-white"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/settings')}
              className="bg-white/20 backdrop-blur-md border border-white/30 hover:bg-white/30 text-white"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/edit-profile')}
              className="bg-white/20 backdrop-blur-md border border-white/30 hover:bg-white/30 text-white"
            >
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Profile Info - Next.js Style Layout */}
        <div className="px-4">
          <div className="flex items-start justify-between gap-4 -mt-12 relative z-10 mb-4">
            {/* Left: Followers */}
            <div className="flex flex-col items-center gap-1 bg-white/20 backdrop-blur-md rounded-xl px-3 py-2 shadow-lg border border-white/30 mt-16">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide drop-shadow">
                {t('followers')}
              </span>
              <span className="text-2xl font-bold text-gray-900 drop-shadow">{formatCount(followersCount)}</span>
            </div>

            {/* Center: Profile photo */}
            <div className="relative group flex-shrink-0">
              <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="text-3xl bg-gradient-to-br from-primary to-accent text-white font-bold">
                  {getInitials(profile?.name)}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Right: Posts with dropdown */}
            <div className="flex flex-col items-center gap-1 bg-white/20 backdrop-blur-md rounded-xl px-3 py-2 shadow-lg border border-white/30 mt-16 relative">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide drop-shadow">
                {t('posts')}
              </span>
              <span className="text-2xl font-bold text-gray-900 drop-shadow">{formatCount(postsCount)}</span>
              <button
                onClick={() => setShowPostsStats(!showPostsStats)}
                className="absolute -bottom-2 right-2 w-5 h-5 bg-gray-700 rounded-full flex items-center justify-center hover:bg-gray-800 transition-all duration-300 transform"
                style={{
                  transform: showPostsStats ? "rotate(180deg)" : "rotate(0deg)",
                }}
              >
                <ChevronDown className="w-3 h-3 text-white" />
              </button>
            </div>
          </div>

          {/* Username and handle - centered */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{profile?.name || t('user')}</h1>
            <p className="text-gray-600">
              @{profile?.username || user?.email?.split('@')[0] || 'username'}
            </p>
          </div>

          {/* Following block below username */}
          <div className="flex justify-center mb-6">
            <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-xl px-4 py-2 shadow-lg">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide block mb-1 drop-shadow text-center">
                {t('following')}
              </span>
              <span className="text-2xl font-bold text-gray-900 drop-shadow text-center block">{formatCount(followingCount)}</span>
            </div>
          </div>

          {profile?.bio && (
            <p className="text-center text-gray-700 mb-6 max-w-md mx-auto">{profile.bio}</p>
          )}

          {(profile as any)?.social_links && (
            <SocialLinksList links={(profile as any).social_links} className="mb-6 justify-center" />
          )}
        </div>

        {/* Story Highlights Row */}
        {!hideHighlights && (
          <HighlightsRow
            highlights={highlights}
            isOwner={true}
            onCreateNew={() => setShowNewHighlight(true)}
            onRefresh={fetchHighlights}
          />
        )}

        {/* Collections filter chips */}
        {!hideCollections && activeTab === 'posts' && (
          <CollectionsFilter
            collections={collections}
            selectedId={selectedCollectionId}
            onSelect={setSelectedCollectionId}
            isOwner={true}
            onCreateCollection={(name) => createCollection(name)}
          />
        )}

        <div className="px-4">
          {/* Tabs */}
          <div className="flex border-b border-border mb-4">
            <button
              onClick={() => { setActiveTab('posts'); setSelectedCollectionId(null); }}
              className={cn(
                "flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors",
                activeTab === 'posts' ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              )}
            >
              <Grid3X3 className="h-5 w-5" />
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={cn(
                "flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors",
                activeTab === 'saved' ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              )}
            >
              <Bookmark className="h-5 w-5" />
            </button>
            <button
              onClick={() => setActiveTab('mentions')}
              className={cn(
                "flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors",
                activeTab === 'mentions' ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              )}
            >
              <AtSign className="h-5 w-5" />
            </button>
            {pendingCollabs.length > 0 && (
              <button
                onClick={() => setShowCollabRequests(true)}
                className="py-3 px-3 flex items-center justify-center gap-1 border-b-2 border-transparent text-muted-foreground relative"
              >
                <Users className="h-5 w-5" />
                <Badge variant="destructive" className="absolute -top-0.5 -right-0.5 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                  {pendingCollabs.length}
                </Badge>
              </button>
            )}
          </div>
        </div>

        {/* Posts */}
        {activeTab === 'posts' && (
          <PullToRefresh onRefresh={refetch}>
            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">{t('loading')}</p>
              </div>
            ) : displayPosts.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Grid3X3 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">{selectedCollectionId ? "Bu ro'yxatda postlar yo'q" : t('noPosts')}</p>
                <p className="text-sm text-muted-foreground mt-1">{!selectedCollectionId && t('createFirst')}</p>
              </div>
            ) : (
              <div ref={scrollContainerRef} className="smooth-scroll-container space-y-4 px-0 md:px-4">
                {displayPosts.map((post, index) => (
                  <div key={post.id} onClick={() => openViewer(index, displayPosts)} className="cursor-pointer smooth-scroll-item scroll-transition">
                    <PostCard post={post} onDelete={() => removePost(post.id)} />
                  </div>
                ))}
                <EndOfFeed />
              </div>
            )}
          </PullToRefresh>
        )}

        {activeTab === 'saved' && (
          <PullToRefresh onRefresh={fetchSavedPosts}>
            {savedLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">{t('loading')}</p>
              </div>
            ) : savedPosts.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Bookmark className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">{t('noSaved')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('savedHint')}</p>
              </div>
            ) : (
              <div className="smooth-scroll-container space-y-4 px-0 md:px-4">
                {savedPosts.map((post, index) => (
                  <div key={post.id} onClick={() => openViewer(index, savedPosts)} className="cursor-pointer smooth-scroll-item scroll-transition">
                    <PostCard post={post} />
                  </div>
                ))}
                <EndOfFeed />
              </div>
            )}
          </PullToRefresh>
        )}

        {/* Mentions tab */}
        {activeTab === 'mentions' && (
          <div>
            {mentionedPosts.length === 0 && collabPosts.length === 0 ? (
              <div className="text-center py-12 px-4">
                <AtSign className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">Hozircha belgilanmagan</p>
              </div>
            ) : (
              <div className="smooth-scroll-container space-y-4 px-0 md:px-4">
                {[...mentionedPosts, ...collabPosts]
                  .filter((v, i, a) => a.findIndex(p => p.id === v.id) === i)
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((post, index) => (
                    <div key={post.id} onClick={() => openViewer(index, [...mentionedPosts, ...collabPosts])} className="cursor-pointer smooth-scroll-item scroll-transition">
                      <PostCard post={post} />
                    </div>
                  ))}
                <EndOfFeed />
              </div>
            )}
          </div>
        )}

        {viewerOpen && viewerPosts.length > 0 && (
          <FullScreenViewer posts={viewerPosts} initialIndex={viewerInitialIndex} onClose={() => setViewerOpen(false)} />
        )}

        {showNewHighlight && (
          <HighlightEditor open={showNewHighlight} onClose={() => { setShowNewHighlight(false); fetchHighlights(); }} isNew />
        )}

        <CollabRequestsSheet
          open={showCollabRequests}
          onOpenChange={setShowCollabRequests}
          requests={pendingCollabs}
          onRespond={respondToCollab}
        />
      </div>
    </AppLayout>
  );
};

export default Profile;
