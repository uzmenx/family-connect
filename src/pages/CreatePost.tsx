import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Image } from 'lucide-react';
import { Post } from '@/types';

const CreatePost = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsLoading(true);

    const newPost: Post = {
      id: crypto.randomUUID(),
      user_id: user.id,
      content,
      image_url: imageUrl,
      likes_count: 0,
      comments_count: 0,
      created_at: new Date().toISOString(),
    };

    const posts = JSON.parse(localStorage.getItem('family_app_posts') || '[]');
    posts.push(newPost);
    localStorage.setItem('family_app_posts', JSON.stringify(posts));

    toast({ title: "Muvaffaqiyat!", description: "Post yaratildi" });
    navigate('/');
    setIsLoading(false);
  };

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto">
        <header className="sticky top-0 bg-background/80 backdrop-blur-sm border-b border-border p-4 z-40 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Yangi post</h1>
        </header>
        
        <div className="p-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Post yaratish</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="content">Matn</Label>
                  <Textarea
                    id="content"
                    placeholder="Nimalar haqida yozmoqchisiz?"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={4}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="imageUrl" className="flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    Rasm URL (ixtiyoriy)
                  </Label>
                  <Input
                    id="imageUrl"
                    placeholder="https://example.com/image.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                </div>

                {imageUrl && (
                  <div className="rounded-lg overflow-hidden border border-border">
                    <img 
                      src={imageUrl} 
                      alt="Preview" 
                      className="w-full aspect-video object-cover"
                      onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                    />
                  </div>
                )}
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading || (!content && !imageUrl)}
                >
                  {isLoading ? "Yuklanmoqda..." : "Post qilish"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default CreatePost;
