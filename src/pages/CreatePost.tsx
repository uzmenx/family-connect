import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, X, Plus, Check, AtSign, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { MediaPicker } from '@/components/post/MediaPicker';
import { uploadMedia } from '@/lib/r2Upload';
import { usePostCollections } from '@/hooks/usePostCollections';
import { useMentionsCollabs } from '@/hooks/useMentionsCollabs';
import { UserSearchPicker } from '@/components/post/UserSearchPicker';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

const CreatePost = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { collections, createCollection, addPostToCollection } = usePostCollections();
  
  const [step, setStep] = useState<'media' | 'caption'>('media');
  const [selectedMedia, setSelectedMedia] = useState<MediaFile[]>([]);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<Set<string>>(new Set());
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [collabIds, setCollabIds] = useState<string[]>([]);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [showCollabPicker, setShowCollabPicker] = useState(false);
  const [mentionProfiles, setMentionProfiles] = useState<any[]>([]);
  const [collabProfiles, setCollabProfiles] = useState<any[]>([]);
  const { addMentions, addCollabs } = useMentionsCollabs();

  // Fetch profiles for selected mention/collab users
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

  const handleNext = () => {
    if (selectedMedia.length === 0) {
      toast({ title: "Xatolik", description: "Kamida bitta rasm yoki video tanlang", variant: "destructive" });
      return;
    }
    setStep('caption');
  };

  const handleBack = () => {
    if (step === 'caption') setStep('media');
    else navigate(-1);
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    if (!user) return null;
    try { return await uploadMedia(file, 'posts', user.id); }
    catch (error) { console.error('Upload error:', error); return null; }
  };

  const toggleCollection = (id: string) => {
    setSelectedCollectionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    const c = await createCollection(newCollectionName.trim());
    if (c) {
      setSelectedCollectionIds(prev => new Set(prev).add(c.id));
      setNewCollectionName('');
      setShowNewCollection(false);
    }
  };

  const handlePublish = async () => {
    if (!user) return;
    if (selectedMedia.length === 0) {
      toast({ title: "Xatolik", description: "Kamida bitta rasm yoki video tanlang", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const uploadPromises = selectedMedia.map(media => uploadFile(media.file));
      const uploadedUrls = await Promise.all(uploadPromises);
      const validUrls = uploadedUrls.filter((url): url is string => url !== null);
      
      if (validUrls.length === 0) throw new Error('Media yuklashda xatolik');

      const { data: post, error } = await supabase
        .from('posts')
        .insert({ user_id: user.id, content: content || null, media_urls: validUrls })
        .select()
        .single();

      if (error) throw error;

      // Add to selected collections
      if (post) {
        for (const colId of selectedCollectionIds) {
          await addPostToCollection(colId, post.id);
        }

        // Parse @mentions from caption text
        const captionMentionUsernames = (content.match(/@(\w+)/g) || []).map(m => m.slice(1));
        let allMentionIds = [...mentionIds];
        
        if (captionMentionUsernames.length > 0) {
          const { data: mentionedProfiles } = await supabase
            .from('profiles')
            .select('id, username')
            .in('username', captionMentionUsernames);
          
          if (mentionedProfiles) {
            for (const p of mentionedProfiles) {
              if (p.id !== user.id && !allMentionIds.includes(p.id)) {
                allMentionIds.push(p.id);
              }
            }
          }
        }

        // Add mentions and collabs
        if (allMentionIds.length > 0) {
          await addMentions(post.id, allMentionIds);
        }
        if (collabIds.length > 0) {
          await addCollabs(post.id, collabIds);
        }
      }

      selectedMedia.forEach(media => URL.revokeObjectURL(media.preview));
      toast({ title: "Muvaffaqiyat!", description: "Post joylandi" });
      navigate('/');
    } catch (error: any) {
      console.error('Error creating post:', error);
      toast({ title: "Xatolik", description: error.message || "Post yaratishda xatolik yuz berdi", variant: "destructive" });
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
            {step === 'media' ? 'Yangi post' : 'Nashr qilish'}
          </h1>
          {step === 'media' ? (
            <Button variant="ghost" className="text-primary font-semibold" onClick={handleNext} disabled={selectedMedia.length === 0}>
              Keyingi
            </Button>
          ) : (
            <Button className="font-semibold" onClick={handlePublish} disabled={isLoading}>
              {isLoading ? "Yuklanmoqda..." : "Ulashish"}
            </Button>
          )}
        </header>

        {/* Content */}
        <div className="flex-1 p-4">
          {step === 'media' ? (
            <MediaPicker selectedMedia={selectedMedia} onMediaChange={setSelectedMedia} maxFiles={5} />
          ) : (
            <div className="space-y-4">
              {/* Preview */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {selectedMedia.map((media, index) => (
                  <div key={index} className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-muted">
                    {media.type === 'image' ? (
                      <img src={media.preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                    ) : (
                      <video src={media.preview} className="w-full h-full object-cover" />
                    )}
                  </div>
                ))}
              </div>
              
              {/* Caption */}
              <div className="space-y-2">
                <Textarea placeholder="Izoh yozing... (ixtiyoriy)" value={content} onChange={(e) => setContent(e.target.value)} rows={4} className="resize-none text-base" />
                <p className="text-xs text-muted-foreground text-right">{content.length}/2200</p>
              </div>

              {/* Collection selection */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">Qayerga joylash</p>
                <div className="space-y-2">
                  {collections.map(c => (
                    <button
                      key={c.id}
                      onClick={() => toggleCollection(c.id)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors",
                        selectedCollectionIds.has(c.id) ? "border-primary bg-primary/10" : "border-border"
                      )}
                    >
                      <span className="text-sm font-medium">{c.name}</span>
                      {selectedCollectionIds.has(c.id) && (
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  ))}

                  {showNewCollection ? (
                    <div className="flex gap-2">
                      <input
                        value={newCollectionName}
                        onChange={e => setNewCollectionName(e.target.value)}
                        placeholder="Ro'yxat nomi"
                        className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && handleCreateCollection()}
                      />
                      <Button size="sm" onClick={handleCreateCollection} disabled={!newCollectionName.trim()}>
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowNewCollection(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNewCollection(true)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-border text-muted-foreground text-sm hover:bg-secondary/50"
                    >
                      <Plus className="h-4 w-4" />
                      Yangi ro'yxat yaratish
                    </button>
                  )}
                </div>
              </div>

              {/* Mention - Belgilash */}
              <div className="space-y-2">
                <button
                  onClick={() => setShowMentionPicker(true)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  <AtSign className="h-5 w-5 text-primary" />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">Odamlarni belgilash</p>
                    <p className="text-xs text-muted-foreground">
                      {mentionIds.length > 0 ? `${mentionIds.length} kishi belgilangan` : 'Postda kimnidir belgilang'}
                    </p>
                  </div>
                </button>
                {mentionProfiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {mentionProfiles.map(u => (
                      <div key={u.id} className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 rounded-full">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={u.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px]">U</AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium">{u.name || u.username}</span>
                        <button onClick={() => setMentionIds(prev => prev.filter(id => id !== u.id))}>
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Collab - Hamkorlik */}
              <div className="space-y-2">
                <button
                  onClick={() => setShowCollabPicker(true)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  <Users className="h-5 w-5 text-primary" />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">Hamkor qo'shish</p>
                    <p className="text-xs text-muted-foreground">
                      {collabIds.length > 0 ? `${collabIds.length} hamkor tanlangan` : 'Post birgalikda chiqsin'}
                    </p>
                  </div>
                </button>
                {collabProfiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {collabProfiles.map(u => (
                      <div key={u.id} className="flex items-center gap-1.5 px-2 py-1 bg-accent/20 rounded-full">
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
              </div>
            </div>
          )}
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
    </AppLayout>
  );
};

export default CreatePost;
