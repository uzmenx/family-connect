import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Settings, Instagram } from 'lucide-react';

const Profile = () => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto">
        {/* Cover Image */}
        <div className="relative h-32 bg-gradient-to-r from-primary/30 to-accent/30">
          {user.cover_url && (
            <img src={user.cover_url} alt="Cover" className="w-full h-full object-cover" />
          )}
          <Link to="/settings" className="absolute top-4 right-4">
            <Button variant="secondary" size="icon" className="rounded-full">
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
        </div>

        {/* Profile Info */}
        <div className="relative px-4 pb-4">
          <Avatar className="h-24 w-24 border-4 border-background -mt-12 relative z-10">
            <AvatarImage src={user.avatar_url} />
            <AvatarFallback className="text-2xl bg-primary/10 text-primary">
              {user.full_name.charAt(0)}
            </AvatarFallback>
          </Avatar>

          <div className="mt-3 space-y-2">
            <div>
              <h1 className="text-xl font-bold">{user.full_name}</h1>
              <p className="text-muted-foreground">@{user.username}</p>
            </div>
            
            {user.bio && <p className="text-sm">{user.bio}</p>}
            
            <div className="flex gap-2">
              {user.instagram && (
                <a href={`https://instagram.com/${user.instagram}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Instagram className="h-4 w-4" />
                    Instagram
                  </Button>
                </a>
              )}
              {user.telegram && (
                <a href={`https://t.me/${user.telegram}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm">
                    Telegram
                  </Button>
                </a>
              )}
            </div>
          </div>

          {/* Stats */}
          <Card className="mt-4 p-4">
            <div className="flex justify-around text-center">
              <div>
                <p className="text-2xl font-bold">{user.followers_count}</p>
                <p className="text-xs text-muted-foreground">Followers</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{user.following_count}</p>
                <p className="text-xs text-muted-foreground">Following</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{user.relatives_count}</p>
                <p className="text-xs text-muted-foreground">Qarindoshlar</p>
              </div>
            </div>
          </Card>

          <Link to="/edit-profile" className="block mt-4">
            <Button variant="outline" className="w-full">
              Profilni tahrirlash
            </Button>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
};

export default Profile;
