import { useEffect, useState, useCallback } from 'react';
import { TreeDeciduous, X, GitMerge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FamilyTreeCanvas } from './FamilyTreeCanvas';
import { AddMemberModal } from './AddMemberModal';
import { ProfileModal } from './ProfileModal';
import { SendInvitationModal } from './SendInvitationModal';
import { GenderSelectionModal } from './GenderSelectionModal';
import { UnifiedMergeDialog } from './UnifiedMergeDialog';
import { useLocalFamilyTree } from '@/hooks/useLocalFamilyTree';
import { useFamilyInvitations, MergeDialogData } from '@/hooks/useFamilyInvitations';
import { useMergeMode } from '@/hooks/useMergeMode';
import { useSpouseLock } from '@/hooks/useSpouseLock';
import { FamilyMember, AddMemberData } from '@/types/family';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { FamilyInvitationItem } from './FamilyInvitationItem';
import { toast } from 'sonner';

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
    createSelfNode
  } = useLocalFamilyTree();

  const {
    pendingInvitations,
    acceptInvitation,
    rejectInvitation,
    showMergeDialog,
    setShowMergeDialog,
    mergeData,
    setMergeData,
    executeMerge: executeTreeMerge,
    closeMergeDialog,
    isMerging
  } = useFamilyInvitations();

  const {
    isActive: isMergeMode,
    selectedIds: mergeSelectedIds,
    mergedProfiles,
    isProcessing: isMergeProcessing,
    startMergeMode,
    toggleSelection: toggleMergeSelection,
    cancelMerge,
    computeMergeData
  } = useMergeMode(members);

  // Spouse lock hook
  const { isPairLocked, toggleLock } = useSpouseLock();

  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const [showGenderSelect, setShowGenderSelect] = useState(false);
  const [processingInvitation, setProcessingInvitation] = useState<string | null>(null);
  const [isSelectingGender, setIsSelectingGender] = useState(false);


  // Build positions map from members
  const positions = Object.fromEntries(
    Object.values(members).
    filter((m) => m.position).
    map((m) => [m.id, m.position!])
  );

  // Check if user needs to select gender on first visit
  useEffect(() => {
    if (!isLoading && user?.id && profile) {
      if (!profile.gender) {
        setShowGenderSelect(true);
      } else if (Object.keys(members).length === 0) {
        createSelfNode(profile.gender as 'male' | 'female');
      }
    }
  }, [isLoading, user?.id, profile?.gender, Object.keys(members).length]);

  const handleGenderSelect = async (gender: 'male' | 'female') => {
    if (!user?.id || isSelectingGender) return;
    setIsSelectingGender(true);

    try {
      await supabase.
      from('profiles').
      update({ gender }).
      eq('id', user.id);

      await refreshProfile();
      await createSelfNode(gender);
      setShowGenderSelect(false);
    } catch (error) {
      console.error('Error setting gender:', error);
    } finally {
      setIsSelectingGender(false);
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
      fatherData: data
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

  // Merge mode handlers
  const handleLongPress = useCallback((memberId: string) => {
    startMergeMode(memberId);
  }, [startMergeMode]);

  const handleToggleMergeSelect = useCallback((memberId: string) => {
    toggleMergeSelection(memberId);
  }, [toggleMergeSelection]);

  // Birlashtirish va taklif bir xil dialog: manual merge ham shu dialogdan
  const handleOpenManualMergeDialog = useCallback(() => {
    const data = computeMergeData();
    if (data) {
      setMergeData(data);
      setShowMergeDialog(true);
    }
  }, [computeMergeData, setMergeData, setShowMergeDialog]);

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <TreeDeciduous className="w-12 h-12 mx-auto text-primary animate-pulse" />
          <p className="mt-4 text-muted-foreground">Yuklanmoqda...</p>
        </div>
      </div>);

  }

  return (
    <section className="min-h-screen flex flex-col">
      {/* Gender Selection Modal */}
      <GenderSelectionModal
        isOpen={showGenderSelect}
        onSelect={handleGenderSelect}
        disabled={isSelectingGender} />


      {/* Inline Merge Mode Bar (replaces MergeSelectionOverlay) */}
      {isMergeMode &&
      <div className="fixed inset-x-0 top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border shadow-lg">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                variant="ghost"
                size="icon"
                onClick={cancelMerge}
                className="shrink-0">

                  <X className="h-5 w-5" />
                </Button>
                <div>
                  <h3 className="font-semibold text-foreground">
                    Birlashtirish rejimi
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {mergeSelectedIds.length} ta profil tanlandi
                  </p>
                </div>
              </div>
              
              <Button
              onClick={handleOpenManualMergeDialog}
              disabled={mergeSelectedIds.length < 2 || isMergeProcessing}
              className="gap-2">

                <GitMerge className="h-4 w-4" />
                Birlashtirish
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Birinchi tanlangan profil asosiy bo'ladi. Boshqa profillarni tanlang.
            </p>
          </div>
        </div>
      }

      {/* Header */}
      <div className="container mx-auto px-2 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
              <TreeDeciduous className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Qarindosh</h1>
              

            </div>
          </div>
        </div>
        
        {/* Pending Invitations */}
        {pendingInvitations.length > 0 &&
        <div className="mt-4 rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-2 bg-muted/50 border-b border-border">
              <p className="text-sm font-medium">{pendingInvitations.length} ta taklifnoma kutmoqda</p>
            </div>
            <div className="divide-y divide-border">
              {pendingInvitations.map((inv) =>
            <FamilyInvitationItem
              key={inv.id}
              invitation={inv}
              onAccept={handleAcceptInvitation}
              onReject={handleRejectInvitation}
              isProcessing={processingInvitation === inv.id} />

            )}
            </div>
          </div>
        }
      </div>
      
      {/* Canvas */}
      <div className={cn("flex-1 container mx-auto px-1 pb-2", isMergeMode && "pt-16")}>
        <div className="h-[calc(100vh-230px)] min-h-[420px]">
          <FamilyTreeCanvas
            members={members}
            positions={positions}
            onOpenProfile={handleOpenProfile}
            onPositionChange={handlePositionChange}
            isMergeMode={isMergeMode}
            mergeSelectedIds={mergeSelectedIds}
            mergedProfiles={mergedProfiles}
            onLongPress={handleLongPress}
            onToggleMergeSelect={handleToggleMergeSelect}
            isPairLocked={isPairLocked} />

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
        nextPromptText="Saqlangandan so'ng ona uchun ham ma'lumot kiritasiz" />


      {/* Add Mother Modal */}
      <AddMemberModal
        isOpen={modal.type === 'addParentMother'}
        onClose={handleCloseModal}
        onSave={handleSaveMother}
        type="parents"
        gender="female"
        title="Ona ma'lumotlari" />


      {/* Add Spouse Modal */}
      <AddMemberModal
        isOpen={modal.type === 'addSpouse'}
        onClose={handleCloseModal}
        onSave={handleSaveSpouse}
        type="spouse"
        gender={members[modal.targetId || '']?.gender === 'male' ? 'female' : 'male'}
        title="Juft ma'lumotlari" />


      {/* Add Child Modal */}
      <AddMemberModal
        isOpen={modal.type === 'addChild'}
        onClose={handleCloseModal}
        onSave={handleSaveChild}
        type="child"
        gender="male"
        title="Farzand ma'lumotlari" />


      {/* Profile Modal */}
      {modal.member &&
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
        isSpouseLocked={isPairLocked(modal.member.id, modal.member.spouseId)}
        onToggleSpouseLock={() => toggleLock(modal.member!.id, modal.member!.spouseId)} />

      }

      {/* Invitation Modal */}
      <SendInvitationModal
        isOpen={modal.type === 'invitation'}
        onClose={handleCloseModal}
        member={modal.member || null} />


      {/* Birlashtirish dialogi */}
      {mergeData !== null &&
      <UnifiedMergeDialog
        isOpen={showMergeDialog}
        onClose={closeMergeDialog}
        data={mergeData}
        onConfirm={executeTreeMerge}
        isProcessing={isMerging} />

      }
    </section>);

};