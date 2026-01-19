import { useState, useRef, useEffect, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserIcon, Plus, HelpCircle, Heart, MoreHorizontal, Baby } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FamilyMember, FAMILY_LIMITS } from '@/hooks/useFamilyTree';
import { MemberCardDialog } from './MemberCardDialog';
import { SendInvitationDialog } from './SendInvitationDialog';
import { AddSpouseDialog } from './AddSpouseDialog';
import { AddFamilyMemberDialog } from './AddFamilyMemberDialog';
import { FamilyConnectorLines, useConnectionPositions } from './FamilyConnectorLines';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface User {
  id: string;
  full_name: string;
  avatar_url: string;
}

interface FamilyTreeProps {
  members: FamilyMember[];
  currentUser: User | null;
  userGender: 'male' | 'female' | null;
  onAddRelative: () => void;
  isOwner?: boolean;
  onSendInvitation?: (memberId: string, receiverId: string) => void;
  onDeleteMember?: (memberId: string) => void;
  onAddSpouse?: (memberId: string, spouseData: { name: string; gender: 'male' | 'female'; avatarUrl?: string }, isSecond: boolean) => void;
  onAddChild?: (memberId: string, childData: { name: string; gender: 'male' | 'female'; avatarUrl?: string }) => void;
  onAddFather?: (memberId: string, data: { name: string; avatarUrl?: string }) => void;
  onAddMother?: (memberId: string, data: { name: string; avatarUrl?: string }) => void;
  countSpousesForMember?: (memberId: string) => number;
  countChildrenForMember?: (memberId: string) => number;
  countFathersForMember?: (memberId: string) => number;
  countMothersForMember?: (memberId: string) => number;
}

// Relation labels mapping (these are private labels, only shown to profile owner)
const relationLabels: Record<string, string> = {
  father: 'Ota',
  mother: 'Ona',
  grandfather: 'Bobo',
  grandmother: 'Momo',
  brother: 'Aka',
  younger_brother: 'Ukasi',
  sister: 'Opa',
  younger_sister: 'Singil',
  son: "O'g'il",
  daughter: 'Qiz',
  husband: 'Er',
  wife: 'Xotin',
  uncle: "Tog'a/Amaki",
  aunt: 'Xola/Amma',
  nephew: 'Jiyan',
  niece: 'Jiyan',
  grandson: 'Nevara',
  granddaughter: 'Nevara',
  sibling: 'Aka/Uka/Opa/Singil',
  child: 'Farzand',
  spouse: "Turmush o'rtog'i",
  spouse_2: "Ikkinchi juft",
  grandparent: 'Buvi/Bobiyo',
  grandchild: 'Nevara',
  cousin: 'Amakivachcha',
};

