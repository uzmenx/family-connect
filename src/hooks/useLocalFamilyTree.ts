import { useState, useCallback, useEffect, useRef } from 'react';
import { FamilyMember, AddMemberData } from '@/types/family';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const generateId = () => crypto.randomUUID();

// Debounce helper for position updates
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export const useLocalFamilyTree = () => {
  const { user } = useAuth();
  const [members, setMembers] = useState<Record<string, FamilyMember>>({});
  const [rootId, setRootId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load from Supabase on mount and subscribe to realtime
  useEffect(() => {
    if (user?.id) {
      loadFromSupabase();
      
      // Subscribe to realtime changes
      const channel = supabase
        .channel('family_tree_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'family_tree_members',
            filter: `owner_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('Realtime update:', payload);
            // Reload on any change
            loadFromSupabase();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
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
          // Parse relation_type to extract relationships and position
          const relationType = item.relation_type;
          let position: { x: number; y: number } | undefined;
          
          // Extract position from relation_type if exists (format: type|x:123|y:456)
          const posMatch = relationType.match(/\|x:([-\d.]+)\|y:([-\d.]+)/);
          if (posMatch) {
            position = { x: parseFloat(posMatch[1]), y: parseFloat(posMatch[2]) };
          }
          
          membersMap[item.id] = {
            id: item.id,
            name: item.member_name,
            gender: (item.gender as 'male' | 'female') || 'male',
            photoUrl: item.avatar_url || undefined,
            supabaseId: item.id,
            linkedUserId: item.linked_user_id || undefined,
            position,
            childrenIds: [],
            parentIds: [],
          };
        });

        // Second pass: establish relationships based on relation_type
        data.forEach((item) => {
          const relationType = item.relation_type.split('|')[0]; // Remove position data
          
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
        const selfMember = data.find(m => m.relation_type.startsWith('self'));
        if (selfMember) {
          setRootId(selfMember.id);
        } else if (data.length > 0) {
          setRootId(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading family tree:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveToSupabase = async (member: FamilyMember, relationType: string) => {
    if (!user?.id) return null;

    // Include position in relation_type
    const positionStr = member.position 
      ? `|x:${member.position.x}|y:${member.position.y}` 
      : '';

    try {
      const { data, error } = await supabase
        .from('family_tree_members')
        .insert({
          id: member.id,
          owner_id: user.id,
          member_name: member.name || '',
          gender: member.gender,
          avatar_url: member.photoUrl || null,
          relation_type: relationType + positionStr,
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
      const updateData: Record<string, any> = {};
      
      if (updates.name !== undefined) updateData.member_name = updates.name;
      if (updates.photoUrl !== undefined) updateData.avatar_url = updates.photoUrl || null;
      if (updates.gender !== undefined) updateData.gender = updates.gender;

      // If position is updated, we need to update relation_type
      if (updates.position) {
        const { data: current } = await supabase
          .from('family_tree_members')
          .select('relation_type')
          .eq('id', memberId)
          .single();

        if (current) {
          // Remove old position data and add new
          const baseType = current.relation_type.split('|')[0];
          const positionStr = `|x:${updates.position.x}|y:${updates.position.y}`;
          updateData.relation_type = baseType + positionStr;
        }
      }

      if (Object.keys(updateData).length > 0) {
        await supabase
          .from('family_tree_members')
          .update(updateData)
          .eq('id', memberId)
          .eq('owner_id', user.id);
      }
    } catch (error) {
      console.error('Error updating in Supabase:', error);
    }
  };

  // Debounced position update
  const debouncedPositionUpdate = useRef(
    debounce((memberId: string, position: { x: number; y: number }) => {
      updateInSupabase(memberId, { position });
    }, 500)
  ).current;

  const updatePosition = useCallback((memberId: string, position: { x: number; y: number }) => {
    // Update local state immediately
    setMembers(prev => {
      if (!prev[memberId]) return prev;
      return {
        ...prev,
        [memberId]: { ...prev[memberId], position },
      };
    });

    // Debounce cloud sync
    debouncedPositionUpdate(memberId, position);
  }, [debouncedPositionUpdate]);

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
      position: { x: 0, y: 0 },
      childrenIds: [],
    };

    const wife: FamilyMember = {
      id: wifeId,
      name: '',
      gender: 'female',
      spouseId: husbandId,
      position: { x: 180, y: 0 },
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

    const child = members[childId];
    const childPos = child?.position || { x: 0, y: 0 };

    setMembers(prev => {
      const child = prev[childId];
      if (!child) return prev;

      const father: FamilyMember = {
        id: fatherId,
        ...fatherData,
        gender: 'male',
        spouseId: motherId,
        position: { x: childPos.x - 90, y: childPos.y - 200 },
        childrenIds: [childId],
      };

      const mother: FamilyMember = {
        id: motherId,
        ...motherData,
        gender: 'female',
        spouseId: fatherId,
        position: { x: childPos.x + 90, y: childPos.y - 200 },
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

    // Save to Supabase with positions
    const fatherMember: FamilyMember = {
      id: fatherId,
      ...fatherData,
      gender: 'male',
      position: { x: childPos.x - 90, y: childPos.y - 200 },
      childrenIds: [childId],
    };
    const motherMember: FamilyMember = {
      id: motherId,
      ...motherData,
      gender: 'female',
      position: { x: childPos.x + 90, y: childPos.y - 200 },
      childrenIds: [childId],
    };

    await saveToSupabase(fatherMember, `father_of_${childId}`);
    await saveToSupabase(motherMember, `mother_of_${childId}`);

    return { fatherId, motherId };
  }, [members]);

  const addSpouse = useCallback(async (memberId: string, spouseData: AddMemberData) => {
    const spouseId = generateId();
    const member = members[memberId];
    if (!member) return null;

    const spouseGender = member.gender === 'male' ? 'female' : 'male';
    const memberPos = member.position || { x: 0, y: 0 };
    const spousePos = { 
      x: memberPos.x + (member.gender === 'male' ? 180 : -180), 
      y: memberPos.y 
    };

    setMembers(prev => ({
      ...prev,
      [memberId]: { ...prev[memberId], spouseId },
      [spouseId]: {
        id: spouseId,
        ...spouseData,
        gender: spouseGender,
        spouseId: memberId,
        position: spousePos,
        childrenIds: [],
      },
    }));

    // Save to Supabase with position
    const spouseMember: FamilyMember = {
      id: spouseId,
      ...spouseData,
      gender: spouseGender,
      position: spousePos,
      childrenIds: [],
    };
    await saveToSupabase(spouseMember, `spouse_of_${memberId}`);

    return spouseId;
  }, [members]);

  const addChild = useCallback(async (parentId: string, childData: AddMemberData) => {
    const childId = generateId();
    const parent = members[parentId];
    if (!parent) return null;

    const parentIds = parent.spouseId ? [parentId, parent.spouseId] : [parentId];
    
    // Calculate child position
    const parentPos = parent.position || { x: 0, y: 0 };
    const spousePos = parent.spouseId ? members[parent.spouseId]?.position : null;
    const centerX = spousePos 
      ? (parentPos.x + spousePos.x) / 2 
      : parentPos.x;
    
    const siblingCount = parent.childrenIds?.length || 0;
    const childPos = { 
      x: centerX + (siblingCount - (parent.childrenIds?.length || 0) / 2) * 200, 
      y: parentPos.y + 200 
    };

    setMembers(prev => {
      const updates: Record<string, FamilyMember> = {
        [childId]: {
          id: childId,
          ...childData,
          parentIds,
          position: childPos,
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

    // Save to Supabase with position
    const childMember: FamilyMember = {
      id: childId,
      ...childData,
      parentIds,
      position: childPos,
      childrenIds: [],
    };
    const childCount = (parent.childrenIds?.length || 0) + 1;
    await saveToSupabase(childMember, `child_of_${parentId}_${childCount}`);

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
    updatePosition,
    addParents,
    addSpouse,
    addChild,
    removeMember,
    reload: loadFromSupabase,
  };
};
