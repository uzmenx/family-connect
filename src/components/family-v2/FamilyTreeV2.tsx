import { useEffect, useState, useCallback } from 'react';
import { TreeDeciduous } from 'lucide-react';
import { FamilyTreeCanvas } from './FamilyTreeCanvas';
import { AddMemberModal } from './AddMemberModal';
import { ProfileModal } from './ProfileModal';
import { SendInvitationModal } from './SendInvitationModal';
import { useLocalFamilyTree } from '@/hooks/useLocalFamilyTree';
import { FamilyMember, AddMemberData } from '@/types/family';
import { cn } from '@/lib/utils';

type ModalState = {
  type: 'none' | 'addParentFather' | 'addParentMother' | 'addSpouse' | 'addChild' | 'profile' | 'invitation';
  targetId?: string;
  member?: FamilyMember;
  fatherData?: AddMemberData;
};

export const FamilyTreeV2 = () => {
  const {
    members,
    rootId,
    isLoading,
    addInitialCouple,
    addParents,
    addSpouse,
    addChild,
    updateMember,
    removeMember,
  } = useLocalFamilyTree();

  const [modal, setModal] = useState<ModalState>({ type: 'none' });

  useEffect(() => {
    if (!isLoading && !rootId && Object.keys(members).length === 0) {
      addInitialCouple();
    }
  }, [rootId, members, isLoading, addInitialCouple]);

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
        
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="px-4 py-2 rounded-xl bg-card border border-border flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-sky-500" />
            <span className="text-sm text-muted-foreground">Erkak</span>
          </div>
          <div className="px-4 py-2 rounded-xl bg-card border border-border flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-pink-500" />
            <span className="text-sm text-muted-foreground">Ayol</span>
          </div>
          <div className="px-4 py-2 rounded-xl bg-card border border-border flex items-center gap-2">
            <div className="flex items-center">
              <div className="w-6 h-0 border-t-2 border-dashed border-red-500" />
              <span className="text-red-500 text-xs ml-1">♥</span>
            </div>
            <span className="text-sm text-muted-foreground">Juftlik</span>
          </div>
          <div className="px-4 py-2 rounded-xl bg-card border border-border flex items-center gap-2">
            <div className="w-6 h-0 border-t-2 border-sky-500" />
            <span className="text-sm text-muted-foreground">Bola</span>
          </div>
        </div>
      </div>
      
      {/* Canvas */}
      <div className="flex-1 container mx-auto px-4 pb-6">
        <div className="h-[calc(100vh-280px)] min-h-[400px]">
          <FamilyTreeCanvas
            members={members}
            onOpenProfile={handleOpenProfile}
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
    </section>
  );
};
