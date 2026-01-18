import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Camera, Loader2, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const EditProfile = () => {
  const { profile, user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    bio: '',
    avatar_url: '',
    gender: '' as 'male' | 'female' | ''
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (data) {
          setFormData({
            name: data.name || '',
            username: data.username || '',
            bio: data.bio || '',
            avatar_url: data.avatar_url || '',
            gender: (data.gender as 'male' | 'female') || ''
          });
        }
      }
    };
    
    fetchProfile();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: formData.name,
          username: formData.username,
          bio: formData.bio,
          avatar_url: formData.avatar_url,
          gender: formData.gender || null
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      
      toast({ title: "Saqlandi!", description: "Profil yangilandi" });
      navigate('/profile');
    } catch (error: any) {
      toast({ 
        title: "Xato", 
        description: error.message || "Profilni yangilashda xato", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getGenderRingColor = () => {
    if (formData.gender === 'male') return 'ring-sky-400';
    if (formData.gender === 'female') return 'ring-pink-400';
    return 'ring-muted';
  };

  const getGenderBgColor = () => {
    if (formData.gender === 'male') return 'bg-sky-500';
    if (formData.gender === 'female') return 'bg-pink-500';
    return 'bg-primary';
  };

  return (
    <AppLayout showNav={false}>
      <div className="min-h-screen bg-background p-4">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Profilni tahrirlash</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Profil ma'lumotlari</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-4">
                <div className={`relative rounded-full p-1 ring-4 ${getGenderRingColor()}`}>
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={formData.avatar_url || undefined} />
                    <AvatarFallback className={`text-2xl ${getGenderBgColor()} text-white`}>
                      {getInitials(formData.name) || <User className="h-8 w-8" />}
                    </AvatarFallback>
                  </Avatar>
                  <Button 
                    type="button"
                    variant="secondary" 
                    size="icon"
                    className="absolute bottom-0 right-0 h-8 w-8 rounded-full"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Gender Selection */}
              <div className="space-y-3">
                <Label>Jins</Label>
                <RadioGroup 
                  value={formData.gender} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value as 'male' | 'female' }))}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="male" id="male" className="border-sky-500 text-sky-500" />
                    <Label htmlFor="male" className="cursor-pointer flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-sky-500"></div>
                      Erkak
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="female" id="female" className="border-pink-500 text-pink-500" />
                    <Label htmlFor="female" className="cursor-pointer flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-pink-500"></div>
                      Ayol
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Avatar URL */}
              <div className="space-y-2">
                <Label htmlFor="avatar_url">Rasm URL</Label>
                <Input
                  id="avatar_url"
                  placeholder="https://example.com/avatar.jpg"
                  value={formData.avatar_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, avatar_url: e.target.value }))}
                />
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">To'liq ism</Label>
                <Input
                  id="name"
                  placeholder="Ismingiz"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username">Foydalanuvchi nomi</Label>
                <Input
                  id="username"
                  placeholder="username"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                />
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="O'zingiz haqingizda qisqacha..."
                  value={formData.bio}
                  onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  rows={3}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saqlanmoqda...
                  </>
                ) : (
                  "Saqlash"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default EditProfile;
