import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { FamilyTree } from '@/components/family/FamilyTree';
import { AddRelativeDialog } from '@/components/family/AddRelativeDialog';
import { GenderSelectDialog } from '@/components/family/GenderSelectDialog';
import { InvitationCard } from '@/components/family/InvitationCard';
import { useFamilyTree } from '@/hooks/useFamilyTree';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const Relatives = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [genderDialogOpen, setGenderDialogOpen] = useState(false);
  const [userGender, setUserGender] = useState<'male' | 'female' | null>(null);

  const {
    members,
    invitations,
    isLoading,
    addMember,
    addSpouseToMember,
    addChildToMember,
    addFatherToMember,
    addMotherToMember,
    countSpousesForMember,
    countChildrenForMember,
    countFathersForMember,
    countMothersForMember,
    isFatherSpouseAsMother,
    isMotherSpouseAsFather,
    sendInvitation,
    respondToInvitation,
    linkExistingMemberToUser,
    deleteMember,
  } = useFamilyTree();

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

  const handleAddRelative = async (newRelative: {
    relative_name: string;
    relation_type: string;
    avatar_url?: string;
    gender?: 'male' | 'female';
  }) => {
    await addMember({
      member_name: newRelative.relative_name,
      relation_type: newRelative.relation_type,
      avatar_url: newRelative.avatar_url,
      gender: newRelative.gender,
    });
    setDialogOpen(false);
  };

  const handleSendInvitation = async (memberId: string, receiverId: string) => {
    const member = members.find(m => m.id === memberId);
    if (member) {
      await sendInvitation(receiverId, memberId, member.relation_type);
    }
  };

  const handleAddSpouse = async (memberId: string, spouseData: { name: string; gender: 'male' | 'female'; avatarUrl?: string }, isSecond: boolean) => {
    await addSpouseToMember(memberId, spouseData, isSecond);
  };

  const handleAddChild = async (memberId: string, childData: { name: string; gender: 'male' | 'female'; avatarUrl?: string }) => {
    await addChildToMember(memberId, childData);
  };

  const handleAddFather = async (memberId: string, data: { name: string; avatarUrl?: string }) => {
    await addFatherToMember(memberId, data);
  };

  const handleAddMother = async (memberId: string, data: { name: string; avatarUrl?: string }) => {
    await addMotherToMember(memberId, data);
  };

  // Filter invitations for current user (received ones)
  const receivedInvitations = invitations.filter(inv => inv.receiver_id === user?.id);

  // Create a user object compatible with FamilyTree component
  const currentUserForTree = profile ? {
    id: user?.id || '',
    full_name: profile.name || '',
    avatar_url: profile.avatar_url || '',
  } : null;

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto relative min-h-screen bg-gradient-to-b from-emerald-400 via-teal-400 to-green-300 dark:from-emerald-800 dark:via-teal-800 dark:to-green-700">
        <header className="sticky top-0 bg-background/80 backdrop-blur-sm border-b border-border p-4 z-40">
          <h1 className="text-xl font-bold text-center">Oila daraxti</h1>
        </header>

        {/* Pending invitations */}
        {receivedInvitations.length > 0 && (
          <div className="p-4 space-y-3">
            <h2 className="font-semibold text-foreground">Taklifnomalar</h2>
            {receivedInvitations.map((inv) => (
              <InvitationCard
                key={inv.id}
                invitation={inv}
                onAccept={() => respondToInvitation(inv.id, true)}
                onReject={() => respondToInvitation(inv.id, false)}
              />
            ))}
          </div>
        )}
        
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[50vh]">
              <p className="text-muted-foreground">Yuklanmoqda...</p>
            </div>
          ) : (
            <FamilyTree 
              members={members} 
              currentUser={currentUserForTree}
              userGender={userGender}
              onAddRelative={() => setDialogOpen(true)}
              isOwner={true}
              onSendInvitation={handleSendInvitation}
              onDeleteMember={deleteMember}
              onAddSpouse={handleAddSpouse}
              onAddChild={handleAddChild}
              onAddFather={handleAddFather}
              onAddMother={handleAddMother}
              countSpousesForMember={countSpousesForMember}
              countChildrenForMember={countChildrenForMember}
              countFathersForMember={countFathersForMember}
              countMothersForMember={countMothersForMember}
              isFatherSpouseAsMother={isFatherSpouseAsMother}
              isMotherSpouseAsFather={isMotherSpouseAsFather}
            />
          )}
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
          relatives={members.map(m => ({
            id: m.id,
            user_id: m.owner_id,
            relative_name: m.member_name,
            relation_type: m.relation_type as any,
            parent_relative_id: null,
            avatar_url: m.avatar_url || '',
            gender: m.gender || undefined,
            created_at: m.created_at,
          }))}
        />
      </div>
    </AppLayout>
  );
};

export default Relatives;
