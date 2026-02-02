import { useState, useCallback, useEffect, useRef } from 'react';
import { FamilyMember, AddMemberData } from '@/types/family';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Unique client ID to prevent real-time feedback loops
const CLIENT_ID = crypto.randomUUID();
const generateId = () => crypto.randomUUID();

export const useLocalFamilyTree = () => {
  const { user } = useAuth();
  const [members, setMembers] = useState<Record<string, FamilyMember>>({});
  const [rootId, setRootId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Prevent updates while dragging
  const isDraggingRef = useRef(false);
  const pendingUpdatesRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Load initial data
  const loadData = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      // Load members and positions in parallel
      const [membersRes, positionsRes] = await Promise.all([
        supabase.from('family_tree_members').select('*').eq('owner_id', user.id),
        supabase.from('node_positions').select('*').eq('owner_id', user.id)
      ]);

      if (membersRes.error) throw membersRes.error;
      if (positionsRes.error) throw positionsRes.error;

      const dbMembers = membersRes.data || [];
      const dbPositions = positionsRes.data || [];

      // Build positions map
      const posMap = new Map<string, { x: number; y: number }>();
      dbPositions.forEach((p: any) => {
        posMap.set(p.member_id, { x: p.x, y: p.y });
      });

      // Build members map - first pass: create all members
      const membersMap: Record<string, FamilyMember> = {};
      
      dbMembers.forEach((m: any) => {
        const pos = posMap.get(m.id);
        membersMap[m.id] = {
          id: m.id,
          name: m.member_name || '',
          gender: (m.gender as 'male' | 'female') || 'male',
          photoUrl: m.avatar_url || undefined,
          position: pos || { x: 0, y: 0 },
          childrenIds: [],
          parentIds: [],
          linkedUserId: m.linked_user_id || undefined,
          supabaseId: m.id,
        };
      });

      // Second pass: establish ALL relationships from relation_type
      dbMembers.forEach((m: any) => {
        const relType = (m.relation_type || '').split('|')[0];
        
        // Handle spouse relationships (bidirectional)
        if (relType.startsWith('spouse_of_')) {
          const partnerId = relType.replace('spouse_of_', '');
          if (membersMap[partnerId]) {
            membersMap[m.id].spouseId = partnerId;
            membersMap[partnerId].spouseId = m.id;
          }
        }
        
        // Handle father_of_ relationships - this member is father of childId
        if (relType.startsWith('father_of_')) {
          const childId = relType.replace('father_of_', '');
          if (membersMap[childId]) {
            // Add this member as parent of child
            if (!membersMap[childId].parentIds) membersMap[childId].parentIds = [];
            if (!membersMap[childId].parentIds.includes(m.id)) {
              membersMap[childId].parentIds.push(m.id);
            }
            // Add child to this member's children
            if (!membersMap[m.id].childrenIds) membersMap[m.id].childrenIds = [];
            if (!membersMap[m.id].childrenIds.includes(childId)) {
              membersMap[m.id].childrenIds.push(childId);
            }
          }
        }
        
        // Handle mother_of_ relationships - this member is mother of childId
        if (relType.startsWith('mother_of_')) {
          const childId = relType.replace('mother_of_', '');
          if (membersMap[childId]) {
            // Add this member as parent of child
            if (!membersMap[childId].parentIds) membersMap[childId].parentIds = [];
            if (!membersMap[childId].parentIds.includes(m.id)) {
              membersMap[childId].parentIds.push(m.id);
            }
            // Add child to this member's children
            if (!membersMap[m.id].childrenIds) membersMap[m.id].childrenIds = [];
            if (!membersMap[m.id].childrenIds.includes(childId)) {
              membersMap[m.id].childrenIds.push(childId);
            }
          }
        }
        
        // Handle child_of_ relationships - this member is child of parentId
        if (relType.startsWith('child_of_')) {
          const match = relType.match(/child_of_([a-f0-9-]+)/);
          if (match) {
            const parentId = match[1];
            if (membersMap[parentId]) {
              // Add parent to this member's parents
              if (!membersMap[m.id].parentIds) membersMap[m.id].parentIds = [];
              if (!membersMap[m.id].parentIds.includes(parentId)) {
                membersMap[m.id].parentIds.push(parentId);
              }
              // Add this member to parent's children
              if (!membersMap[parentId].childrenIds) membersMap[parentId].childrenIds = [];
              if (!membersMap[parentId].childrenIds.includes(m.id)) {
                membersMap[parentId].childrenIds.push(m.id);
              }
              // Also link to parent's spouse if exists
              if (membersMap[parentId].spouseId && membersMap[membersMap[parentId].spouseId!]) {
                const spouseId = membersMap[parentId].spouseId!;
                if (!membersMap[m.id].parentIds.includes(spouseId)) {
                  membersMap[m.id].parentIds.push(spouseId);
                }
                if (!membersMap[spouseId].childrenIds) membersMap[spouseId].childrenIds = [];
                if (!membersMap[spouseId].childrenIds.includes(m.id)) {
                  membersMap[spouseId].childrenIds.push(m.id);
                }
              }
            }
          }
        }
      });
      
      // Third pass: link spouse's children (for couples where both parents exist)
      Object.values(membersMap).forEach((member) => {
        if (member.spouseId && membersMap[member.spouseId]) {
          const spouse = membersMap[member.spouseId];
          // Merge children
          const allChildren = new Set([...(member.childrenIds || []), ...(spouse.childrenIds || [])]);
          const childrenArray = Array.from(allChildren);
          membersMap[member.id].childrenIds = childrenArray;
          membersMap[spouse.id].childrenIds = childrenArray;
          
          // Ensure all children have both parents
          childrenArray.forEach((childId) => {
            if (membersMap[childId]) {
              if (!membersMap[childId].parentIds) membersMap[childId].parentIds = [];
              if (!membersMap[childId].parentIds.includes(member.id)) {
                membersMap[childId].parentIds.push(member.id);
              }
              if (!membersMap[childId].parentIds.includes(spouse.id)) {
                membersMap[childId].parentIds.push(spouse.id);
              }
            }
          });
        }
      });

      // Create positions for members without saved positions
      const newPositions: { member_id: string; owner_id: string; x: number; y: number; updated_by: string }[] = [];
      let offsetX = 0;
      
      Object.values(membersMap).forEach((member) => {
        if (!posMap.has(member.id)) {
          membersMap[member.id].position = { x: offsetX, y: 0 };
          newPositions.push({
            member_id: member.id,
            owner_id: user.id,
            x: offsetX,
            y: 0,
            updated_by: CLIENT_ID,
          });
          offsetX += 200;
        }
      });

      if (newPositions.length > 0) {
        await supabase.from('node_positions').insert(newPositions);
      }

      setMembers(membersMap);

      // Set root (self member)
      const selfMember = dbMembers.find((m: any) => m.relation_type?.startsWith('self'));
      setRootId(selfMember?.id || dbMembers[0]?.id || null);

    } catch (error) {
      console.error('Error loading family tree:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time subscriptions - merge updates, don't reload
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('family_tree_sync')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'family_tree_members', filter: `owner_id=eq.${user.id}` },
        (payload) => {
          const m = payload.new as any;
          setMembers((prev) => ({
            ...prev,
            [m.id]: {
              id: m.id,
              name: m.member_name || '',
              gender: (m.gender as 'male' | 'female') || 'male',
              photoUrl: m.avatar_url || undefined,
              position: { x: 0, y: 0 },
              childrenIds: [],
              parentIds: [],
            },
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'family_tree_members', filter: `owner_id=eq.${user.id}` },
        (payload) => {
          const id = (payload.old as { id: string }).id;
          setMembers((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'node_positions', filter: `owner_id=eq.${user.id}` },
        (payload) => {
          // Ignore while dragging
          if (isDraggingRef.current) {
            const p = payload.new as any;
            if (p) pendingUpdatesRef.current.set(p.member_id, { x: p.x, y: p.y });
            return;
          }
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const p = payload.new as any;
            // Ignore own updates
            if (p.updated_by === CLIENT_ID) return;
            
            setMembers((prev) => {
              if (!prev[p.member_id]) return prev;
              return {
                ...prev,
                [p.member_id]: { ...prev[p.member_id], position: { x: p.x, y: p.y } },
              };
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Update position - called on drag end only
  const updatePosition = useCallback(async (memberId: string, position: { x: number; y: number }) => {
    if (!user?.id) return;
    
    isDraggingRef.current = false;

    // Apply pending updates from other clients
    pendingUpdatesRef.current.forEach((pos, id) => {
      if (id !== memberId) {
        setMembers((prev) => {
          if (!prev[id]) return prev;
          return { ...prev, [id]: { ...prev[id], position: pos } };
        });
      }
    });
    pendingUpdatesRef.current.clear();

    // Update local state
    setMembers((prev) => {
      if (!prev[memberId]) return prev;
      return { ...prev, [memberId]: { ...prev[memberId], position } };
    });

    // Upsert to database
    await supabase
      .from('node_positions')
      .upsert({
        member_id: memberId,
        owner_id: user.id,
        x: position.x,
        y: position.y,
        updated_by: CLIENT_ID,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'member_id' });
  }, [user?.id]);

  // Add initial couple
  const addInitialCouple = useCallback(async () => {
    if (!user?.id) return { husbandId: '', wifeId: '' };

    const husbandId = generateId();
    const wifeId = generateId();

    try {
      // Insert members
      await supabase.from('family_tree_members').insert([
        { id: husbandId, owner_id: user.id, member_name: '', gender: 'male', relation_type: 'self', is_placeholder: true },
        { id: wifeId, owner_id: user.id, member_name: '', gender: 'female', relation_type: `spouse_of_${husbandId}`, is_placeholder: true },
      ]);

      // Insert positions
      await supabase.from('node_positions').insert([
        { member_id: husbandId, owner_id: user.id, x: 0, y: 0, updated_by: CLIENT_ID },
        { member_id: wifeId, owner_id: user.id, x: 180, y: 0, updated_by: CLIENT_ID },
      ]);

      setMembers({
        [husbandId]: { id: husbandId, name: '', gender: 'male', spouseId: wifeId, position: { x: 0, y: 0 }, childrenIds: [] },
        [wifeId]: { id: wifeId, name: '', gender: 'female', spouseId: husbandId, position: { x: 180, y: 0 }, childrenIds: [] },
      });
      setRootId(husbandId);

      return { husbandId, wifeId };
    } catch (error) {
      console.error('Error creating initial couple:', error);
      return { husbandId: '', wifeId: '' };
    }
  }, [user?.id]);

  // Update member info
  const updateMember = useCallback(async (id: string, updates: Partial<FamilyMember>) => {
    if (!user?.id) return;

    setMembers((prev) => {
      if (!prev[id]) return prev;
      return { ...prev, [id]: { ...prev[id], ...updates } };
    });

    const dbUpdates: Record<string, any> = {};
    if (updates.name !== undefined) dbUpdates.member_name = updates.name;
    if (updates.photoUrl !== undefined) dbUpdates.avatar_url = updates.photoUrl || null;
    if (updates.gender !== undefined) dbUpdates.gender = updates.gender;

    if (Object.keys(dbUpdates).length > 0) {
      await supabase.from('family_tree_members').update(dbUpdates).eq('id', id).eq('owner_id', user.id);
    }
  }, [user?.id]);

  // Remove member
  const removeMember = useCallback(async (id: string) => {
    if (!user?.id) return;

    setMembers((prev) => {
      const member = prev[id];
      if (!member) return prev;

      const next = { ...prev };
      delete next[id];

      if (member.spouseId && next[member.spouseId]) {
        next[member.spouseId] = { ...next[member.spouseId], spouseId: undefined };
      }
      member.parentIds?.forEach((pid) => {
        if (next[pid]) {
          next[pid] = { ...next[pid], childrenIds: next[pid].childrenIds?.filter((c) => c !== id) };
        }
      });
      member.childrenIds?.forEach((cid) => {
        if (next[cid]) {
          next[cid] = { ...next[cid], parentIds: next[cid].parentIds?.filter((p) => p !== id) };
        }
      });

      return next;
    });

    // Cascade will delete position
    await supabase.from('family_tree_members').delete().eq('id', id).eq('owner_id', user.id);
  }, [user?.id]);

  // Add parents
  const addParents = useCallback(async (childId: string, fatherData: AddMemberData, motherData: AddMemberData) => {
    if (!user?.id) return { fatherId: '', motherId: '' };

    const child = members[childId];
    const childPos = child?.position || { x: 0, y: 0 };
    const fatherId = generateId();
    const motherId = generateId();

    const fatherPos = { x: childPos.x - 90, y: childPos.y - 200 };
    const motherPos = { x: childPos.x + 90, y: childPos.y - 200 };

    try {
      await supabase.from('family_tree_members').insert([
        { id: fatherId, owner_id: user.id, member_name: fatherData.name || '', gender: 'male', relation_type: `father_of_${childId}`, is_placeholder: true },
        { id: motherId, owner_id: user.id, member_name: motherData.name || '', gender: 'female', relation_type: `mother_of_${childId}`, is_placeholder: true },
      ]);

      await supabase.from('node_positions').insert([
        { member_id: fatherId, owner_id: user.id, x: fatherPos.x, y: fatherPos.y, updated_by: CLIENT_ID },
        { member_id: motherId, owner_id: user.id, x: motherPos.x, y: motherPos.y, updated_by: CLIENT_ID },
      ]);

      setMembers((prev) => ({
        ...prev,
        [fatherId]: { id: fatherId, name: fatherData.name || '', gender: 'male', spouseId: motherId, position: fatherPos, childrenIds: [childId] },
        [motherId]: { id: motherId, name: motherData.name || '', gender: 'female', spouseId: fatherId, position: motherPos, childrenIds: [childId] },
        [childId]: { ...prev[childId], parentIds: [fatherId, motherId] },
      }));

      return { fatherId, motherId };
    } catch (error) {
      console.error('Error adding parents:', error);
      return { fatherId: '', motherId: '' };
    }
  }, [user?.id, members]);

  // Add spouse
  const addSpouse = useCallback(async (memberId: string, spouseData: AddMemberData) => {
    const member = members[memberId];
    if (!member || !user?.id) return null;

    const spouseId = generateId();
    const memberPos = member.position || { x: 0, y: 0 };
    const spousePos = { x: memberPos.x + (member.gender === 'male' ? 180 : -180), y: memberPos.y };

    try {
      await supabase.from('family_tree_members').insert({
        id: spouseId,
        owner_id: user.id,
        member_name: spouseData.name || '',
        gender: spouseData.gender,
        relation_type: `spouse_of_${memberId}`,
        is_placeholder: true,
      });

      await supabase.from('node_positions').insert({
        member_id: spouseId,
        owner_id: user.id,
        x: spousePos.x,
        y: spousePos.y,
        updated_by: CLIENT_ID,
      });

      setMembers((prev) => ({
        ...prev,
        [memberId]: { ...prev[memberId], spouseId },
        [spouseId]: { id: spouseId, name: spouseData.name || '', gender: spouseData.gender, spouseId: memberId, position: spousePos, childrenIds: [] },
      }));

      return spouseId;
    } catch (error) {
      console.error('Error adding spouse:', error);
      return null;
    }
  }, [user?.id, members]);

  // Add child
  const addChild = useCallback(async (parentId: string, childData: AddMemberData) => {
    const parent = members[parentId];
    if (!parent || !user?.id) return null;

    const childId = generateId();
    const parentPos = parent.position || { x: 0, y: 0 };
    const spousePos = parent.spouseId ? members[parent.spouseId]?.position : null;
    
    const centerX = spousePos ? (parentPos.x + spousePos.x) / 2 : parentPos.x;
    const siblingCount = parent.childrenIds?.length || 0;
    const childPos = { x: centerX + (siblingCount * 150), y: parentPos.y + 200 };

    const parentIds = parent.spouseId ? [parentId, parent.spouseId] : [parentId];

    try {
      await supabase.from('family_tree_members').insert({
        id: childId,
        owner_id: user.id,
        member_name: childData.name || '',
        gender: childData.gender,
        relation_type: `child_of_${parentId}_${siblingCount + 1}`,
        is_placeholder: true,
      });

      await supabase.from('node_positions').insert({
        member_id: childId,
        owner_id: user.id,
        x: childPos.x,
        y: childPos.y,
        updated_by: CLIENT_ID,
      });

      setMembers((prev) => {
        const updates: Record<string, FamilyMember> = {
          [childId]: { id: childId, name: childData.name || '', gender: childData.gender, parentIds, position: childPos, childrenIds: [] },
        };
        
        parentIds.forEach((pid) => {
          if (prev[pid]) {
            updates[pid] = { ...prev[pid], childrenIds: [...(prev[pid].childrenIds || []), childId] };
          }
        });

        return { ...prev, ...updates };
      });

      return childId;
    } catch (error) {
      console.error('Error adding child:', error);
      return null;
    }
  }, [user?.id, members]);

  // Create self node - for user's own profile on first visit
  const createSelfNode = useCallback(async (gender: 'male' | 'female') => {
    if (!user?.id) return null;

    // Check if self node already exists
    const existingMembers = Object.values(members);
    const selfExists = existingMembers.some(m => m.linkedUserId === user.id);
    if (selfExists) return null;

    // Fetch current profile data
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, username, avatar_url')
      .eq('id', user.id)
      .single();

    const selfId = generateId();
    const memberName = profile?.name || profile?.username || "Men";

    try {
      // Insert self member linked to user
      await supabase.from('family_tree_members').insert({
        id: selfId,
        owner_id: user.id,
        member_name: memberName,
        gender: gender,
        relation_type: 'self',
        is_placeholder: false,
        linked_user_id: user.id,
        avatar_url: profile?.avatar_url,
      });

      // Insert position at center
      await supabase.from('node_positions').insert({
        member_id: selfId,
        owner_id: user.id,
        x: 0,
        y: 0,
        updated_by: CLIENT_ID,
      });

      setMembers((prev) => ({
        ...prev,
        [selfId]: {
          id: selfId,
          name: memberName,
          gender: gender,
          photoUrl: profile?.avatar_url || undefined,
          position: { x: 0, y: 0 },
          childrenIds: [],
          linkedUserId: user.id,
        },
      }));

      setRootId(selfId);
      return selfId;
    } catch (error) {
      console.error('Error creating self node:', error);
      return null;
    }
  }, [user?.id, members]);

  return {
    members,
    rootId,
    isLoading,
    addInitialCouple,
    updateMember,
    updatePosition,
    addParents,
    addSpouse,
    addChild,
    removeMember,
    createSelfNode,
    reload: loadData,
  };
};
