import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { UserPlus, Users, Baby, ImagePlus, Send } from 'lucide-react';
import { FamilyMember } from '@/types/family';
import { cn } from '@/lib/utils';

interface FamilyMemberNodeData {
  member: FamilyMember;
  onAddParents: (id: string) => void;
  onAddSpouse: (id: string) => void;
  onAddChild: (id: string) => void;
  onOpenProfile: (member: FamilyMember) => void;
  onSendInvitation: (member: FamilyMember) => void;
  hasParents: boolean;
  hasSpouse: boolean;
  canAddChild: boolean;
}

interface FamilyMemberNodeProps {
  data: FamilyMemberNodeData;
}

const FamilyMemberNode = memo(({ data }: FamilyMemberNodeProps) => {
  const { 
    member, 
    onAddParents, 
    onAddSpouse, 
    onAddChild, 
    onOpenProfile,
    onSendInvitation,
    hasParents, 
    hasSpouse, 
    canAddChild 
  } = data;

  const yearDisplay = member.birthYear 
    ? `${member.birthYear}${member.deathYear ? ` - ${member.deathYear}` : ''}`
    : '';

  const isMale = member.gender === 'male';

  return (
    <div className="relative">
      {/* Top handle for parent connections */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-sky-500 !w-2.5 !h-2.5 !border-2 !border-background !-top-1"
      />
      
      <div 
        className={cn(
          "min-w-[140px] p-4 rounded-2xl shadow-lg transition-all duration-200 hover:shadow-xl",
          "border-2",
          isMale 
            ? "bg-sky-50 dark:bg-sky-950/30 border-sky-300 dark:border-sky-700" 
            : "bg-pink-50 dark:bg-pink-950/30 border-pink-300 dark:border-pink-700"
        )}
      >
        {/* Avatar - clickable */}
        <div 
          className={cn(
            "relative w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center",
            "cursor-pointer transition-transform duration-200 hover:scale-110 shadow-md",
            isMale 
              ? "bg-sky-500" 
              : "bg-pink-500"
          )}
          onClick={() => onOpenProfile(member)}
        >
          {/* Spouse connection handle */}
          {isMale && (
            <Handle
              type="source"
              position={Position.Right}
              id="spouse-right"
              className="!bg-red-500 !w-2 !h-2 !border-2 !border-background"
            />
          )}
          {!isMale && (
            <Handle
              type="target"
              position={Position.Left}
              id="spouse-left"
              className="!bg-red-500 !w-2 !h-2 !border-2 !border-background"
            />
          )}

          {member.photoUrl ? (
            <img 
              src={member.photoUrl} 
              alt={member.name} 
              className="w-full h-full rounded-full object-cover"
            />
          ) : member.name ? (
            <span className="text-xl font-bold text-white">
              {member.name[0]?.toUpperCase()}
            </span>
          ) : (
            <ImagePlus className="w-6 h-6 text-white/70" />
          )}
        </div>
        
        {/* Name - clickable */}
        <div 
          className="text-center cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => onOpenProfile(member)}
        >
          <h3 className="font-medium text-foreground truncate max-w-[130px] mx-auto">
            {member.name || 'Ism kiriting'}
          </h3>
          <span className={cn(
            "text-xs mt-1 inline-block px-2 py-0.5 rounded-full",
            isMale 
              ? "bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300" 
              : "bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300"
          )}>
            {yearDisplay || "Yil ma'lumoti"}
          </span>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-1.5 justify-center mt-3">
          {!hasParents && (
            <button
              className={cn(
                "px-2 py-1 text-xs rounded-lg flex items-center gap-1 transition-colors",
                "bg-background/80 hover:bg-background border border-border text-foreground"
              )}
              onClick={(e) => { e.stopPropagation(); onAddParents(member.id); }}
            >
              <Users className="w-3 h-3" />
              Ota-ona
            </button>
          )}
          
          {!hasSpouse && (
            <button
              className={cn(
                "px-2 py-1 text-xs rounded-lg flex items-center gap-1 transition-colors",
                "bg-background/80 hover:bg-background border border-border text-foreground"
              )}
              onClick={(e) => { e.stopPropagation(); onAddSpouse(member.id); }}
            >
              <UserPlus className="w-3 h-3" />
              Juft
            </button>
          )}
          
          {canAddChild && (
            <button
              className={cn(
                "px-2 py-1 text-xs rounded-lg flex items-center gap-1 transition-colors",
                "bg-background/80 hover:bg-background border border-border text-foreground"
              )}
              onClick={(e) => { e.stopPropagation(); onAddChild(member.id); }}
            >
              <Baby className="w-3 h-3" />
              Farzand
            </button>
          )}

          {/* Invitation button */}
          {member.name && !member.linkedUserId && (
            <button
              className={cn(
                "px-2 py-1 text-xs rounded-lg flex items-center gap-1 transition-colors",
                "bg-emerald-100 dark:bg-emerald-900/50 hover:bg-emerald-200 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
              )}
              onClick={(e) => { e.stopPropagation(); onSendInvitation(member); }}
            >
              <Send className="w-3 h-3" />
              Taklif
            </button>
          )}
        </div>
      </div>
      
      {/* Bottom handle for children connections */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-sky-500 !w-2.5 !h-2.5 !border-2 !border-background !-bottom-1"
      />
    </div>
  );
});

FamilyMemberNode.displayName = 'FamilyMemberNode';

export default FamilyMemberNode;
export type { FamilyMemberNodeData };
