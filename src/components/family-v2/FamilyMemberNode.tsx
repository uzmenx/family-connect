import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ImagePlus } from 'lucide-react';
import { FamilyMember } from '@/types/family';
import { cn } from '@/lib/utils';

interface FamilyMemberNodeData {
  member: FamilyMember;
  onOpenProfile: (member: FamilyMember) => void;
}

interface FamilyMemberNodeProps {
  data: FamilyMemberNodeData;
}

const FamilyMemberNode = memo(({ data }: FamilyMemberNodeProps) => {
  const { member, onOpenProfile } = data;

  const yearDisplay = member.birthYear 
    ? `${member.birthYear}${member.deathYear ? ` - ${member.deathYear}` : ''}`
    : '';

  const isMale = member.gender === 'male';

  return (
    <div className="relative flex flex-col items-center">
      {/* Top handle for parent connections */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-sky-500 !w-2.5 !h-2.5 !border-2 !border-background !-top-1"
      />
      
      {/* Avatar - clickable */}
      <div 
        className={cn(
          "relative w-20 h-20 rounded-full flex items-center justify-center",
          "cursor-pointer transition-transform duration-200 hover:scale-110 shadow-lg border-3",
          isMale 
            ? "bg-sky-500 border-sky-400" 
            : "bg-pink-500 border-pink-400"
        )}
        onClick={() => onOpenProfile(member)}
      >
        {/* Spouse connection handles */}
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
          <span className="text-2xl font-bold text-white">
            {member.name[0]?.toUpperCase()}
          </span>
        ) : (
          <ImagePlus className="w-8 h-8 text-white/70" />
        )}
      </div>
      
      {/* Name and year display */}
      <div 
        className="text-center mt-2 cursor-pointer"
        onClick={() => onOpenProfile(member)}
      >
        <h3 className={cn(
          "font-medium text-sm px-3 py-1 rounded-full",
          isMale 
            ? "bg-sky-900/80 text-sky-100" 
            : "bg-pink-900/80 text-pink-100"
        )}>
          {member.name || 'Ism kiriting'}
        </h3>
        <span className={cn(
          "text-xs mt-1 inline-block px-2 py-0.5 rounded-full",
          isMale 
            ? "bg-sky-800/60 text-sky-200" 
            : "bg-pink-800/60 text-pink-200"
        )}>
          {yearDisplay || "Yil ma'lumoti"}
        </span>
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