export const FamilyTree = ({ 
  members, 
  currentUser, 
  userGender, 
  onAddRelative,
  isOwner = true,
  onSendInvitation,
  onDeleteMember,
  onAddSpouse,
  onAddChild,
  onAddFather,
  onAddMother,
  countSpousesForMember,
  countChildrenForMember,
  countFathersForMember,
  countMothersForMember,
}: FamilyTreeProps) => {
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [memberCardOpen, setMemberCardOpen] = useState(false);
  const [sendInvitationOpen, setSendInvitationOpen] = useState(false);
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);
  const [addSpouseDialogOpen, setAddSpouseDialogOpen] = useState(false);
  const [spouseTargetMember, setSpouseTargetMember] = useState<FamilyMember | null>(null);
  const [isSecondSpouse, setIsSecondSpouse] = useState(false);
  
  // New dialog states
  const [addChildDialogOpen, setAddChildDialogOpen] = useState(false);
  const [addFatherDialogOpen, setAddFatherDialogOpen] = useState(false);
  const [addMotherDialogOpen, setAddMotherDialogOpen] = useState(false);
  const [targetMemberForAction, setTargetMemberForAction] = useState<FamilyMember | null>(null);

  // Refs for connection lines
  const containerRef = useRef<HTMLDivElement>(null);
  const memberElementsRef = useRef<Map<string, HTMLElement | null>>(new Map());
  const heartElementsRef = useRef<Map<string, HTMLElement | null>>(new Map());
  const [renderKey, setRenderKey] = useState(0);

  // Force re-render after members update to recalculate lines
  useEffect(() => {
    const timer = setTimeout(() => setRenderKey(prev => prev + 1), 200);
    return () => clearTimeout(timer);
  }, [members]);

  // Ref setter functions
  const setMemberRef = useCallback((id: string, el: HTMLElement | null) => {
    memberElementsRef.current.set(id, el);
  }, []);

  const setHeartRef = useCallback((id: string, el: HTMLElement | null) => {
    heartElementsRef.current.set(id, el);
  }, []);

  // Calculate connections
  const connections = useConnectionPositions(
    containerRef,
    memberElementsRef.current,
    members,
    heartElementsRef.current
  );

  // Categorize members - include new relation types
  const parents = members.filter(r => ['father', 'mother'].includes(r.relation_type) || r.relation_type.includes('father_of_') || r.relation_type.includes('mother_of_'));
  const grandparents = members.filter(r => ['grandfather', 'grandmother', 'grandparent'].includes(r.relation_type));
  const siblings = members.filter(r => ['brother', 'younger_brother', 'sister', 'younger_sister', 'sibling'].includes(r.relation_type));
  const spouses = members.filter(r => ['husband', 'wife', 'spouse', 'spouse_2'].includes(r.relation_type));
  const children = members.filter(r => ['son', 'daughter', 'child'].includes(r.relation_type) || r.relation_type.startsWith('child_of_'));
  const others = members.filter(r => 
    !['father', 'mother', 'grandfather', 'grandmother', 'grandparent', 'brother', 'younger_brother', 'sister', 'younger_sister', 'sibling', 'husband', 'wife', 'spouse', 'spouse_2', 'son', 'daughter', 'child'].includes(r.relation_type) &&
    !r.relation_type.includes('spouse_of_') &&
    !r.relation_type.includes('spouse_2_of_') &&
    !r.relation_type.startsWith('child_of_') &&
    !r.relation_type.includes('father_of_') &&
    !r.relation_type.includes('mother_of_')
  );

  // Find spouses for a member by linked relationships
  const findSpousesForMember = (memberId: string): FamilyMember[] => {
    return members.filter(m => m.relation_type.includes('spouse_of_') && m.relation_type.endsWith(memberId));
  };

  const hasFirstSpouse = (memberId: string): boolean => {
    return members.some(m => m.relation_type === `spouse_of_${memberId}`);
  };

  const hasSecondSpouse = (memberId: string): boolean => {
    return members.some(m => m.relation_type === `spouse_2_of_${memberId}`);
  };

  const getSpouseOfMember = (memberId: string, isSecond: boolean = false): FamilyMember | null => {
    const relationType = isSecond ? `spouse_2_of_${memberId}` : `spouse_of_${memberId}`;
    return members.find(m => m.relation_type === relationType) || null;
  };

  const getChildrenOfMember = (memberId: string): FamilyMember[] => {
    return members.filter(m => m.relation_type.startsWith(`child_of_${memberId}`));
  };

  const getFathersOfMember = (memberId: string): FamilyMember[] => {
    return members.filter(m => m.relation_type === `father_of_${memberId}` || m.relation_type === `father_2_of_${memberId}`);
  };

  const getMothersOfMember = (memberId: string): FamilyMember[] => {
    return members.filter(m => m.relation_type === `mother_of_${memberId}` || m.relation_type === `mother_2_of_${memberId}`);
  };

  const getGenderColors = (gender: 'male' | 'female' | null | undefined) => {
    if (gender === 'male') {
      return {
        ring: 'ring-sky-400',
        bg: 'bg-sky-500',
        border: 'border-sky-400',
      };
    } else if (gender === 'female') {
      return {
        ring: 'ring-pink-400',
        bg: 'bg-pink-500',
        border: 'border-pink-400',
      };
    }
    return {
      ring: 'ring-muted',
      bg: 'bg-muted',
      border: 'border-muted',
    };
  };

  const handleMemberClick = (member: FamilyMember) => {
    setSelectedMember(member);
    setMemberCardOpen(true);
  };

  const handleSendInvitation = () => {
    if (selectedMember) {
      setPendingMemberId(selectedMember.id);
      setSendInvitationOpen(true);
    }
  };

  const handleSelectUser = (userId: string) => {
    if (pendingMemberId && onSendInvitation) {
      onSendInvitation(pendingMemberId, userId);
      setPendingMemberId(null);
    }
  };

  const handleDeleteMember = () => {
    if (selectedMember && onDeleteMember) {
      onDeleteMember(selectedMember.id);
    }
  };

  const handleAddSpouse = (member: FamilyMember, isSecond: boolean = false) => {
    setSpouseTargetMember(member);
    setIsSecondSpouse(isSecond);
    setAddSpouseDialogOpen(true);
  };

  const handleSpouseAdded = (spouseData: { name: string; gender: 'male' | 'female'; avatarUrl?: string }) => {
    if (spouseTargetMember && onAddSpouse) {
      onAddSpouse(spouseTargetMember.id, spouseData, isSecondSpouse);
    }
    setAddSpouseDialogOpen(false);
    setSpouseTargetMember(null);
  };

  const handleAddChild = (member: FamilyMember) => {
    setTargetMemberForAction(member);
    setAddChildDialogOpen(true);
  };

  const handleChildAdded = (childData: { name: string; gender: 'male' | 'female'; avatarUrl?: string }) => {
    if (targetMemberForAction && onAddChild) {
      onAddChild(targetMemberForAction.id, childData);
    }
    setAddChildDialogOpen(false);
    setTargetMemberForAction(null);
  };

  const handleAddFather = (member: FamilyMember) => {
    setTargetMemberForAction(member);
    setAddFatherDialogOpen(true);
  };

  const handleFatherAdded = (data: { name: string; gender: 'male' | 'female'; avatarUrl?: string }) => {
    if (targetMemberForAction && onAddFather) {
      onAddFather(targetMemberForAction.id, { name: data.name, avatarUrl: data.avatarUrl });
    }
    setAddFatherDialogOpen(false);
    setTargetMemberForAction(null);
  };

  const handleAddMother = (member: FamilyMember) => {
    setTargetMemberForAction(member);
    setAddMotherDialogOpen(true);
  };

  const handleMotherAdded = (data: { name: string; gender: 'male' | 'female'; avatarUrl?: string }) => {
    if (targetMemberForAction && onAddMother) {
      onAddMother(targetMemberForAction.id, { name: data.name, avatarUrl: data.avatarUrl });
    }
    setAddMotherDialogOpen(false);
    setTargetMemberForAction(null);
  };

  // Render heart connector between couple - with ref for line connections
  const renderHeartConnector = (memberId: string) => (
    <div 
      className="flex items-center justify-center mx-1"
      ref={(el) => setHeartRef(memberId, el)}
    >
      <Heart className="h-5 w-5 text-red-500 fill-red-500" />
    </div>
  );

  // Render member with spouse(s) as a couple unit
  const renderMemberWithSpouses = (member: FamilyMember, showLabel: boolean = true) => {
    const firstSpouse = getSpouseOfMember(member.id, false);
    const secondSpouse = getSpouseOfMember(member.id, true);
    const memberSpouseCount = countSpousesForMember ? countSpousesForMember(member.id) : 0;
    const memberChildCount = countChildrenForMember ? countChildrenForMember(member.id) : 0;
    const memberFatherCount = countFathersForMember ? countFathersForMember(member.id) : 0;
    const memberMotherCount = countMothersForMember ? countMothersForMember(member.id) : 0;

    const memberChildren = getChildrenOfMember(member.id);
    const memberFathers = getFathersOfMember(member.id);
    const memberMothers = getMothersOfMember(member.id);

    const hasSpouse = firstSpouse || secondSpouse;

    return (
      <div key={member.id} className="flex flex-col items-center gap-6">
        {/* Parents row (fathers and mothers) */}
        {(memberFathers.length > 0 || memberMothers.length > 0) && (
          <div className="flex gap-8 flex-wrap justify-center mb-2">
            {memberFathers.map(father => (
              <div key={father.id} ref={(el) => setMemberRef(father.id, el)}>
                {renderSingleMember(father, showLabel, 0, 0, 0, 0)}
              </div>
            ))}
            {memberMothers.map(mother => (
              <div key={mother.id} ref={(el) => setMemberRef(mother.id, el)}>
                {renderSingleMember(mother, showLabel, 0, 0, 0, 0)}
              </div>
            ))}
          </div>
        )}

        {/* Main member with spouses */}
        <div className="flex items-center gap-1">
          {/* Second spouse on left */}
          {secondSpouse && (
            <>
              <div ref={(el) => setMemberRef(secondSpouse.id, el)}>
                {renderSingleMember(secondSpouse, showLabel, 0, 0, 0, 0)}
              </div>
              {renderHeartConnector(member.id)}
            </>
          )}
          
          {/* Main member */}
          <div ref={(el) => setMemberRef(member.id, el)}>
            {renderSingleMember(member, showLabel, memberSpouseCount, memberChildCount, memberFatherCount, memberMotherCount)}
          </div>
          
          {/* First spouse on right */}
          {firstSpouse && (
            <>
              {renderHeartConnector(member.id)}
              <div ref={(el) => setMemberRef(firstSpouse.id, el)}>
                {renderSingleMember(firstSpouse, showLabel, 0, 0, 0, 0)}
              </div>
            </>
          )}
        </div>

        {/* Children of this member */}
        {memberChildren.length > 0 && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-8 flex-wrap justify-center">
              {memberChildren.map(child => (
                <div key={child.id} ref={(el) => setMemberRef(child.id, el)}>
                  {renderMemberWithSpouses(child, true)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSingleMember = (
    member: FamilyMember, 
    showLabel: boolean = true, 
    spouseCount: number = 0, 
    childCount: number = 0,
    fatherCount: number = 0,
    motherCount: number = 0
  ) => {
    const displayGender = member.linked_profile?.gender as 'male' | 'female' | null || member.gender;
    const colors = getGenderColors(displayGender);
    const displayName = member.linked_profile?.name || member.member_name;
    const displayAvatar = member.linked_profile?.avatar_url || member.avatar_url;
    const isPlaceholder = member.is_placeholder;
    const isSpouseRelation = member.relation_type.includes('spouse_of_');
    const isChildRelation = member.relation_type.includes('child_of_');
    const isParentRelation = member.relation_type.includes('father_of_') || member.relation_type.includes('mother_of_');

    // Get display label for relation type
    const getRelationLabel = (relationType: string) => {
      if (relationType.includes('spouse_of_')) return "Juft";
      if (relationType.includes('spouse_2_of_')) return "2-juft";
      if (relationType.includes('child_of_')) return "Farzand";
      if (relationType.includes('father_of_')) return "Ota";
      if (relationType.includes('father_2_of_')) return "2-ota";
      if (relationType.includes('mother_of_')) return "Ona";
      if (relationType.includes('mother_2_of_')) return "2-ona";
      return relationLabels[relationType] || relationType;
    };
    
    return (
      <div
        className="flex flex-col items-center gap-2 group relative"
      >
        <button
          onClick={() => handleMemberClick(member)}
          className="flex flex-col items-center gap-1"
        >
          <div className={cn("rounded-full p-0.5 relative", colors.ring, "ring-2")}>
            <Avatar className={cn("h-14 w-14 border-2", colors.border)}>
              <AvatarImage src={displayAvatar || undefined} />
              <AvatarFallback className={cn(colors.bg, "text-white text-lg")}>
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {isPlaceholder && (
              <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-amber-500 flex items-center justify-center">
                <HelpCircle className="h-3 w-3 text-white" />
              </div>
            )}
          </div>
          <div className="text-center max-w-[80px]">
            <p className="font-medium text-xs text-foreground truncate">{displayName}</p>
            {showLabel && isOwner && (
              <p className="text-[10px] text-muted-foreground">
                {getRelationLabel(member.relation_type)}
              </p>
            )}
          </div>
        </button>
      </div>
    );
  };

  const renderCurrentUser = () => {
    const colors = getGenderColors(userGender);
    const currentUserSpouse = spouses[0];
    const secondSpouse = spouses[1];
    
    // Determine spouse gender for add button (opposite of user's gender)
    const spouseGender: 'male' | 'female' = userGender === 'male' ? 'female' : 'male';
    
    return (
      <div className="flex items-center gap-1">
        {/* Second spouse on left */}
        {secondSpouse && (
          <>
            <div ref={(el) => setMemberRef(secondSpouse.id, el)}>
              {renderSingleMember(secondSpouse, false, 0, 0, 0, 0)}
            </div>
            {renderHeartConnector('current-user')}
          </>
        )}

        {/* Current user */}
        <div className="flex flex-col items-center gap-2">
          <div className={cn("rounded-full p-1", colors.ring, "ring-4")}>
            <Avatar className={cn("h-16 w-16 border-2", colors.border)}>
              <AvatarImage src={currentUser?.avatar_url} />
              <AvatarFallback className={cn(colors.bg, "text-white text-xl")}>
                {currentUser?.full_name ? currentUser.full_name.charAt(0).toUpperCase() : <UserIcon className="h-8 w-8" />}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="text-center">
            <p className="font-bold text-sm text-foreground">{currentUser?.full_name || 'Siz'}</p>
            <p className="text-[10px] text-muted-foreground">Siz</p>
          </div>

          {/* Add spouse button for current user */}
          {isOwner && spouses.length === 0 && (
            <button
              onClick={onAddRelative}
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center transition-all",
                spouseGender === 'male' ? 'bg-sky-500 hover:bg-sky-600' : 'bg-pink-500 hover:bg-pink-600',
                "text-white shadow-sm"
              )}
              title="Juft qo'shish"
            >
              <Plus className="h-3 w-3" />
            </button>
          )}
          
          {/* Second spouse dropdown for current user */}
          {isOwner && spouses.length === 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-6 h-6 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-all text-muted-foreground"
                >
                  <MoreHorizontal className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                <DropdownMenuItem onClick={onAddRelative}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ikkinchi juft qo'shish
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* First spouse on right */}
        {currentUserSpouse && (
          <>
            {renderHeartConnector('current-user')}
            <div ref={(el) => setMemberRef(currentUserSpouse.id, el)}>
              {renderSingleMember(currentUserSpouse, false, 0, 0, 0, 0)}
            </div>
          </>
        )}
      </div>
    );
  };

  // Filter out members that are shown as spouses/children of other members
  const topLevelMembers = [...grandparents, ...parents.filter(p => !p.relation_type.includes('_of_')), ...siblings, ...children.filter(c => !c.relation_type.includes('_of_')), ...others];
  
  return (
    <div ref={containerRef} className="relative min-h-[60vh] flex flex-col items-center py-8">
      {/* SVG Connection Lines */}
      <FamilyConnectorLines 
        key={renderKey}
        containerRef={containerRef} 
        connections={connections} 
      />

      {/* Dotted background pattern for chess-like feel */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      <div className="relative z-10 w-full space-y-12">
        {/* Grandparents row */}
        {grandparents.length > 0 && (
          <div className="flex justify-center gap-12 flex-wrap px-4">
            {grandparents.map(member => (
              <div key={member.id} ref={(el) => setMemberRef(member.id, el)}>
                {renderMemberWithSpouses(member)}
              </div>
            ))}
          </div>
        )}

        {/* Parents row - only non-dynamic parents */}
        {parents.filter(p => !p.relation_type.includes('_of_')).length > 0 && (
          <div className="flex justify-center gap-12 flex-wrap px-4">
            {/* Group father and mother together as a couple */}
            <div className="flex items-center gap-1">
              {parents.filter(p => !p.relation_type.includes('_of_')).map((parent, index) => (
                <div key={parent.id} className="flex items-center" ref={(el) => setMemberRef(parent.id, el)}>
                  {renderSingleMember(parent, true, 0, 0, 0, 0)}
                  {index === 0 && parents.filter(p => !p.relation_type.includes('_of_')).length > 1 && renderHeartConnector('parents')}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current user + spouse + siblings row */}
        <div className="flex items-start justify-center gap-10 flex-wrap px-4">
          {/* Siblings on left */}
          {siblings.length > 0 && (
            <div className="flex gap-8 items-start">
              {siblings.map(sibling => (
                <div key={sibling.id} ref={(el) => setMemberRef(sibling.id, el)}>
                  {renderMemberWithSpouses(sibling)}
                </div>
              ))}
            </div>
          )}

          {/* Current user with spouse(s) in center */}
          {renderCurrentUser()}
        </div>

        {/* Children row - only non-dynamic children */}
        {children.filter(c => !c.relation_type.includes('_of_')).length > 0 && (
          <div className="flex justify-center gap-10 flex-wrap px-4">
            {children.filter(c => !c.relation_type.includes('_of_')).map(child => (
              <div key={child.id} ref={(el) => setMemberRef(child.id, el)}>
                {renderMemberWithSpouses(child)}
              </div>
            ))}
          </div>
        )}

        {/* Other relatives */}
        {others.length > 0 && (
          <div className="mt-8 pt-8 border-t border-border/30 w-full">
            <p className="text-sm font-medium text-muted-foreground mb-6 text-center">Boshqa qarindoshlar</p>
            <div className="flex justify-center gap-10 flex-wrap px-4">
              {others.map(other => (
                <div key={other.id} ref={(el) => setMemberRef(other.id, el)}>
                  {renderMemberWithSpouses(other)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add relative floating button - only show for owner */}
      {isOwner && (
        <button
          onClick={onAddRelative}
          className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-lg flex items-center justify-center transition-colors z-50"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Member card dialog */}
      <MemberCardDialog
        open={memberCardOpen}
        onOpenChange={setMemberCardOpen}
        member={selectedMember}
        isOwner={isOwner}
        onSendInvitation={handleSendInvitation}
        onDelete={handleDeleteMember}
        onAddSpouse={(isSecond) => {
          if (selectedMember) {
            handleAddSpouse(selectedMember, isSecond);
            setMemberCardOpen(false);
          }
        }}
        onAddChild={() => {
          if (selectedMember) {
            handleAddChild(selectedMember);
            setMemberCardOpen(false);
          }
        }}
        onAddFather={() => {
          if (selectedMember) {
            handleAddFather(selectedMember);
            setMemberCardOpen(false);
          }
        }}
        onAddMother={() => {
          if (selectedMember) {
            handleAddMother(selectedMember);
            setMemberCardOpen(false);
          }
        }}
        spouseCount={selectedMember ? (countSpousesForMember ? countSpousesForMember(selectedMember.id) : 0) : 0}
        childCount={selectedMember ? (countChildrenForMember ? countChildrenForMember(selectedMember.id) : 0) : 0}
        fatherCount={selectedMember ? (countFathersForMember ? countFathersForMember(selectedMember.id) : 0) : 0}
        motherCount={selectedMember ? (countMothersForMember ? countMothersForMember(selectedMember.id) : 0) : 0}
      />

      {/* Send invitation dialog */}
      <SendInvitationDialog
        open={sendInvitationOpen}
        onOpenChange={setSendInvitationOpen}
        onSelectUser={handleSelectUser}
      />

      {/* Add spouse dialog */}
      <AddSpouseDialog
        open={addSpouseDialogOpen}
        onOpenChange={setAddSpouseDialogOpen}
        targetMember={spouseTargetMember}
        isSecondSpouse={isSecondSpouse}
        onAddSpouse={handleSpouseAdded}
      />

      {/* Add child dialog */}
      <AddFamilyMemberDialog
        open={addChildDialogOpen}
        onOpenChange={setAddChildDialogOpen}
        title="Farzand qo'shish"
        showGenderSelect={true}
        onAdd={handleChildAdded}
      />

      {/* Add father dialog */}
      <AddFamilyMemberDialog
        open={addFatherDialogOpen}
        onOpenChange={setAddFatherDialogOpen}
        title="Ota qo'shish"
        gender="male"
        onAdd={handleFatherAdded}
      />

      {/* Add mother dialog */}
      <AddFamilyMemberDialog
        open={addMotherDialogOpen}
        onOpenChange={setAddMotherDialogOpen}
        title="Ona qo'shish"
        gender="female"
        onAdd={handleMotherAdded}
      />
    </div>
  );
};
