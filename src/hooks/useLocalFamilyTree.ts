import { useState, useCallback, useEffect } from 'react';
import { FamilyMember, AddMemberData } from '@/types/family';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const generateId = () => Math.random().toString(36).substring(2, 11);

export const useLocalFamilyTree = () => {
  const { user } = useAuth();
  const [members, setMembers] = useState<Record<string, FamilyMember>>({});
  const [rootId, setRootId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load from Supabase on mount
  useEffect(() => {
    if (user?.id) {
      loadFromSupabase();
    }
  }, [user?.id]);

  const loadFromSupabase = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('family_tree_members')
        .select('*')
        .eq('owner_id', user.id);

      if (error) throw error;

      if (data && data.length > 0) {
        // Convert Supabase data to local format
        const membersMap: Record<string, FamilyMember> = {};
        
        data.forEach((item) => {
          // Parse relation_type to extract relationships
          const relationType = item.relation_type;
          
          membersMap[item.id] = {
            id: item.id,
            name: item.member_name,
            gender: (item.gender as 'male' | 'female') || 'male',
            photoUrl: item.avatar_url || undefined,
            supabaseId: item.id,
            linkedUserId: item.linked_user_id || undefined,
            childrenIds: [],
            parentIds: [],
          };
        });

        // Second pass: establish relationships based on relation_type
        data.forEach((item) => {
          const relationType = item.relation_type;
          
          // Parse spouse relationships
          if (relationType.startsWith('spouse_of_')) {
            const partnerId = relationType.replace('spouse_of_', '').split('_')[0];
            if (membersMap[partnerId]) {
              membersMap[item.id].spouseId = partnerId;
              membersMap[partnerId].spouseId = item.id;
            }
          }
          
          // Parse child relationships
          if (relationType.startsWith('child_of_')) {
            const parentId = relationType.replace('child_of_', '').split('_')[0];
            if (membersMap[parentId]) {
              if (!membersMap[item.id].parentIds) membersMap[item.id].parentIds = [];
              membersMap[item.id].parentIds!.push(parentId);
              
              // Add spouse as parent too
              if (membersMap[parentId].spouseId) {
                membersMap[item.id].parentIds!.push(membersMap[parentId].spouseId!);
              }
              
              // Update parent's children
              if (!membersMap[parentId].childrenIds) membersMap[parentId].childrenIds = [];
              membersMap[parentId].childrenIds!.push(item.id);
              
              if (membersMap[parentId].spouseId) {
                const spouseId = membersMap[parentId].spouseId!;
                if (!membersMap[spouseId].childrenIds) membersMap[spouseId].childrenIds = [];
                membersMap[spouseId].childrenIds!.push(item.id);
              }
            }
          }
        });

        setMembers(membersMap);
        
        // Find root (self member)
        const selfMember = data.find(m => m.relation_type === 'self');
        if (selfMember) {
          setRootId(selfMember.id);
        } else if (data.length > 0) {
          setRootId(data[0].id);
        }
      } else {
        // No data - will create initial couple
        addInitialCouple();
      }
    } catch (error) {
      console.error('Error loading family tree:', error);
      addInitialCouple();
    } finally {
      setIsLoading(false);
    }
  };

  const saveToSupabase = async (member: FamilyMember, relationType: string) => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('family_tree_members')
        .insert({
          id: member.id,
          owner_id: user.id,
          member_name: member.name || '',
          gender: member.gender,
          avatar_url: member.photoUrl || null,
          relation_type: relationType,
          is_placeholder: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error saving to Supabase:', error);
      return null;
    }
  };

  const updateInSupabase = async (memberId: string, updates: Partial<FamilyMember>) => {
    if (!user?.id) return;

    try {
      await supabase
        .from('family_tree_members')
        .update({
          member_name: updates.name,
          avatar_url: updates.photoUrl || null,
          gender: updates.gender,
        })
        .eq('id', memberId)
        .eq('owner_id', user.id);
    } catch (error) {
      console.error('Error updating in Supabase:', error);
    }
  };

  const deleteFromSupabase = async (memberId: string) => {
    if (!user?.id) return;

    try {
      await supabase
        .from('family_tree_members')
        .delete()
        .eq('id', memberId)
        .eq('owner_id', user.id);
    } catch (error) {
      console.error('Error deleting from Supabase:', error);
    }
  };

  const addInitialCouple = useCallback(async () => {
    if (!user?.id) return { husbandId: '', wifeId: '' };

    const husbandId = generateId();
    const wifeId = generateId();

    const husband: FamilyMember = {
      id: husbandId,
      name: '',
      gender: 'male',
      spouseId: wifeId,
      childrenIds: [],
    };

    const wife: FamilyMember = {
      id: wifeId,
      name: '',
      gender: 'female',
      spouseId: husbandId,
      childrenIds: [],
    };

    setMembers({
      [husbandId]: husband,
      [wifeId]: wife,
    });
    setRootId(husbandId);

    // Save to Supabase
    await saveToSupabase(husband, 'self');
    await saveToSupabase(wife, `spouse_of_${husbandId}`);

    return { husbandId, wifeId };
  }, [user?.id]);

  const addMember = useCallback((data: AddMemberData): string => {
    const id = generateId();
    const member: FamilyMember = {
      id,
      ...data,
      childrenIds: [],
    };

    setMembers(prev => ({
      ...prev,
      [id]: member,
    }));

    return id;
  }, []);

  const updateMember = useCallback(async (id: string, updates: Partial<FamilyMember>) => {
    setMembers(prev => {
      if (!prev[id]) return prev;
      return {
        ...prev,
        [id]: { ...prev[id], ...updates },
      };
    });

    await updateInSupabase(id, updates);
  }, []);

  const addParents = useCallback(async (childId: string, fatherData: AddMemberData, motherData: AddMemberData) => {
    const fatherId = generateId();
    const motherId = generateId();

    setMembers(prev => {
      const child = prev[childId];
      if (!child) return prev;

      const father: FamilyMember = {
        id: fatherId,
        ...fatherData,
        gender: 'male',
        spouseId: motherId,
        childrenIds: [childId],
      };

      const mother: FamilyMember = {
        id: motherId,
        ...motherData,
        gender: 'female',
        spouseId: fatherId,
        childrenIds: [childId],
      };

      return {
        ...prev,
        [fatherId]: father,
        [motherId]: mother,
        [childId]: {
          ...child,
          parentIds: [fatherId, motherId],
        },
      };
    });

    // Save to Supabase
    await saveToSupabase({ id: fatherId, ...fatherData, gender: 'male', childrenIds: [childId] }, `father_of_${childId}`);
    await saveToSupabase({ id: motherId, ...motherData, gender: 'female', childrenIds: [childId] }, `mother_of_${childId}`);

    return { fatherId, motherId };
  }, []);

  const addSpouse = useCallback(async (memberId: string, spouseData: AddMemberData) => {
    const spouseId = generateId();
    const member = members[memberId];
    if (!member) return null;

    const spouseGender = member.gender === 'male' ? 'female' : 'male';

    setMembers(prev => ({
      ...prev,
      [memberId]: { ...prev[memberId], spouseId },
      [spouseId]: {
        id: spouseId,
        ...spouseData,
        gender: spouseGender,
        spouseId: memberId,
        childrenIds: [],
      },
    }));

    // Save to Supabase
    await saveToSupabase({ id: spouseId, ...spouseData, gender: spouseGender, childrenIds: [] }, `spouse_of_${memberId}`);

    return spouseId;
  }, [members]);

  const addChild = useCallback(async (parentId: string, childData: AddMemberData) => {
    const childId = generateId();
    const parent = members[parentId];
    if (!parent) return null;

    const parentIds = parent.spouseId ? [parentId, parent.spouseId] : [parentId];

    setMembers(prev => {
      const updates: Record<string, FamilyMember> = {
        [childId]: {
          id: childId,
          ...childData,
          parentIds,
          childrenIds: [],
        },
      };

      // Update both parents' childrenIds
      parentIds.forEach(pid => {
        if (prev[pid]) {
          updates[pid] = {
            ...prev[pid],
            childrenIds: [...(prev[pid].childrenIds || []), childId],
          };
        }
      });

      return { ...prev, ...updates };
    });

    // Save to Supabase
    const childCount = (parent.childrenIds?.length || 0) + 1;
    await saveToSupabase({ id: childId, ...childData, parentIds, childrenIds: [] }, `child_of_${parentId}_${childCount}`);

    return childId;
  }, [members]);

  const removeMember = useCallback(async (id: string) => {
    setMembers(prev => {
      const member = prev[id];
      if (!member) return prev;

      const updates = { ...prev };
      delete updates[id];

      // Remove from spouse
      if (member.spouseId && updates[member.spouseId]) {
        updates[member.spouseId] = {
          ...updates[member.spouseId],
          spouseId: undefined,
        };
      }

      // Remove from parents' childrenIds
      member.parentIds?.forEach(pid => {
        if (updates[pid]) {
          updates[pid] = {
            ...updates[pid],
            childrenIds: updates[pid].childrenIds?.filter(cid => cid !== id),
          };
        }
      });

      // Remove parentIds from children
      member.childrenIds?.forEach(cid => {
        if (updates[cid]) {
          updates[cid] = {
            ...updates[cid],
            parentIds: updates[cid].parentIds?.filter(pid => pid !== id),
          };
        }
      });

      return updates;
    });

    await deleteFromSupabase(id);
  }, []);

  return {
    members,
    rootId,
    isLoading,
    addInitialCouple,
    addMember,
    updateMember,
    addParents,
    addSpouse,
    addChild,
    removeMember,
    reload: loadFromSupabase,
  };
};
