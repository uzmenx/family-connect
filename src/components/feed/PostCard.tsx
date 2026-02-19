import { useState, useEffect } from 'react';

import { createPortal } from 'react-dom';

import { motion } from 'framer-motion';

import { Card, CardContent } from '@/components/ui/card';

import { Post } from '@/types';

import { formatDistanceToNow } from 'date-fns';

import { MediaCarousel } from '@/components/post/MediaCarousel';

import { PostActions } from '@/components/post/PostActions';

import { PostCaption } from '@/components/post/PostCaption';

import { PostMenu } from '@/components/post/PostMenu';

import { UserAvatar } from '@/components/user/UserAvatar';

import { UserInfo } from '@/components/user/UserInfo';

import { FollowButton } from '@/components/user/FollowButton';

import { SamsungUltraVideoPlayer } from '@/components/video/SamsungUltraVideoPlayer';

import { supabase } from '@/integrations/supabase/client';



interface PostCardProps {

  post: Post;

  onDelete?: () => void;

  onMediaClick?: () => void;

  index?: number;

}



export const PostCard = ({ post, onDelete, onMediaClick, index = 0 }: PostCardProps) => {

  const [showVideoPlayer, setShowVideoPlayer] = useState(false);

  const [videoPlayerSrc, setVideoPlayerSrc] = useState('');

  const [collabPartner, setCollabPartner] = useState<{name: string | null;username: string | null;} | null>(null);

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });



  // Fetch collab partner for this post

  useEffect(() => {

    (async () => {

      const { data: collabs } = await supabase.

      from('post_collabs').

      select('user_id').

      eq('post_id', post.id).

      eq('status', 'accepted').

      limit(1);

      if (collabs && collabs.length > 0) {

        const { data: profile } = await supabase.

        from('profiles').

        select('name, username').

        eq('id', collabs[0].user_id).

        single();

        if (profile) setCollabPartner(profile);

      }

    })();

  }, [post.id]);



  const mediaUrls = post.media_urls?.length > 0 ?

  post.media_urls :

  post.image_url ?

  [post.image_url] :

  [];



  const isVideo = (url: string) => url?.includes('.mp4') || url?.includes('.mov') || url?.includes('.webm');

  const firstVideoUrl = mediaUrls.find((url) => isVideo(url));



  const card =

  <Card className="overflow-hidden border-0 rounded-[20px] border border-white/20 bg-white/10 backdrop-blur-[10px] shadow-xl shadow-black/20">

      <CardContent className="p-0">

        {/* Header */}

        <div className="flex items-center justify-between p-3">

          <div className="flex items-center gap-3">

            <UserAvatar

            userId={post.user_id}

            avatarUrl={post.author?.avatar_url}

            name={post.author?.full_name} />



            <div className="flex flex-col">

              <div className="flex items-center gap-1">

                <UserInfo

                userId={post.user_id}

                name={post.author?.full_name}

                username={post.author?.username} />



                {collabPartner &&

              <span className="text-xs text-muted-foreground">

                    &amp; {collabPartner.username || collabPartner.name}

                  </span>

              }

              </div>

            </div>

          </div>

          <div className="flex items-center gap-2">

            <FollowButton targetUserId={post.user_id} size="sm" />

            <PostMenu

            postId={post.id}

            authorId={post.user_id}

            onDelete={onDelete} />



          </div>

        </div>

        

        {/* Media - ONLY media area triggers fullscreen */}

        {mediaUrls.length > 0 &&

      <div

        onClick={onMediaClick}

        className={onMediaClick ? "cursor-pointer" : ""}>



            <MediaCarousel mediaUrls={mediaUrls} />

          </div>

      }

        

        {/* Actions - does NOT trigger fullscreen */}

        <div className="p-3 space-y-2">

          <PostActions

          postId={post.id}

          initialLikesCount={post.likes_count}

          initialCommentsCount={post.comments_count}

          videoUrl={firstVideoUrl}

          onOpenVideoPlayer={(url) => {

            setVideoPlayerSrc(url);

            setShowVideoPlayer(true);

          }} />



          

          {post.content &&

        <PostCaption

          username={post.author?.username || 'user'}

          content={post.content}

          postId={post.id} />



        }

          

          <p className="text-xs text-muted-foreground uppercase">{timeAgo}</p>

        </div>

      </CardContent>



    </Card>;





  // Video pleer overlay: body ga portal orqali (scroll/post card transform ta'sir qilmasin)

  const videoPlayerOverlay = showVideoPlayer &&

  <div

    className="fixed inset-0 z-[60] w-full h-full min-h-[100dvh] overflow-hidden bg-black/80 backdrop-blur-[10px]"

    style={{ height: '100dvh', maxHeight: '100dvh' }}>



      <SamsungUltraVideoPlayer

      src={videoPlayerSrc}

      title={post.content?.slice(0, 50) || 'Video'}

      onClose={() => setShowVideoPlayer(false)} />



    </div>;





  return (

    <>

      <motion.div

        initial={{ opacity: 0, y: 20 }}

        animate={{ opacity: 1, y: 0 }}

        transition={{ duration: 0.4, delay: Math.min(index * 0.06, 0.4), ease: [0.25, 0.46, 0.45, 0.94] }} className="py-[3px]">



        {card}

      </motion.div>

      {typeof document !== 'undefined' && videoPlayerOverlay && createPortal(videoPlayerOverlay, document.body)}

    </>);



};