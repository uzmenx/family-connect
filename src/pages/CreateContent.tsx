import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { uploadMedia } from '@/lib/r2Upload';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Camera, Image, X, Check, Play, Scissors, Pencil,
} from 'lucide-react';
import VideoTrimmer from '@/components/create/VideoTrimmer';
import ImageEditor from '@/components/create/ImageEditor';

/* ── types ── */
interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
  edited?: boolean;
}

type Step = 'pick' | 'edit-media' | 'edit';

/* ── component ── */
const CreateContent = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  /* state */
  const [step, setStep] = useState<Step>('pick');
  const [selectedMedia, setSelectedMedia] = useState<MediaFile[]>([]);
  const [caption, setCaption] = useState('');
  const [sharePost, setSharePost] = useState(true);
  const [shareStory, setShareStory] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  /* edit state */
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  /* ── handlers ── */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = 5 - selectedMedia.length;
    const newMedia: MediaFile[] = [];

    Array.from(files).slice(0, remaining).forEach((file) => {
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      if (isVideo || isImage) {
        newMedia.push({ file, preview: URL.createObjectURL(file), type: isVideo ? 'video' : 'image' });
      }
    });

    if (newMedia.length > 0) {
      setSelectedMedia((prev) => [...prev, ...newMedia]);
      setStep('edit');
    }
    e.target.value = '';
  };

  const removeMedia = (idx: number) => {
    setSelectedMedia((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[idx].preview);
      copy.splice(idx, 1);
      return copy;
    });
  };

  const handleBack = () => {
    if (step === 'edit-media') {
      setEditingIndex(null);
      setStep('edit');
    } else if (step === 'edit' && selectedMedia.length > 0) {
      setStep('pick');
    } else {
      navigate(-1);
    }
  };

  /* ── open editor for a specific media ── */
  const openEditor = (idx: number) => {
    setEditingIndex(idx);
    setStep('edit-media');
  };

  const handleVideoTrimmed = (blob: Blob) => {
    if (editingIndex === null) return;
    setSelectedMedia((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[editingIndex].preview);
      const newFile = new File([blob], `trimmed-${Date.now()}.mp4`, { type: 'video/mp4' });
      copy[editingIndex] = {
        file: newFile,
        preview: URL.createObjectURL(blob),
        type: 'video',
        edited: true,
      };
      return copy;
    });
    setEditingIndex(null);
    setStep('edit');
  };

  const handleImageSaved = (blob: Blob) => {
    if (editingIndex === null) return;
    setSelectedMedia((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[editingIndex].preview);
      const newFile = new File([blob], `edited-${Date.now()}.webp`, { type: 'image/webp' });
      copy[editingIndex] = {
        file: newFile,
        preview: URL.createObjectURL(blob),
        type: 'image',
        edited: true,
      };
      return copy;
    });
    setEditingIndex(null);
    setStep('edit');
  };

  /* ── publish ── */
  const handlePublish = async () => {
    if (!user || selectedMedia.length === 0) return;
    if (!sharePost && !shareStory) {
      toast.error("Post yoki Story-dan kamida birini tanlang");
      return;
    }

    setIsUploading(true);
    setUploadProgress(5);

    try {
      const totalSteps = selectedMedia.length * (sharePost ? 1 : 0) + (shareStory ? 1 : 0) + 1;
      let completed = 0;
      const tick = () => { completed++; setUploadProgress(Math.min(95, Math.round((completed / totalSteps) * 90) + 5)); };

      let postUrls: string[] = [];
      if (sharePost) {
        const uploads = await Promise.all(
          selectedMedia.map(async (m) => {
            const url = await uploadMedia(m.file, 'posts', user.id);
            tick();
            return url;
          })
        );
        postUrls = uploads.filter(Boolean);
      }

      let storyUrl: string | null = null;
      if (shareStory) {
        storyUrl = await uploadMedia(selectedMedia[0].file, 'stories', user.id);
        tick();
      }

      if (sharePost && postUrls.length > 0) {
        const { error } = await supabase.from('posts').insert({
          user_id: user.id,
          content: caption || null,
          media_urls: postUrls,
        });
        if (error) throw error;
      }

      if (shareStory && storyUrl) {
        const mediaType = selectedMedia[0].type === 'video' ? 'video' : 'image';
        const { error } = await supabase.from('stories').insert({
          user_id: user.id,
          media_url: storyUrl,
          media_type: mediaType,
          caption: caption || null,
        });
        if (error) throw error;
      }

      setUploadProgress(100);
      tick();

      selectedMedia.forEach((m) => URL.revokeObjectURL(m.preview));

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

  /* ── success overlay ── */
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

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      {/* upload progress bar */}
      {isUploading && (
        <div className="absolute top-0 left-0 right-0 z-50">
          <Progress value={uploadProgress} className="h-1 rounded-none" />
          <div className="text-center text-xs text-muted-foreground py-0.5 bg-background/80 backdrop-blur-sm">
            {uploadProgress}%
          </div>
        </div>
      )}

      {/* header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          {step === 'pick' ? <X className="h-6 w-6" /> : <ArrowLeft className="h-6 w-6" />}
        </Button>
        <h1 className="text-lg font-semibold">
          {step === 'pick' ? 'Yaratish' : step === 'edit-media' ? 'Tahrirlash' : 'Nashr qilish'}
        </h1>
        {step === 'edit' ? (
          <Button size="sm" onClick={handlePublish} disabled={isUploading || selectedMedia.length === 0}>
            {isUploading ? `${uploadProgress}%` : 'Ulashish'}
          </Button>
        ) : (
          <div className="w-10" />
        )}
      </header>

      {/* hidden inputs */}
      <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileSelect} />
      <input ref={cameraInputRef} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={handleFileSelect} />

      {/* ── STEP: PICK ── */}
      {step === 'pick' && (
        <div className="flex-1 flex flex-col">
          {selectedMedia.length > 0 && (
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs text-muted-foreground mb-2">Tanlangan ({selectedMedia.length}/5)</p>
              <div className="flex gap-2 overflow-x-auto">
                {selectedMedia.map((m, i) => (
                  <div key={i} className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-muted">
                    {m.type === 'image' ? (
                      <img src={m.preview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <video src={m.preview} className="w-full h-full object-cover" />
                    )}
                    <button onClick={() => removeMedia(i)} className="absolute top-0.5 right-0.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-1">Nima ulashmoqchisiz?</h2>
              <p className="text-sm text-muted-foreground">Rasm yoki video tanlang</p>
            </div>

            <div className="flex gap-4">
              <Button
                variant="outline"
                className="h-24 w-32 flex-col gap-2 rounded-2xl border-2"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="h-7 w-7 text-primary" />
                <span className="text-sm font-medium">Kamera</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 w-32 flex-col gap-2 rounded-2xl border-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Image className="h-7 w-7 text-primary" />
                <span className="text-sm font-medium">Galereya</span>
              </Button>
            </div>
          </div>

          {selectedMedia.length > 0 && (
            <div className="px-4 pb-6 pt-2">
              <Button className="w-full h-12 text-base rounded-2xl" onClick={() => setStep('edit')}>
                Davom etish ({selectedMedia.length} ta)
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── STEP: EDIT MEDIA (video trim / image filter) ── */}
      {step === 'edit-media' && editingIndex !== null && selectedMedia[editingIndex] && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-lg mx-auto p-4">
            {selectedMedia[editingIndex].type === 'video' ? (
              <VideoTrimmer
                src={selectedMedia[editingIndex].preview}
                file={selectedMedia[editingIndex].file}
                maxDuration={shareStory ? 15 : 60}
                onTrimmed={handleVideoTrimmed}
                onCancel={() => { setEditingIndex(null); setStep('edit'); }}
              />
            ) : (
              <ImageEditor
                src={selectedMedia[editingIndex].preview}
                onSave={handleImageSaved}
                onCancel={() => { setEditingIndex(null); setStep('edit'); }}
              />
            )}
          </div>
        </div>
      )}

      {/* ── STEP: EDIT (publish form) ── */}
      {step === 'edit' && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-lg mx-auto p-4 space-y-5">
            {/* media preview grid */}
            <div className="grid grid-cols-3 gap-2">
              {selectedMedia.map((m, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-muted group">
                  {m.type === 'image' ? (
                    <img src={m.preview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="relative w-full h-full">
                      <video src={m.preview} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Play className="h-8 w-8 text-primary-foreground drop-shadow-lg" fill="currentColor" />
                      </div>
                    </div>
                  )}
                  {/* edit button */}
                  <button
                    onClick={() => openEditor(i)}
                    className="absolute bottom-1 left-1 w-7 h-7 bg-background/80 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Pencil className="h-3.5 w-3.5 text-foreground" />
                  </button>
                  {m.edited && (
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-primary/80 rounded text-[9px] text-primary-foreground font-medium">
                      Edited
                    </div>
                  )}
                  <button onClick={() => removeMedia(i)} className="absolute top-1 right-1 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {selectedMedia.length < 5 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-border flex items-center justify-center hover:bg-muted/50 transition-colors"
                >
                  <Image className="h-6 w-6 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* edit buttons row - always visible */}
            <div className="flex gap-2 overflow-x-auto">
              {selectedMedia.map((m, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0 gap-1.5 rounded-xl"
                  onClick={() => openEditor(i)}
                >
                  {m.type === 'video' ? <Scissors className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                  {m.type === 'video' ? `Video ${i + 1} kesish` : `Rasm ${i + 1} tahrirlash`}
                </Button>
              ))}
            </div>

            {/* caption */}
            <Textarea
              placeholder="Izoh yozing... (ixtiyoriy)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              className="resize-none text-base rounded-xl"
            />
            <p className="text-xs text-muted-foreground text-right -mt-3">{caption.length}/2200</p>

            {/* share toggles */}
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
                  <p className="text-xs text-muted-foreground">
                    Birinchi {selectedMedia[0]?.type === 'video' ? 'video (15s avto kesish)' : 'rasm'} story'ga joylanadi
                  </p>
                </div>
              </label>
            </div>

            {/* story preview */}
            {sharePost && shareStory && selectedMedia.length > 0 && (
              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground mb-2">Story uchun preview</p>
                <div className="flex gap-3">
                  <div className="w-20 rounded-xl overflow-hidden bg-muted aspect-[9/16]">
                    {selectedMedia[0].type === 'image' ? (
                      <img src={selectedMedia[0].preview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <video src={selectedMedia[0].preview} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                    <p className="text-sm font-medium">Story versiyasi</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedMedia[0].type === 'video'
                        ? 'Video avtomatik 15 soniyaga kesiladi'
                        : 'Rasm 9:16 formatda ko\'rsatiladi'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* share button */}
            <Button
              className="w-full h-12 text-base font-semibold rounded-2xl"
              onClick={handlePublish}
              disabled={isUploading || selectedMedia.length === 0 || (!sharePost && !shareStory)}
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
      )}
    </div>
  );
};

export default CreateContent;
