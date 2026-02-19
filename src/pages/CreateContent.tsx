import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { uploadMedia } from '@/lib/r2Upload';
import { Check, Image, AtSign, Users, ChevronRight, X } from 'lucide-react';
import MediaCapture, { CapturedMedia } from '@/components/create/MediaCapture';
import MediaEditor from '@/components/create/MediaEditor';
import { STORY_RINGS, type StoryRingId } from '@/components/stories/storyRings';
import { StoryRingPreview } from '@/components/stories/StoryRingPreview';
import { useMentionsCollabs } from '@/hooks/useMentionsCollabs';
import { UserSearchPicker } from '@/components/post/UserSearchPicker';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

type Step = 'capture' | 'edit' | 'publish';

const CreateContent = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>('capture');
  const [capturedMedia, setCapturedMedia] = useState<CapturedMedia[]>([]);
  const [editedFiles, setEditedFiles] = useState<{ file: File; filter: string }[]>([]);
  const [caption, setCaption] = useState('');
  const [sharePost, setSharePost] = useState(true);
  const [shareStory, setShareStory] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedRingId, setSelectedRingId] = useState<StoryRingId>('default');
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [collabIds, setCollabIds] = useState<string[]>([]);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [showCollabPicker, setShowCollabPicker] = useState(false);
  const [mentionProfiles, setMentionProfiles] = useState<any[]>([]);
  const [collabProfiles, setCollabProfiles] = useState<any[]>([]);
  const { addMentions, addCollabs } = useMentionsCollabs();

  useEffect(() => {
    if (mentionIds.length > 0) {
      supabase.from('profiles').select('id, name, username, avatar_url').in('id', mentionIds)
        .then(({ data }) => setMentionProfiles(data || []));
    } else setMentionProfiles([]);
  }, [mentionIds]);

  useEffect(() => {
    if (collabIds.length > 0) {
      supabase.from('profiles').select('id, name, username, avatar_url').in('id', collabIds)
        .then(({ data }) => setCollabProfiles(data || []));
    } else setCollabProfiles([]);
  }, [collabIds]);

  // Step 1 → 2: Capture done
  const handleCaptureNext = useCallback((media: CapturedMedia[]) => {
    setCapturedMedia(media);
    setStep('edit');
  }, []);

  // Step 2 → 3: Edit done
  const handleEditDone = useCallback((items: { file: File; filter: string }[]) => {
    setEditedFiles(items);
    setStep('publish');
  }, []);

  // Back navigation
  const handleBack = useCallback(() => {
    if (step === 'publish') setStep('edit');
    else if (step === 'edit') setStep('capture');
    else navigate(-1);
  }, [step, navigate]);

  // Publish
  const handlePublish = async () => {
    if (!user || editedFiles.length === 0) return;
    if (!sharePost && !shareStory) {
      toast.error("Post yoki Story-dan kamida birini tanlang");
      return;
    }

    setIsUploading(true);
    setUploadProgress(5);

    try {
      const total = editedFiles.length + 1;
      let done = 0;
      const tick = () => { done++; setUploadProgress(Math.min(95, Math.round((done / total) * 90) + 5)); };

      let postUrls: string[] = [];
      if (sharePost) {
        const uploads = await Promise.all(
          editedFiles.map(async (m) => {
            const url = await uploadMedia(m.file, 'posts', user.id);
            tick();
            return url;
          })
        );
        postUrls = uploads.filter(Boolean);
      }

      let storyUrl: string | null = null;
      if (shareStory) {
        storyUrl = await uploadMedia(editedFiles[0].file, 'stories', user.id);
        tick();
      }

      if (sharePost && postUrls.length > 0) {
        const { data: post, error } = await supabase.from('posts').insert({
          user_id: user.id,
          content: caption || null,
          media_urls: postUrls,
        }).select().single();
        if (error) throw error;

        if (post) {
          // Parse @mentions from caption
          const captionMentions = (caption.match(/@(\w+)/g) || []).map(m => m.slice(1));
          let allMentionIds = [...mentionIds];
          if (captionMentions.length > 0) {
            const { data: mp } = await supabase.from('profiles').select('id, username')
              .in('username', captionMentions);
            if (mp) {
              for (const p of mp) {
                if (p.id !== user.id && !allMentionIds.includes(p.id)) allMentionIds.push(p.id);
              }
            }
          }
          if (allMentionIds.length > 0) await addMentions(post.id, allMentionIds);
          if (collabIds.length > 0) await addCollabs(post.id, collabIds);
        }
      }

      if (shareStory && storyUrl) {
        const mediaType = editedFiles[0].file.type.startsWith('video/') ? 'video' : 'image';
        const { error } = await supabase.from('stories').insert({
          user_id: user.id,
          media_url: storyUrl,
          media_type: mediaType,
          caption: caption || null,
          ring_id: selectedRingId,
        });
        if (error) throw error;
      }

      setUploadProgress(100);
      setShowSuccess(true);
      const postLabel = sharePost ? 'Post joylandi!' : '';
      const storyLabel = shareStory ? 'Story ham ulashildi!' : '';
      toast.success([postLabel, storyLabel].filter(Boolean).join(' '));
      setTimeout(() => navigate('/'), 1500);
    } catch (err: any) {
      console.error('Publish error:', err);
      toast.error(err.message || "Yuklashda xatolik yuz berdi");
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  // Success overlay
  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center gap-4 animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center animate-scale-in">
          <Check className="h-10 w-10 text-primary" />
        </div>
        <p className="text-lg font-semibold">
          {sharePost && shareStory ? 'Post & Story joylandi!' : sharePost ? 'Post joylandi!' : 'Story joylandi!'}
        </p>
        <p className="text-sm text-muted-foreground">Bosh sahifaga qaytilmoqda…</p>
      </div>
    );
  }

  // Step 1: Camera capture
  if (step === 'capture') {
    return <MediaCapture onNext={handleCaptureNext} onClose={() => navigate(-1)} />;
  }

  // Step 2: Media editor (filters, text, emoji)
  if (step === 'edit') {
    return (
      <MediaEditor
        mediaItems={capturedMedia}
        onDone={handleEditDone}
        onBack={() => setStep('capture')}
      />
    );
  }

  // Step 3: Publish form
  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      {isUploading && (
        <div className="absolute top-0 left-0 right-0 z-50">
          <Progress value={uploadProgress} className="h-1 rounded-none" />
          <div className="text-center text-xs text-muted-foreground py-0.5 bg-background/80 backdrop-blur-sm">
            {uploadProgress}%
          </div>
        </div>
      )}

      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm">
        <Button variant="ghost" size="sm" onClick={handleBack}>Orqaga</Button>
        <h1 className="text-lg font-semibold">Nashr qilish</h1>
        <Button size="sm" onClick={handlePublish} disabled={isUploading || editedFiles.length === 0}>
          {isUploading ? `${uploadProgress}%` : 'Ulashish'}
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto p-4 space-y-5">
          {/* Media preview grid */}
          <div className="grid grid-cols-3 gap-2">
            {editedFiles.map((m, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                {m.file.type.startsWith('video/') ? (
                  <video src={URL.createObjectURL(m.file)} className="w-full h-full object-cover" />
                ) : (
                  <img src={URL.createObjectURL(m.file)} alt="" className="w-full h-full object-cover" />
                )}
              </div>
            ))}
          </div>

          {/* Caption */}
          <Textarea
            placeholder="Izoh yozing... (ixtiyoriy)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={4}
            className="resize-none text-base rounded-xl"
          />
          <p className="text-xs text-muted-foreground text-right -mt-3">{caption.length}/2200</p>

          {/* Tag people & Collab - Instagram style rows */}
          <div className="space-y-0 rounded-2xl border border-border overflow-hidden">
            <button
              onClick={() => setShowMentionPicker(true)}
              className="w-full flex items-center gap-3 px-4 py-3.5 bg-background hover:bg-muted/50 transition-colors border-b border-border"
            >
              <AtSign className="h-5 w-5 text-muted-foreground" />
              <span className="flex-1 text-left text-sm font-medium">Odamlarni belgilash</span>
              {mentionIds.length > 0 && (
                <span className="text-xs text-primary font-medium">{mentionIds.length} kishi</span>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => setShowCollabPicker(true)}
              className="w-full flex items-center gap-3 px-4 py-3.5 bg-background hover:bg-muted/50 transition-colors"
            >
              <Users className="h-5 w-5 text-muted-foreground" />
              <span className="flex-1 text-left text-sm font-medium">Hamkorlik taklifi</span>
              {collabIds.length > 0 && (
                <span className="text-xs text-primary font-medium">{collabIds.length} hamkor</span>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Selected mention/collab chips */}
          {(mentionProfiles.length > 0 || collabProfiles.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {mentionProfiles.map(u => (
                <div key={u.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 rounded-full">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={u.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px]">U</AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium">@{u.username || u.name}</span>
                  <button onClick={() => setMentionIds(prev => prev.filter(id => id !== u.id))}>
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
              {collabProfiles.map(u => (
                <div key={u.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-accent/20 rounded-full">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={u.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px]">U</AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium">{u.name || u.username}</span>
                  <button onClick={() => setCollabIds(prev => prev.filter(id => id !== u.id))}>
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-3">
            <p className="text-sm font-semibold">Qayerga joylash</p>

            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-background border border-border hover:border-primary/40 transition-colors">
              <Checkbox checked={sharePost} onCheckedChange={(v) => setSharePost(!!v)} className="h-5 w-5" />
              <div className="flex-1">
                <p className="font-medium text-sm">📸 Post (Feed)</p>
                <p className="text-xs text-muted-foreground">Barcha media lenta'ga joylanadi</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-background border border-border hover:border-primary/40 transition-colors">
              <Checkbox checked={shareStory} onCheckedChange={(v) => setShareStory(!!v)} className="h-5 w-5" />
              <div className="flex-1">
                <p className="font-medium text-sm">⏳ Story</p>
                <p className="text-xs text-muted-foreground">Birinchi media story'ga joylanadi</p>
              </div>
            </label>
          </div>

          {/* Story ring selector - only show when story is checked */}
          {shareStory && (
            <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-semibold">Halqa rangi</p>
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {STORY_RINGS.map((ring) => (
                  <StoryRingPreview
                    key={ring.id}
                    ringId={ring.id}
                    avatarSrc={editedFiles[0] ? URL.createObjectURL(editedFiles[0].file) : ''}
                    size="sm"
                    selected={selectedRingId === ring.id}
                    onClick={() => setSelectedRingId(ring.id)}
                    label={ring.label}
                  />
                ))}
              </div>
            </div>
          )}
          <Button
            className="w-full h-12 text-base font-semibold rounded-2xl"
            onClick={handlePublish}
            disabled={isUploading || editedFiles.length === 0 || (!sharePost && !shareStory)}
          >
            {isUploading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full" />
                Yuklanmoqda {uploadProgress}%
              </span>
            ) : (
              sharePost && shareStory ? 'Post & Story ulashish' :
                sharePost ? 'Post ulashish' : 'Story ulashish'
            )}
          </Button>
          <div className="h-8" />
        </div>
      </div>

      {/* Pickers */}
      <UserSearchPicker
        open={showMentionPicker}
        onClose={() => setShowMentionPicker(false)}
        selectedIds={mentionIds}
        onSelectionChange={setMentionIds}
        title="Odamlarni belgilash"
      />
      <UserSearchPicker
        open={showCollabPicker}
        onClose={() => setShowCollabPicker(false)}
        selectedIds={collabIds}
        onSelectionChange={setCollabIds}
        title="Hamkor qo'shish"
        maxSelection={5}
      />
    </div>
  );
};

export default CreateContent;
