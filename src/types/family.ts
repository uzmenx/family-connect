export interface FamilyMember {
  id: string;
  name: string;
  birthYear?: number;
  deathYear?: number;
  gender: 'male' | 'female';
  photoUrl?: string;
  spouseId?: string;
  parentIds?: string[];
  childrenIds?: string[];
  // Position for canvas layout
  position?: { x: number; y: number };
  // For Supabase integration
  supabaseId?: string;
  linkedUserId?: string;
}

export interface AddMemberData {
  name: string;
  birthYear?: number;
  deathYear?: number;
  gender: 'male' | 'female';
  photoUrl?: string;
}

export type AddMemberType = 'parents' | 'spouse' | 'child';
