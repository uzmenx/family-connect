import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { MediaPicker } from '@/components/post/MediaPicker';

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

const CreatePost = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [step, setStep] = useState<'media' | 'caption'>('media');
  const [selectedMedia, setSelectedMedia] = useState<MediaFile[]>([]);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleNext = () => {
    if (selectedMedia.length === 0) {
      toast({ 
        title: "Xatolik", 
        description: "Kamida bitta rasm yoki video tanlang",
        variant: "destructive"
      });
      return;
    }
    setStep('caption');
  };

  const handleBack = () => {
    if (step === 'caption') {
      setStep('media');
    } else {
      navigate(-1);
    }
  };

  const uploadMedia = async (file: File): Promise<string | null> => {
    if (!user) return null;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    
    const { error, data } = await supabase.storage
      .from('post-media')
      .upload(fileName, file);

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('post-media')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handlePublish = async () => {
    if (!user) return;
    if (selectedMedia.length === 0) {
      toast({ 
        title: "Xatolik", 
        description: "Kamida bitta rasm yoki video tanlang",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Upload all media files
      const uploadPromises = selectedMedia.map(media => uploadMedia(media.file));
      const uploadedUrls = await Promise.all(uploadPromises);
      
      const validUrls = uploadedUrls.filter((url): url is string => url !== null);
      
      if (validUrls.length === 0) {
        throw new Error('Media yuklashda xatolik');
      }

      // Create post in database
      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: content || null,
          media_urls: validUrls,
        });

      if (error) throw error;

      // Clean up preview URLs
      selectedMedia.forEach(media => URL.revokeObjectURL(media.preview));

      toast({ title: "Muvaffaqiyat!", description: "Post joylandi" });
      navigate('/');
    } catch (error: any) {
      console.error('Error creating post:', error);
      toast({ 
        title: "Xatolik", 
        description: error.message || "Post yaratishda xatolik yuz berdi",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout showNav={false}>
      <div className="max-w-lg mx-auto min-h-screen flex flex-col">
        {/* Header */}
        <header className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border z-40 flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            {step === 'media' ? <X className="h-6 w-6" /> : <ArrowLeft className="h-6 w-6" />}
          </Button>
          
          <h1 className="text-lg font-semibold">
            {step === 'media' ? 'Yangi post' : 'Izoh qo\'shing'}
          </h1>
          
          {step === 'media' ? (
            <Button 
              variant="ghost" 
              className="text-primary font-semibold"
              onClick={handleNext}
              disabled={selectedMedia.length === 0}
            >
              Keyingi
            </Button>
          ) : (
            <Button 
              className="font-semibold"
              onClick={handlePublish}
              disabled={isLoading}
            >
              {isLoading ? "Yuklanmoqda..." : "Joylash"}
            </Button>
          )}
        </header>

        {/* Content */}
        <div className="flex-1 p-4">
          {step === 'media' ? (
            <MediaPicker
              selectedMedia={selectedMedia}
              onMediaChange={setSelectedMedia}
              maxFiles={5}
            />
          ) : (
            <div className="space-y-4">
              {/* Preview of selected media */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {selectedMedia.map((media, index) => (
                  <div key={index} className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-muted">
                    {media.type === 'image' ? (
                      <img 
                        src={media.preview} 
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video 
                        src={media.preview}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                ))}
              </div>
              
              {/* Caption input */}
              <div className="space-y-2">
                <Textarea
                  placeholder="Izoh yozing... (ixtiyoriy)"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  className="resize-none text-base"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {content.length}/2200
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default CreatePost;
