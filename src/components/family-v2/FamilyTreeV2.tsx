import { useEffect, useState, useCallback } from 'react';
import { TreeDeciduous } from 'lucide-react';
import { FamilyTreeCanvas } from './FamilyTreeCanvas';
import { AddMemberModal } from './AddMemberModal';
import { ProfileModal } from './ProfileModal';
import { SendInvitationModal } from './SendInvitationModal';
import { GenderSelectionModal } from './GenderSelectionModal';
import { TreeMergeDialog } from './TreeMergeDialog';
import { useLocalFamilyTree } from '@/hooks/useLocalFamilyTree';
import { useFamilyInvitations } from '@/hooks/useFamilyInvitations';
import { FamilyMember, AddMemberData } from '@/types/family';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { FamilyInvitationItem } from './FamilyInvitationItem';

type ModalState = {
  type: 'none' | 'addParentFather' | 'addParentMother' | 'addSpouse' | 'addChild' | 'profile' | 'invitation' | 'genderSelect';
  targetId?: string;
  member?: FamilyMember;
  fatherData?: AddMemberData;
};

export const FamilyTreeV2 = () => {
  const { user, profile, refreshProfile } = useAuth();
  const {
    members,
    rootId,
    isLoading,
    addInitialCouple,
    addParents,
    addSpouse,
    addChild,
    updateMember,
    updatePosition,
    removeMember,
    createSelfNode,
  } = useLocalFamilyTree();

  const { 
    pendingInvitations, 
    acceptInvitation, 
    rejectInvitation,
    showMergeDialog,
    mergeData,
    confirmAutoMerge,
    handleMergeChildren,
    closeMergeDialog,
  } = useFamilyInvitations();
  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const [showGenderSelect, setShowGenderSelect] = useState(false);
  const [processingInvitation, setProcessingInvitation] = useState<string | null>(null);

  // Build positions map from members
  const positions = Object.fromEntries(
    Object.values(members)
      .filter((m) => m.position)
      .map((m) => [m.id, m.position!])
  );

  // Check if user needs to select gender on first visit
  useEffect(() => {
    if (!isLoading && user?.id && profile) {
      // Check if gender is not set
      if (!profile.gender) {
        setShowGenderSelect(true);
      } else if (Object.keys(members).length === 0) {
        // Gender is set but no tree exists - create self node
        createSelfNode(profile.gender as 'male' | 'female');
      }
    }
  }, [isLoading, user?.id, profile?.gender, Object.keys(members).length]);

  const handleGenderSelect = async (gender: 'male' | 'female') => {
    if (!user?.id) return;

    try {
      // Update profile with gender
      await supabase
        .from('profiles')
        .update({ gender })
        .eq('id', user.id);

      // Refresh profile
      await refreshProfile();
      
      // Create self node
      await createSelfNode(gender);
      
      setShowGenderSelect(false);
    } catch (error) {
      console.error('Error setting gender:', error);
    }
  };

  const handleAddParents = useCallback((id: string) => {
    setModal({ type: 'addParentFather', targetId: id });
  }, []);

  const handleAddSpouse = useCallback((id: string) => {
    setModal({ type: 'addSpouse', targetId: id });
  }, []);

  const handleAddChild = useCallback((id: string) => {
    setModal({ type: 'addChild', targetId: id });
  }, []);

  const handleOpenProfile = useCallback((member: FamilyMember) => {
    setModal({ type: 'profile', member });
  }, []);

  const handleSendInvitation = useCallback((member: FamilyMember) => {
    setModal({ type: 'invitation', member });
  }, []);

  const handleCloseModal = () => {
    setModal({ type: 'none' });
  };

  const handleSaveFather = (data: AddMemberData) => {
    setModal({ 
      type: 'addParentMother', 
      targetId: modal.targetId,
      fatherData: data,
    });
  };

  const handleSaveMother = (motherData: AddMemberData) => {
    if (modal.targetId && modal.fatherData) {
      addParents(modal.targetId, modal.fatherData, motherData);
    }
    handleCloseModal();
  };

  const handleSaveSpouse = (data: AddMemberData) => {
    if (modal.targetId) {
      const member = members[modal.targetId];
      const spouseGender = member?.gender === 'male' ? 'female' : 'male';
      addSpouse(modal.targetId, { ...data, gender: spouseGender });
    }
    handleCloseModal();
  };

  const handleSaveChild = (data: AddMemberData) => {
    if (modal.targetId) {
      addChild(modal.targetId, data);
    }
    handleCloseModal();
  };

  const handlePositionChange = useCallback((memberId: string, x: number, y: number) => {
    updatePosition(memberId, { x, y });
  }, [updatePosition]);

  const handleAcceptInvitation = async (invitation: any) => {
    setProcessingInvitation(invitation.id);
    await acceptInvitation(invitation);
    setProcessingInvitation(null);
  };

  const handleRejectInvitation = async (invitation: any) => {
    setProcessingInvitation(invitation.id);
    await rejectInvitation(invitation);
    setProcessingInvitation(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <TreeDeciduous className="w-12 h-12 mx-auto text-primary animate-pulse" />
          <p className="mt-4 text-muted-foreground">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  return (
    <section className="min-h-screen bg-background flex flex-col">
      {/* Gender Selection Modal */}
      <GenderSelectionModal
        isOpen={showGenderSelect}
        onSelect={handleGenderSelect}
      />

      {/* Header */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
              <TreeDeciduous className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Oilaviy Daraxt</h1>
              <p className="text-sm text-muted-foreground">Zoom va drag orqali harakatlanish mumkin</p>
            </div>
          </div>
        </div>
        
        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <div className="mt-4 rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-2 bg-muted/50 border-b border-border">
              <p className="text-sm font-medium">{pendingInvitations.length} ta taklifnoma kutmoqda</p>
            </div>
            <div className="divide-y divide-border">
              {pendingInvitations.map((inv) => (
                <FamilyInvitationItem
                  key={inv.id}
                  invitation={inv}
                  onAccept={handleAcceptInvitation}
                  onReject={handleRejectInvitation}
                  isProcessing={processingInvitation === inv.id}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="px-4 py-2 rounded-xl bg-card border border-border flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[hsl(200,70%,50%)]" />
            <span className="text-sm text-muted-foreground">Erkak</span>
          </div>
          <div className="px-4 py-2 rounded-xl bg-card border border-border flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[hsl(330,70%,55%)]" />
            <span className="text-sm text-muted-foreground">Ayol</span>
          </div>
          <div className="px-4 py-2 rounded-xl bg-card border border-border flex items-center gap-2">
            <div className="flex items-center">
              <div className="w-6 h-0 border-t-2 border-dashed border-[hsl(350,70%,60%)]" />
              <span className="text-[hsl(350,70%,60%)] text-xs ml-1">♥</span>
            </div>
            <span className="text-sm text-muted-foreground">Juftlik</span>
          </div>
          <div className="px-4 py-2 rounded-xl bg-card border border-border flex items-center gap-2">
            <div className="w-6 h-0 border-t-2 border-[hsl(210,70%,55%)]" />
            <span className="text-sm text-muted-foreground">Bola</span>
          </div>
        </div>
      </div>
      
      {/* Canvas */}
      <div className="flex-1 container mx-auto px-4 pb-6">
        <div className="h-[calc(100vh-280px)] min-h-[400px]">
          <FamilyTreeCanvas
            members={members}
            positions={positions}
            onOpenProfile={handleOpenProfile}
            onPositionChange={handlePositionChange}
          />
        </div>
      </div>

      {/* Add Father Modal */}
      <AddMemberModal
        isOpen={modal.type === 'addParentFather'}
        onClose={handleCloseModal}
        onSave={handleSaveFather}
        type="parents"
        gender="male"
        title="Ota ma'lumotlari"
        showNextPrompt={true}
        nextPromptText="Saqlangandan so'ng ona uchun ham ma'lumot kiritasiz"
      />

      {/* Add Mother Modal */}
      <AddMemberModal
        isOpen={modal.type === 'addParentMother'}
        onClose={handleCloseModal}
        onSave={handleSaveMother}
        type="parents"
        gender="female"
        title="Ona ma'lumotlari"
      />

      {/* Add Spouse Modal */}
      <AddMemberModal
        isOpen={modal.type === 'addSpouse'}
        onClose={handleCloseModal}
        onSave={handleSaveSpouse}
        type="spouse"
        gender={members[modal.targetId || '']?.gender === 'male' ? 'female' : 'male'}
        title="Juft ma'lumotlari"
      />

      {/* Add Child Modal */}
      <AddMemberModal
        isOpen={modal.type === 'addChild'}
        onClose={handleCloseModal}
        onSave={handleSaveChild}
        type="child"
        gender="male"
        title="Farzand ma'lumotlari"
      />

      {/* Profile Modal */}
      {modal.member && (
        <ProfileModal
          isOpen={modal.type === 'profile'}
          onClose={handleCloseModal}
          member={modal.member}
          onUpdate={updateMember}
          onDelete={removeMember}
          onAddParents={handleAddParents}
          onAddSpouse={handleAddSpouse}
          onAddChild={handleAddChild}
          onSendInvitation={handleSendInvitation}
          hasParents={(modal.member.parentIds?.length || 0) > 0}
          hasSpouse={!!modal.member.spouseId}
          canAddChild={!!modal.member.spouseId}
        />
      )}

      {/* Invitation Modal */}
      <SendInvitationModal
        isOpen={modal.type === 'invitation'}
        onClose={handleCloseModal}
        member={modal.member || null}
      />

      {/* Tree Merge Dialog */}
      {mergeData && (
        <TreeMergeDialog
          isOpen={showMergeDialog}
          onClose={closeMergeDialog}
          autoMergeCandidates={mergeData.autoMergeCandidates}
          childrenToMerge={mergeData.childrenToMerge}
          onConfirmAutoMerge={confirmAutoMerge}
          onMergeChildren={handleMergeChildren}
          senderName={mergeData.senderName}
        />
      )}
    </section>
  );
};
