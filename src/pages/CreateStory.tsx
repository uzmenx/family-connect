import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Image, X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { uploadMedia } from '@/lib/r2Upload';
import { STORY_RINGS, type StoryRingId } from '@/components/stories/storyRings';
import { StoryRingPreview } from '@/components/stories/StoryRingPreview';
import { useStoryHighlights } from '@/hooks/useStoryHighlights';

const CreateStory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { autoSaveStoryToHighlight } = useStoryHighlights();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedRingId, setSelectedRingId] = useState<StoryRingId>('default');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      toast.error('Faqat rasm yoki video yuklash mumkin');
      return;
    }

    // Check file size (max 50MB for video, 10MB for image)
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`Fayl hajmi juda katta. Maksimum: ${isVideo ? '50MB' : '10MB'}`);
      return;
    }

    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!selectedFile || !user) return;

    setIsUploading(true);
    try {
      // Upload file to R2
      const publicUrl = await uploadMedia(selectedFile, 'stories', user.id);

      // Create story record
      const mediaType = selectedFile.type.startsWith('video/') ? 'video' : 'image';
      
      const { data: storyData, error: storyError } = await supabase
        .from('stories')
        .insert({
          user_id: user.id,
          media_url: publicUrl,
          media_type: mediaType,
          caption: caption || null,
          ring_id: selectedRingId,
        })
        .select()
        .single();

      if (storyError) throw storyError;

      // Auto-save to year highlight
      if (storyData) {
        await autoSaveStoryToHighlight(storyData.id, publicUrl, mediaType, caption || null);
      }

      toast.success('Hikoya yaratildi!');
      navigate('/');
    } catch (error) {
      console.error('Error creating story:', error);
      toast.error('Hikoya yaratishda xatolik yuz berdi');
    } finally {
      setIsUploading(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isVideo = selectedFile?.type.startsWith('video/');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 z-40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Yangi hikoya</h1>
        </div>
        
        {selectedFile && (
          <Button 
            onClick={handleSubmit} 
            disabled={isUploading}
            size="sm"
            className="gap-2"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Yuklash
          </Button>
        )}
      </header>

      <div className="max-w-lg mx-auto p-4">
        {!preview ? (
          // File selection
          <div className="flex flex-col items-center justify-center py-12 gap-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Hikoya yarating</h2>
              <p className="text-muted-foreground">Rasm yoki video yuklang</p>
            </div>
            
            <div className="flex gap-4">
              <Button
                variant="outline"
                size="lg"
                className="gap-2 h-20 w-32 flex-col"
                onClick={() => fileInputRef.current?.click()}
              >
                <Image className="h-6 w-6" />
                <span className="text-sm">Galereya</span>
              </Button>
              
              <Button
                variant="outline"
                size="lg"
                className="gap-2 h-20 w-32 flex-col"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-6 w-6" />
                <span className="text-sm">Kamera</span>
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        ) : (
          // Preview
          <div className="space-y-4">
            <div className="relative aspect-[9/16] bg-black rounded-lg overflow-hidden">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-10 bg-black/50 text-white hover:bg-black/70"
                onClick={clearSelection}
              >
                <X className="h-5 w-5" />
              </Button>
              
              {isVideo ? (
                <video
                  src={preview}
                  className="w-full h-full object-contain"
                  controls
                  autoPlay
                  muted
                />
              ) : (
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            <Textarea
              placeholder="Caption qo'shing... (ixtiyoriy)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="resize-none"
              rows={3}
            />

            {/* Ring selector */}
            <div className="space-y-2">
              <p className="text-sm font-semibold">Halqa rangi</p>
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {STORY_RINGS.map((ring) => (
                  <StoryRingPreview
                    key={ring.id}
                    ringId={ring.id}
                    avatarSrc={preview || ''}
                    size="sm"
                    selected={selectedRingId === ring.id}
                    onClick={() => setSelectedRingId(ring.id)}
                    label={ring.label}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateStory;
