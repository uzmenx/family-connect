import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Settings, Edit } from 'lucide-react';

const Profile = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        {/* Cover Image */}
        <div className="h-32 bg-gradient-to-r from-primary to-accent" />
        
        {/* Profile Info */}
        <div className="px-4 pb-20">
          <div className="relative -mt-16 mb-4">
            <Avatar className="h-24 w-24 border-4 border-background">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                {getInitials(profile?.name)}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">{profile?.name || 'Foydalanuvchi'}</h1>
              <p className="text-muted-foreground">
                @{profile?.username || user?.email?.split('@')[0] || 'username'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => navigate('/settings')}
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => navigate('/edit-profile')}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {profile?.bio && (
            <p className="text-sm mb-4">{profile.bio}</p>
          )}

          {/* Stats */}
          <Card className="mb-6">
            <CardContent className="py-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-sm text-muted-foreground">Postlar</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-sm text-muted-foreground">Qarindoshlar</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-sm text-muted-foreground">Kuzatuvchilar</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Info */}
          <Card>
            <CardContent className="py-4">
              <h3 className="font-semibold mb-3">Akkount ma'lumotlari</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span>{user?.email || profile?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ro'yxatdan o'tgan</span>
                  <span>
                    {profile?.created_at 
                      ? new Date(profile.created_at).toLocaleDateString('uz-UZ')
                      : '-'
                    }
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Profile;
