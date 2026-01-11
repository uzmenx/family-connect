import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { FamilyTree } from '@/components/family/FamilyTree';
import { AddRelativeDialog } from '@/components/family/AddRelativeDialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Relative } from '@/types';

const Relatives = () => {
  const { user, profile } = useAuth();
  const [relatives, setRelatives] = useState<Relative[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      const allRelatives = JSON.parse(localStorage.getItem('family_app_relatives') || '[]');
      const userRelatives = allRelatives.filter((r: Relative) => r.user_id === user.id);
      setRelatives(userRelatives);
    }
  }, [user]);

  const handleAddRelative = (newRelative: Omit<Relative, 'id' | 'user_id' | 'created_at'>) => {
    if (!user) return;

    const relative: Relative = {
      ...newRelative,
      id: crypto.randomUUID(),
      user_id: user.id,
      created_at: new Date().toISOString(),
    };

    const allRelatives = JSON.parse(localStorage.getItem('family_app_relatives') || '[]');
    allRelatives.push(relative);
    localStorage.setItem('family_app_relatives', JSON.stringify(allRelatives));
    
    setRelatives(prev => [...prev, relative]);
    setDialogOpen(false);
  };

  // Create a user object compatible with FamilyTree component
  const currentUserForTree = profile ? {
    id: user?.id || '',
    email: profile.email || '',
    full_name: profile.name || '',
    username: profile.username || '',
    bio: profile.bio || '',
    avatar_url: profile.avatar_url || '',
    cover_url: '',
    instagram: '',
    telegram: '',
    followers_count: 0,
    following_count: 0,
    relatives_count: relatives.length,
    created_at: profile.created_at
  } : null;

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto">
        <header className="sticky top-0 bg-background/80 backdrop-blur-sm border-b border-border p-4 z-40 flex items-center justify-between">
          <h1 className="text-xl font-bold">Oila daraxti</h1>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Qo'shish
          </Button>
        </header>
        
        <div className="p-4">
          {relatives.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Hozircha qarindoshlar yo'q</p>
              <p className="text-sm text-muted-foreground mt-2">Birinchi qarindoshni qo'shing!</p>
            </div>
          ) : (
            <FamilyTree relatives={relatives} currentUser={currentUserForTree} />
          )}
        </div>

        <AddRelativeDialog 
          open={dialogOpen} 
          onOpenChange={setDialogOpen}
          onAdd={handleAddRelative}
          relatives={relatives}
        />
      </div>
    </AppLayout>
  );
};

export default Relatives;
