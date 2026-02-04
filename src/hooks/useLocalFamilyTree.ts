import { useState, useCallback, useEffect, useRef } from 'react';
import { FamilyMember, AddMemberData } from '@/types/family';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Unique client ID to prevent real-time feedback loops
const CLIENT_ID = crypto.randomUUID();
const generateId = () => crypto.randomUUID();

export const useLocalFamilyTree = () => {
  const { user, profile } = useAuth();
  const [members, setMembers] = useState<Record<string, FamilyMember>>({});
  const [rootId, setRootId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [networkId, setNetworkId] = useState<string | null>(null);
  
  // Prevent updates while dragging
  const isDraggingRef = useRef(false);
  const pendingUpdatesRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Get or create family network for current user
  const getOrCreateNetworkId = useCallback(async (): Promise<string | null> => {
    if (!user?.id) return null;
    
    // Check if user already has a network
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('family_network_id')
      .eq('id', user.id)
      .single();
    
    if (userProfile?.family_network_id) {
      return userProfile.family_network_id;
    }
    
    // Create new network
    const { data: newNetwork, error } = await supabase
      .from('family_networks')
      .insert({})
      .select('id')
      .single();
    
    if (error || !newNetwork) {
      console.error('Error creating network:', error);
      return null;
    }
    
    // Update user profile with network ID
    await supabase
      .from('profiles')
      .update({ family_network_id: newNetwork.id })
      .eq('id', user.id);
    
    return newNetwork.id;
  }, [user?.id]);

  // Load data based on family_network_id (to see merged trees)
  const loadData = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      // First, get user's network ID
      const userNetworkId = await getOrCreateNetworkId();
      setNetworkId(userNetworkId);
      
      if (!userNetworkId) {
        setIsLoading(false);
        return;
      }
      
      // Get all users in the same network
      const { data: networkUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('family_network_id', userNetworkId);
      
      const userIds = networkUsers?.map(u => u.id) || [user.id];
      
      // Load members from ALL users in the network
      const [membersRes, positionsRes] = await Promise.all([
        supabase.from('family_tree_members').select('*').in('owner_id', userIds),
        supabase.from('node_positions').select('*').eq('owner_id', user.id) // Positions are still per-user
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

      // Build members map - first pass: create all members (exclude merged ones)
      const membersMap: Record<string, FamilyMember> = {};
      const mergedMap = new Map<string, string>(); // targetId -> sourceId
      
      // First, identify merged members
      dbMembers.forEach((m: any) => {
        const relType = m.relation_type || '';
        const mergedMatch = relType.match(/merged_into_([a-f0-9-]+)/);
        if (mergedMatch) {
          mergedMap.set(m.id, mergedMatch[1]);
        }
      });
      
      // Create members, skipping merged ones
      dbMembers.forEach((m: any) => {
        // Skip members that are merged into another
        if (mergedMap.has(m.id)) return;
        
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

      // Helper to resolve merged IDs to their source
      const resolveId = (id: string): string => {
        return mergedMap.get(id) || id;
      };

      // Second pass: establish ALL relationships from relation_type
      dbMembers.forEach((m: any) => {
        // Skip merged members
        if (mergedMap.has(m.id)) return;
        
        const relType = (m.relation_type || '').split('|')[0];
        
        // Handle spouse relationships (bidirectional)
        if (relType.startsWith('spouse_of_')) {
          const rawPartnerId = relType.replace('spouse_of_', '');
          const partnerId = resolveId(rawPartnerId);
          if (membersMap[partnerId] && membersMap[m.id]) {
            membersMap[m.id].spouseId = partnerId;
            membersMap[partnerId].spouseId = m.id;
          }
        }
        
        // Handle father_of_ relationships
        if (relType.startsWith('father_of_')) {
          const rawChildId = relType.replace('father_of_', '');
          const childId = resolveId(rawChildId);
          if (membersMap[childId] && membersMap[m.id]) {
            if (!membersMap[childId].parentIds) membersMap[childId].parentIds = [];
            if (!membersMap[childId].parentIds.includes(m.id)) {
              membersMap[childId].parentIds.push(m.id);
            }
            if (!membersMap[m.id].childrenIds) membersMap[m.id].childrenIds = [];
            if (!membersMap[m.id].childrenIds.includes(childId)) {
              membersMap[m.id].childrenIds.push(childId);
            }
          }
        }
        
        // Handle mother_of_ relationships
        if (relType.startsWith('mother_of_')) {
          const rawChildId = relType.replace('mother_of_', '');
          const childId = resolveId(rawChildId);
          if (membersMap[childId] && membersMap[m.id]) {
            if (!membersMap[childId].parentIds) membersMap[childId].parentIds = [];
            if (!membersMap[childId].parentIds.includes(m.id)) {
              membersMap[childId].parentIds.push(m.id);
            }
            if (!membersMap[m.id].childrenIds) membersMap[m.id].childrenIds = [];
            if (!membersMap[m.id].childrenIds.includes(childId)) {
              membersMap[m.id].childrenIds.push(childId);
            }
          }
        }
        
        // Handle child_of_ relationships
        if (relType.startsWith('child_of_')) {
          const match = relType.match(/child_of_([a-f0-9-]+)/);
          if (match) {
            const rawParentId = match[1];
            const parentId = resolveId(rawParentId);
            if (membersMap[parentId] && membersMap[m.id]) {
              if (!membersMap[m.id].parentIds) membersMap[m.id].parentIds = [];
              if (!membersMap[m.id].parentIds.includes(parentId)) {
                membersMap[m.id].parentIds.push(parentId);
              }
              if (!membersMap[parentId].childrenIds) membersMap[parentId].childrenIds = [];
              if (!membersMap[parentId].childrenIds.includes(m.id)) {
                membersMap[parentId].childrenIds.push(m.id);
              }
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
      
      // Third pass: infer spouse relationships from shared children
      Object.values(membersMap).forEach((member) => {
        if (member.childrenIds && member.childrenIds.length > 0) {
          member.childrenIds.forEach((childId) => {
            const child = membersMap[childId];
            if (child && child.parentIds && child.parentIds.length >= 2) {
              const otherParentId = child.parentIds.find(pid => pid !== member.id);
              if (otherParentId && membersMap[otherParentId]) {
                const otherParent = membersMap[otherParentId];
                if (member.gender !== otherParent.gender && !member.spouseId) {
                  membersMap[member.id].spouseId = otherParentId;
                  membersMap[otherParentId].spouseId = member.id;
                }
              }
            }
          });
        }
      });
      
      // Fourth pass: link spouse's children
      Object.values(membersMap).forEach((member) => {
        if (member.spouseId && membersMap[member.spouseId]) {
          const spouse = membersMap[member.spouseId];
          const allChildren = new Set([...(member.childrenIds || []), ...(spouse.childrenIds || [])]);
          const childrenArray = Array.from(allChildren);
          membersMap[member.id].childrenIds = childrenArray;
          membersMap[spouse.id].childrenIds = childrenArray;
          
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

      // Create positions for members without saved positions (in user's view)
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
      const selfMember = dbMembers.find((m: any) => m.linked_user_id === user.id);
      setRootId(selfMember?.id || dbMembers[0]?.id || null);

    } catch (error) {
      console.error('Error loading family tree:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, getOrCreateNetworkId]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time subscriptions
  useEffect(() => {
    if (!user?.id || !networkId) return;

    const channel = supabase
      .channel('family_tree_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'family_tree_members' },
        (payload) => {
          // Reload on any member change in network (will filter by network in loadData)
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'node_positions', filter: `owner_id=eq.${user.id}` },
        (payload) => {
          if (isDraggingRef.current) {
            const p = payload.new as any;
            if (p) pendingUpdatesRef.current.set(p.member_id, { x: p.x, y: p.y });
            return;
          }
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const p = payload.new as any;
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
  }, [user?.id, networkId, loadData]);

  // Update position
  const updatePosition = useCallback(async (memberId: string, position: { x: number; y: number }) => {
    if (!user?.id) return;
    
    isDraggingRef.current = false;

    pendingUpdatesRef.current.forEach((pos, id) => {
      if (id !== memberId) {
        setMembers((prev) => {
          if (!prev[id]) return prev;
          return { ...prev, [id]: { ...prev[id], position: pos } };
        });
      }
    });
    pendingUpdatesRef.current.clear();

    setMembers((prev) => {
      if (!prev[memberId]) return prev;
      return { ...prev, [memberId]: { ...prev[memberId], position } };
    });

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
      await supabase.from('family_tree_members').insert([
        { id: husbandId, owner_id: user.id, member_name: '', gender: 'male', relation_type: 'self', is_placeholder: true },
        { id: wifeId, owner_id: user.id, member_name: '', gender: 'female', relation_type: `spouse_of_${husbandId}`, is_placeholder: true },
      ]);

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
      // Update any member the user owns or is linked to
      await supabase
        .from('family_tree_members')
        .update(dbUpdates)
        .eq('id', id)
        .or(`owner_id.eq.${user.id},linked_user_id.eq.${user.id}`);
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

  // Create self node
  const createSelfNode = useCallback(async (gender: 'male' | 'female') => {
    if (!user?.id) return null;

    const existingMembers = Object.values(members);
    const selfExists = existingMembers.some(m => m.linkedUserId === user.id);
    if (selfExists) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, username, avatar_url')
      .eq('id', user.id)
      .single();

    const selfId = generateId();
    const memberName = profile?.name || profile?.username || "Men";

    try {
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
    networkId,
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
