import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { FamilyTree } from '@/components/family/FamilyTree';
import { AddRelativeDialog } from '@/components/family/AddRelativeDialog';
import { GenderSelectDialog } from '@/components/family/GenderSelectDialog';
import { Relative } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const Relatives = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [relatives, setRelatives] = useState<Relative[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [genderDialogOpen, setGenderDialogOpen] = useState(false);
  const [userGender, setUserGender] = useState<'male' | 'female' | null>(null);

  useEffect(() => {
    if (user) {
      const allRelatives = JSON.parse(localStorage.getItem('family_app_relatives') || '[]');
      const userRelatives = allRelatives.filter((r: Relative) => r.user_id === user.id);
      setRelatives(userRelatives);
    }
  }, [user]);

  // Check user's gender from profile
  useEffect(() => {
    const fetchGender = async () => {
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('gender')
          .eq('id', user.id)
          .single();
        
        if (data?.gender) {
          setUserGender(data.gender as 'male' | 'female');
        } else {
          // Show gender selection dialog if not set
          setGenderDialogOpen(true);
        }
      }
    };
    
    fetchGender();
  }, [user]);

  const handleGenderSelect = async (gender: 'male' | 'female') => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ gender })
        .eq('id', user.id);

      if (error) throw error;

      setUserGender(gender);
      setGenderDialogOpen(false);
      await refreshProfile();
      
      toast({
        title: "Saqlandi!",
        description: "Jinsingiz muvaffaqiyatli saqlandi",
      });
    } catch (error: any) {
      toast({
        title: "Xato",
        description: error.message,
        variant: "destructive",
      });
    }
  };

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

    toast({
      title: "Qo'shildi!",
      description: `${relative.relative_name} oila daraxtiga qo'shildi`,
    });
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
      <div className="max-w-lg mx-auto relative min-h-screen bg-gradient-to-b from-emerald-400 via-teal-400 to-green-300 dark:from-emerald-800 dark:via-teal-800 dark:to-green-700">
        <header className="sticky top-0 bg-background/80 backdrop-blur-sm border-b border-border p-4 z-40">
          <h1 className="text-xl font-bold text-center">Oila daraxti</h1>
        </header>
        
        <div className="p-4">
          {relatives.length === 0 && userGender ? (
            <FamilyTree 
              relatives={relatives} 
              currentUser={currentUserForTree}
              userGender={userGender}
              onAddRelative={() => setDialogOpen(true)}
            />
          ) : relatives.length > 0 ? (
            <FamilyTree 
              relatives={relatives} 
              currentUser={currentUserForTree}
              userGender={userGender}
              onAddRelative={() => setDialogOpen(true)}
            />
          ) : null}
        </div>

        <GenderSelectDialog
          open={genderDialogOpen}
          onOpenChange={setGenderDialogOpen}
          onSelect={handleGenderSelect}
        />

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
