import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { PostCard } from "@/components/feed/PostCard";
import { FullScreenViewer } from "@/components/feed/FullScreenViewer";
import { PullToRefresh } from "@/components/feed/PullToRefresh";
import { EndOfFeed } from "@/components/feed/EndOfFeed";
import { StoriesRow } from "@/components/stories/StoriesRow";
import { StoryViewer } from "@/components/stories/StoryViewer";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useStories } from "@/hooks/useStories";
import { usePostsCache } from "@/hooks/usePostsCache";
import { Grid2X2, LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Post } from "@/types";

type GridLayout = 1 | 2;

const Home = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { storyGroups, refetch: refetchStories } = useStories();
  const { posts, isLoading, isRefreshing, isLoadingMore, hasMore, fetchPosts, loadMore } = usePostsCache();
  const [gridLayout, setGridLayout] = useState<GridLayout>(1);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  // Story viewer state
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [storyGroupIndex, setStoryGroupIndex] = useState(0);

  const openViewer = (index: number) => {
    setViewerInitialIndex(index);
    setViewerOpen(true);
  };

  const openStoryViewer = (groupIndex: number) => {
    setStoryGroupIndex(groupIndex);
    setStoryViewerOpen(true);
  };

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Infinite scroll: load more when sentinel enters viewport
  const handleLoadMore = useCallback(() => {
    if (isLoading || isLoadingMore || !hasMore || posts.length === 0) return;
    loadMore();
  }, [isLoading, isLoadingMore, hasMore, posts.length, loadMore]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) handleLoadMore();
      },
      { rootMargin: "200px", threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleLoadMore]);

  const handleRefresh = async () => {
    await Promise.all([fetchPosts(true), refetchStories()]);
  };

  const toggleGridLayout = () => {
    setGridLayout((prev) => prev === 1 ? 2 : 1);
  };

  const getGridIcon = () => {
    return gridLayout === 1 ? <LayoutList className="h-5 w-5" /> : <Grid2X2 className="h-5 w-5" />;
  };

  const hideNav = viewerOpen || storyViewerOpen;

  return (
    <AppLayout showNav={!hideNav}>
      {/* Animated gradient background (home only) */}
      <div className="fixed inset-0 z-0 home-gradient-bg" aria-hidden />

      <div className="relative z-10 max-w-lg mx-auto min-h-[calc(100vh-4rem)]">
        <motion.header
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="sticky top-0 z-40 px-4 py-3 flex items-center justify-between rounded-2xl mx-3 mt-2 mb-0 border border-white/10 bg-background/40 backdrop-blur-xl shadow-lg"
        >
          <h1 className="text-xl font-bold tracking-tight">{t('feed')}</h1>
          <Button variant="ghost" size="icon" onClick={toggleGridLayout} className="h-9 w-9 rounded-xl">
            {getGridIcon()}
          </Button>
        </motion.header>

        {/* Stories row */}
        <StoriesRow onStoryClick={openStoryViewer} />

        <PullToRefresh onRefresh={handleRefresh}>
          {isLoading ?
          <div className="text-center py-12">
               <p className="text-muted-foreground">{t('loading')}</p>
            </div> :
          posts.length === 0 ?
           <div className="text-center py-12">
               <p className="text-muted-foreground">{t('noPostsYet')}</p>
               <p className="text-sm text-muted-foreground mt-2">{t('createFirstPost')}</p>
            </div> :
          gridLayout === 1 ?
          <div className="space-y-4 pb-20 px-3">
              {posts.map((post, index) => (
            <PostCard
              key={post.id}
              post={post}
              onMediaClick={() => openViewer(index)}
              index={index}
            />
            ))}
              <div ref={loadMoreSentinelRef} className="h-4 min-h-4" aria-hidden />
              {isLoadingMore && (
                 <div className="text-center py-4 text-muted-foreground text-sm">{t('loading')}</div>
              )}
              {!hasMore && posts.length > 0 && <EndOfFeed />}
            </div> :

          <div className="pb-20 px-3">
              <div className="flex gap-1 p-1">
                <div className="flex-1 flex flex-col gap-1">
                  {posts.
                filter((_, i) => i % 2 === 0).
                map((post) => {
                  const originalIndex = posts.findIndex((p) => p.id === post.id);
                  return (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: (originalIndex % 2) * 0.05 }}
                      onClick={() => openViewer(originalIndex)}
                      className="cursor-pointer"
                    >
                          <MasonryItem post={post} />
                        </motion.div>);

                })}
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  {posts.
                filter((_, i) => i % 2 === 1).
                map((post) => {
                  const originalIndex = posts.findIndex((p) => p.id === post.id);
                  return (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: (originalIndex % 2) * 0.05 }}
                      onClick={() => openViewer(originalIndex)}
                      className="cursor-pointer"
                    >
                          <MasonryItem post={post} />
                        </motion.div>);

                })}
                </div>
              </div>
              <div ref={loadMoreSentinelRef} className="h-4 min-h-4" aria-hidden />
              {isLoadingMore && (
                <div className="text-center py-4 text-muted-foreground text-sm">{t('loading')}</div>
              )}
              {!hasMore && posts.length > 0 && <EndOfFeed />}
            </div>
          }
        </PullToRefresh>

        {viewerOpen &&
        <FullScreenViewer posts={posts} initialIndex={viewerInitialIndex} onClose={() => setViewerOpen(false)} />
        }

        {storyViewerOpen && storyGroups.length > 0 &&
        <StoryViewer
          storyGroups={storyGroups}
          initialGroupIndex={storyGroupIndex}
          onClose={() => setStoryViewerOpen(false)} />

        }
      </div>
    </AppLayout>);

};

const MasonryItem = ({ post }: {post: Post;}) => {
  const mediaUrl = post.media_urls?.[0] || post.image_url;
  const isVideo = mediaUrl && (mediaUrl.includes(".mp4") || mediaUrl.includes(".mov") || mediaUrl.includes(".webm"));

  return (
    <div className="relative overflow-hidden rounded-[20px] bg-muted/80 shadow-xl shadow-black/20 border border-white/10">
      {mediaUrl ?
      <>
          {isVideo ?
        <video src={mediaUrl} className="w-full h-auto block" style={{ maxHeight: "80vh" }} /> :

        <img src={mediaUrl} alt="Post" className="w-full h-auto block" style={{ maxHeight: "80vh" }} />
        }
          {post.media_urls && post.media_urls.length > 1 &&
        <div className="absolute top-2 right-2 bg-background/80 rounded px-1.5 py-0.5 text-xs font-medium">
              +{post.media_urls.length - 1}
            </div>
        }
        </> :

      <div className="w-full aspect-square flex items-center justify-center text-muted-foreground text-xs p-2 text-center">
          {post.content?.substring(0, 50)}
        </div>
      }
    </div>);

};

export default Home;