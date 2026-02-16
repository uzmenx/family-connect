import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PostCard } from "@/components/feed/PostCard";
import { FullScreenViewer } from "@/components/feed/FullScreenViewer";
import { PullToRefresh } from "@/components/feed/PullToRefresh";
import { EndOfFeed } from "@/components/feed/EndOfFeed";
import { StoriesRow } from "@/components/stories/StoriesRow";
import { StoryViewer } from "@/components/stories/StoryViewer";
import { useAuth } from "@/contexts/AuthContext";
import { useStories } from "@/hooks/useStories";
import { usePostsCache } from "@/hooks/usePostsCache";
import { Grid2X2, LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Post } from "@/types";

type GridLayout = 1 | 2;

const Home = () => {
  const { user } = useAuth();
  const { storyGroups, refetch: refetchStories } = useStories();
  const { posts, isLoading, isRefreshing, fetchPosts } = usePostsCache();
  const [gridLayout, setGridLayout] = useState<GridLayout>(1);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

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
      <div className="max-w-lg mx-auto h-[calc(100vh-4rem)]">
        <header className="sticky top-0 bg-background/95 backdrop-blur-sm border-b px-4 z-40 rounded-full border border-primary-foreground gap-0 mx-0 my-0 py-[1.5px] flex-row flex items-center justify-between shadow-2xs">
          <h1 className="text-xl font-bold">Qarindosh</h1>
          <Button variant="ghost" size="icon" onClick={toggleGridLayout} className="h-9 w-9">
            {getGridIcon()}
          </Button>
        </header>

        {/* Stories row */}
        <StoriesRow onStoryClick={openStoryViewer} />

        <PullToRefresh onRefresh={handleRefresh}>
          {isLoading ?
          <div className="text-center py-12">
              <p className="text-muted-foreground">Yuklanmoqda...</p>
            </div> :
          posts.length === 0 ?
          <div className="text-center py-12">
              <p className="text-muted-foreground">Hozircha postlar yo'q</p>
              <p className="text-sm text-muted-foreground mt-2">Birinchi postni yarating!</p>
            </div> :
          gridLayout === 1 ?
          <div className="space-y-4 pb-20">
              {posts.map((post, index) =>
            <PostCard key={post.id} post={post} onMediaClick={() => openViewer(index)} />
            )}
              <EndOfFeed />
            </div> :

          <div className="pb-20">
              <div className="flex gap-1 p-1">
                <div className="flex-1 flex flex-col gap-1">
                  {posts.
                filter((_, i) => i % 2 === 0).
                map((post) => {
                  const originalIndex = posts.findIndex((p) => p.id === post.id);
                  return (
                    <div key={post.id} onClick={() => openViewer(originalIndex)} className="cursor-pointer">
                          <MasonryItem post={post} />
                        </div>);

                })}
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  {posts.
                filter((_, i) => i % 2 === 1).
                map((post) => {
                  const originalIndex = posts.findIndex((p) => p.id === post.id);
                  return (
                    <div key={post.id} onClick={() => openViewer(originalIndex)} className="cursor-pointer">
                          <MasonryItem post={post} />
                        </div>);

                })}
                </div>
              </div>
              <EndOfFeed />
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
    <div className="relative overflow-hidden rounded-sm bg-muted">
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