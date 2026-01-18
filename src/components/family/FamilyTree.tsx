import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Relative, User } from '@/types';
import { User as UserIcon, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FamilyTreeProps {
  relatives: Relative[];
  currentUser: User | null;
  userGender: 'male' | 'female' | null;
  onAddRelative: () => void;
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
  grandparent: 'Buvi/Bobiyo',
  grandchild: 'Nevara',
  cousin: 'Amakivachcha',
};

export const FamilyTree = ({ relatives, currentUser, userGender, onAddRelative }: FamilyTreeProps) => {
  // Categorize relatives
  const parents = relatives.filter(r => ['father', 'mother'].includes(r.relation_type));
  const grandparents = relatives.filter(r => ['grandfather', 'grandmother', 'grandparent'].includes(r.relation_type));
  const siblings = relatives.filter(r => ['brother', 'younger_brother', 'sister', 'younger_sister', 'sibling'].includes(r.relation_type));
  const spouse = relatives.filter(r => ['husband', 'wife', 'spouse'].includes(r.relation_type));
  const children = relatives.filter(r => ['son', 'daughter', 'child'].includes(r.relation_type));
  const others = relatives.filter(r => 
    !['father', 'mother', 'grandfather', 'grandmother', 'grandparent', 'brother', 'younger_brother', 'sister', 'younger_sister', 'sibling', 'husband', 'wife', 'spouse', 'son', 'daughter', 'child'].includes(r.relation_type)
  );

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

  const renderRelativeNode = (relative: Relative) => {
    const colors = getGenderColors(relative.gender);
    
    return (
      <div key={relative.id} className="flex flex-col items-center gap-2">
        <div className={cn("rounded-full p-0.5", colors.ring, "ring-2")}>
          <Avatar className={cn("h-16 w-16 border-2", colors.border)}>
            <AvatarImage src={relative.avatar_url} />
            <AvatarFallback className={cn(colors.bg, "text-white text-lg")}>
              {relative.relative_name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="text-center">
          <p className="font-medium text-sm">{relative.relative_name}</p>
          <p className="text-xs text-muted-foreground">{relationLabels[relative.relation_type] || relative.relation_type}</p>
        </div>
      </div>
    );
  };

  const renderCurrentUser = () => {
    const colors = getGenderColors(userGender);
    
    return (
      <div className="flex flex-col items-center gap-2">
        <div className={cn("rounded-full p-1", colors.ring, "ring-4")}>
          <Avatar className={cn("h-20 w-20 border-2", colors.border)}>
            <AvatarImage src={currentUser?.avatar_url} />
            <AvatarFallback className={cn(colors.bg, "text-white text-xl")}>
              {currentUser?.full_name ? currentUser.full_name.charAt(0).toUpperCase() : <UserIcon className="h-8 w-8" />}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="text-center">
          <p className="font-bold">{currentUser?.full_name || 'Siz'}</p>
          <p className="text-xs text-muted-foreground">Siz</p>
        </div>
      </div>
    );
  };

  return (
    <div className="relative min-h-[60vh] flex flex-col items-center justify-center space-y-8 py-8">
      {/* Grandparents row */}
      {grandparents.length > 0 && (
        <div className="flex justify-center gap-8 flex-wrap">
          {grandparents.map(renderRelativeNode)}
        </div>
      )}

      {/* Connector line */}
      {grandparents.length > 0 && parents.length > 0 && (
        <div className="w-0.5 h-6 bg-muted-foreground/30"></div>
      )}

      {/* Parents row */}
      {parents.length > 0 && (
        <div className="flex justify-center items-center gap-4">
          {parents.map((parent, index) => (
            <div key={parent.id} className="flex items-center">
              {renderRelativeNode(parent)}
              {index === 0 && parents.length > 1 && (
                <div className="mx-2 w-8 h-0.5 bg-muted-foreground/50 flex items-center justify-center">
                  <span className="text-muted-foreground text-lg">⚭</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Connector line */}
      {parents.length > 0 && (
        <div className="w-0.5 h-6 bg-muted-foreground/30"></div>
      )}

      {/* Current user + spouse + siblings row */}
      <div className="flex items-center gap-6 flex-wrap justify-center">
        {/* Siblings on left */}
        {siblings.length > 0 && (
          <div className="flex gap-4">
            {siblings.map(renderRelativeNode)}
          </div>
        )}

        {/* Current user in center */}
        <div className="flex items-center gap-4">
          {renderCurrentUser()}
          
          {/* Spouse connected with line */}
          {spouse.length > 0 && (
            <>
              <div className="w-8 h-0.5 bg-muted-foreground/50 flex items-center justify-center">
                <span className="text-muted-foreground text-lg">⚭</span>
              </div>
              {spouse.map(renderRelativeNode)}
            </>
          )}
        </div>
      </div>

      {/* Connector line */}
      {children.length > 0 && (
        <div className="w-0.5 h-6 bg-muted-foreground/30"></div>
      )}

      {/* Children row */}
      {children.length > 0 && (
        <div className="flex justify-center gap-6 flex-wrap">
          {children.map(renderRelativeNode)}
        </div>
      )}

      {/* Other relatives */}
      {others.length > 0 && (
        <div className="mt-8 pt-8 border-t border-border w-full">
          <p className="text-sm font-medium text-muted-foreground mb-4 text-center">Boshqa qarindoshlar</p>
          <div className="flex justify-center gap-6 flex-wrap">
            {others.map(renderRelativeNode)}
          </div>
        </div>
      )}

      {/* Add relative floating button */}
      <button
        onClick={onAddRelative}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-lg flex items-center justify-center transition-colors z-50"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
};
