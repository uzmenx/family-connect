import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Relative, User } from '@/types';

interface FamilyTreeProps {
  relatives: Relative[];
  currentUser: User | null;
}

const relationLabels: Record<string, string> = {
  father: 'Ota',
  mother: 'Ona',
  sibling: 'Aka/Uka/Opa/Singil',
  child: 'Farzand',
  spouse: 'Turmush o\'rtog\'i',
  grandparent: 'Buvi/Bobiyo',
  grandchild: 'Nevara',
  uncle: 'Tog\'a/Amaki',
  aunt: 'Xola/Amma',
  cousin: 'Amakivachcha',
};

export const FamilyTree = ({ relatives, currentUser }: FamilyTreeProps) => {
  const parents = relatives.filter(r => r.relation_type === 'father' || r.relation_type === 'mother');
  const grandparents = relatives.filter(r => r.relation_type === 'grandparent');
  const siblings = relatives.filter(r => r.relation_type === 'sibling');
  const spouse = relatives.filter(r => r.relation_type === 'spouse');
  const children = relatives.filter(r => r.relation_type === 'child');
  const others = relatives.filter(r => 
    !['father', 'mother', 'grandparent', 'sibling', 'spouse', 'child'].includes(r.relation_type)
  );

  const renderRelativeNode = (relative: Relative) => (
    <div key={relative.id} className="flex flex-col items-center gap-2">
      <Avatar className="h-16 w-16 border-2 border-primary/20">
        <AvatarImage src={relative.avatar_url} />
        <AvatarFallback className="bg-primary/10 text-primary text-lg">
          {relative.relative_name.charAt(0)}
        </AvatarFallback>
      </Avatar>
      <div className="text-center">
        <p className="font-medium text-sm">{relative.relative_name}</p>
        <p className="text-xs text-muted-foreground">{relationLabels[relative.relation_type]}</p>
      </div>
    </div>
  );

  const renderCurrentUser = () => (
    <div className="flex flex-col items-center gap-2">
      <Avatar className="h-20 w-20 border-4 border-primary ring-4 ring-primary/20">
        <AvatarImage src={currentUser?.avatar_url} />
        <AvatarFallback className="bg-primary text-primary-foreground text-xl">
          {currentUser?.full_name.charAt(0)}
        </AvatarFallback>
      </Avatar>
      <div className="text-center">
        <p className="font-bold">{currentUser?.full_name}</p>
        <p className="text-xs text-muted-foreground">Siz</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Grandparents */}
      {grandparents.length > 0 && (
        <Card className="p-4">
          <p className="text-sm font-medium text-muted-foreground mb-4 text-center">Buvi va Bobi</p>
          <div className="flex justify-center gap-8 flex-wrap">
            {grandparents.map(renderRelativeNode)}
          </div>
          <div className="flex justify-center mt-4">
            <div className="w-0.5 h-8 bg-border"></div>
          </div>
        </Card>
      )}

      {/* Parents */}
      {parents.length > 0 && (
        <Card className="p-4">
          <p className="text-sm font-medium text-muted-foreground mb-4 text-center">Ota-Ona</p>
          <div className="flex justify-center gap-8 flex-wrap">
            {parents.map(renderRelativeNode)}
          </div>
          <div className="flex justify-center mt-4">
            <div className="w-0.5 h-8 bg-border"></div>
          </div>
        </Card>
      )}

      {/* Current User + Spouse + Siblings */}
      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex justify-center items-center gap-8 flex-wrap">
          {siblings.length > 0 && (
            <div className="flex gap-4 flex-wrap justify-center">
              {siblings.map(renderRelativeNode)}
            </div>
          )}
          
          <div className="flex items-center gap-4">
            {renderCurrentUser()}
            {spouse.length > 0 && (
              <>
                <div className="w-8 h-0.5 bg-primary"></div>
                {spouse.map(renderRelativeNode)}
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Children */}
      {children.length > 0 && (
        <Card className="p-4">
          <div className="flex justify-center mb-4">
            <div className="w-0.5 h-8 bg-border"></div>
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-4 text-center">Farzandlar</p>
          <div className="flex justify-center gap-8 flex-wrap">
            {children.map(renderRelativeNode)}
          </div>
        </Card>
      )}

      {/* Other relatives */}
      {others.length > 0 && (
        <Card className="p-4">
          <p className="text-sm font-medium text-muted-foreground mb-4 text-center">Boshqa qarindoshlar</p>
          <div className="flex justify-center gap-6 flex-wrap">
            {others.map(renderRelativeNode)}
          </div>
        </Card>
      )}
    </div>
  );
};
