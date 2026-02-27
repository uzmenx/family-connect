import { supabase } from '@/integrations/supabase/client';
import { uploadMedia } from '@/lib/r2Upload';

export type PublishTask = {
  id: string;
  userId: string;
  files: File[];
  caption: string;
  sharePost: boolean;
  shareStory: boolean;
  ringId: string;
  mentionIds: string[];
  collabIds: string[];
};

type PublishProgressEvent = {
  taskId: string;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  message?: string;
};

const emitter = new EventTarget();

export const onPublishProgress = (handler: (e: PublishProgressEvent) => void) => {
  const listener = (evt: Event) => handler((evt as CustomEvent<PublishProgressEvent>).detail);
  emitter.addEventListener('publish-progress', listener);
  return () => emitter.removeEventListener('publish-progress', listener);
};

const emit = (detail: PublishProgressEvent) => {
  emitter.dispatchEvent(new CustomEvent('publish-progress', { detail }));
};

export const startBackgroundPublish = (task: PublishTask) => {
  void runPublish(task);
};

const runPublish = async (task: PublishTask) => {
  try {
    if (!task.sharePost && !task.shareStory) {
      emit({ taskId: task.id, progress: 0, status: 'error', message: 'Post yoki Story-dan kamida birini tanlang' });
      return;
    }

    emit({ taskId: task.id, progress: 5, status: 'uploading' });

    const total = (task.sharePost ? task.files.length : 0) + (task.shareStory ? 1 : 0) + 1;
    let done = 0;
    const tick = () => {
      done += 1;
      const next = Math.min(95, Math.round((done / total) * 90) + 5);
      emit({ taskId: task.id, progress: next, status: 'uploading' });
    };

    let postUrls: string[] = [];
    if (task.sharePost) {
      const uploads = await Promise.all(
        task.files.map(async (f) => {
          const url = await uploadMedia(f, 'posts', task.userId);
          tick();
          return url;
        })
      );
      postUrls = uploads.filter(Boolean);
    }

    let storyUrl: string | null = null;
    if (task.shareStory) {
      storyUrl = await uploadMedia(task.files[0], 'stories', task.userId);
      tick();
    }

    if (task.sharePost && postUrls.length > 0) {
      const { data: post, error } = await supabase
        .from('posts')
        .insert({
          user_id: task.userId,
          content: task.caption || null,
          media_urls: postUrls,
        })
        .select()
        .single();

      if (error) throw error;

      if (post) {
        const captionMentions = (task.caption.match(/@(\w+)/g) || []).map((m) => m.slice(1));
        let allMentionIds = [...task.mentionIds];
        if (captionMentions.length > 0) {
          const { data: mp } = await supabase.from('profiles').select('id, username').in('username', captionMentions);
          if (mp) {
            for (const p of mp) {
              if (p.id !== task.userId && !allMentionIds.includes(p.id)) allMentionIds.push(p.id);
            }
          }
        }
        if (allMentionIds.length > 0) {
          await supabase
            .from('post_mentions')
            .insert(allMentionIds.map((uid) => ({ post_id: post.id, mentioned_user_id: uid })));
        }
        if (task.collabIds.length > 0) {
          await supabase.from('post_collabs').insert(task.collabIds.map((uid) => ({ post_id: post.id, user_id: uid })));
        }
      }

      tick();
    }

    if (task.shareStory && storyUrl) {
      const mediaType = task.files[0].type.startsWith('video/') ? 'video' : 'image';
      const { error } = await supabase.from('stories').insert({
        user_id: task.userId,
        media_url: storyUrl,
        media_type: mediaType,
        caption: task.caption || null,
        ring_id: task.ringId,
      });
      if (error) throw error;
      tick();
    }

    emit({ taskId: task.id, progress: 100, status: 'success' });
  } catch (err: any) {
    emit({ taskId: task.id, progress: 0, status: 'error', message: err?.message || 'Yuklashda xatolik yuz berdi' });
  }
};
