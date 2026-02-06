import { supabase } from '@/integrations/supabase/client';

interface MergeCandidate {
  sourceId: string; // ID in sender's tree (will be kept)
  targetId: string; // ID in receiver's tree (will be marked as merged)
  sourceName: string;
  targetName: string;
  relationship: 'parent' | 'grandparent' | 'sibling';
  autoMerge: boolean;
}

interface ChildProfile {
  id: string;
  name: string;
  photoUrl?: string;
  gender: 'male' | 'female';
}

interface ChildMergeCandidate {
  sourceChildren: ChildProfile[];
  targetChildren: ChildProfile[];
  parentDescription: string;
}

interface TreeMember {
  id: string;
  owner_id: string;
  member_name: string;
  gender: string | null;
  relation_type: string;
  linked_user_id: string | null;
  avatar_url: string | null;
  created_at: string;
}

/**
 * Tree Merging Algorithm
 * 
 * When a user accepts an invitation:
 * 1. They get linked to a placeholder in sender's tree
 * 2. Both users are added to the same family_network_id
 * 3. Parents/grandparents are identified as same person based on relationship
 * 4. The earlier created profile is kept, the other is marked for reference
 */
export const useTreeMerging = () => {

  /**
   * Find merge candidates when invitation is accepted
   * Compares sender's tree with receiver's tree to find duplicates
   */
  const findMergeCandidates = async (
    senderId: string,
    receiverId: string,
    linkedMemberId: string
  ): Promise<{
    autoMergeable: MergeCandidate[];
    childrenToMerge: ChildMergeCandidate[];
  }> => {
    const autoMergeable: MergeCandidate[] = [];
    const childrenToMerge: ChildMergeCandidate[] = [];

    try {
      // Get all members from both trees
      const [senderRes, receiverRes] = await Promise.all([
        supabase.from('family_tree_members').select('*').eq('owner_id', senderId),
        supabase.from('family_tree_members').select('*').eq('owner_id', receiverId)
      ]);

      const senderMembers = (senderRes.data || []) as TreeMember[];
      const receiverMembers = (receiverRes.data || []) as TreeMember[];

      if (senderMembers.length === 0 || receiverMembers.length === 0) {
        return { autoMergeable, childrenToMerge };
      }

      // Build maps for quick lookup
      const senderMap = new Map<string, TreeMember>();
      const receiverMap = new Map<string, TreeMember>();
      
      senderMembers.forEach(m => senderMap.set(m.id, m));
      receiverMembers.forEach(m => receiverMap.set(m.id, m));

      // Find the linked member in sender's tree (this is the receiver in sender's tree)
      const linkedMember = senderMap.get(linkedMemberId);
      if (!linkedMember) return { autoMergeable, childrenToMerge };

      // Find receiver's self node in their own tree
      const receiverSelf = receiverMembers.find(m => m.linked_user_id === receiverId);
      if (!receiverSelf) return { autoMergeable, childrenToMerge };

      // Get parents of linked member in sender's tree
      const senderParents = findParents(linkedMember, senderMembers);
      
      // Get parents of receiver's self in receiver's tree
      const receiverParents = findParents(receiverSelf, receiverMembers);

      // Match parents by gender - these are the same people
      for (const senderParent of senderParents) {
        const matchingReceiverParent = receiverParents.find(
          rp => rp.gender === senderParent.gender
        );

        if (matchingReceiverParent) {
          // Compare creation dates - keep the earlier one
          const senderDate = new Date(senderParent.created_at);
          const receiverDate = new Date(matchingReceiverParent.created_at);
          
          const sourceParent = senderDate <= receiverDate ? senderParent : matchingReceiverParent;
          const targetParent = senderDate <= receiverDate ? matchingReceiverParent : senderParent;

          autoMergeable.push({
            sourceId: sourceParent.id,
            targetId: targetParent.id,
            sourceName: sourceParent.member_name || 'Ism kiritilmagan',
            targetName: targetParent.member_name || 'Ism kiritilmagan',
            relationship: 'parent',
            autoMerge: true,
          });

          // Find grandparents (parents of parents)
          const senderGrandparents = findParents(senderParent, senderMembers);
          const receiverGrandparents = findParents(matchingReceiverParent, receiverMembers);

          for (const sgp of senderGrandparents) {
            const matchingRgp = receiverGrandparents.find(rgp => rgp.gender === sgp.gender);
            
            if (matchingRgp) {
              const sDate = new Date(sgp.created_at);
              const rDate = new Date(matchingRgp.created_at);
              
              autoMergeable.push({
                sourceId: sDate <= rDate ? sgp.id : matchingRgp.id,
                targetId: sDate <= rDate ? matchingRgp.id : sgp.id,
                sourceName: sgp.member_name || 'Ism kiritilmagan',
                targetName: matchingRgp.member_name || 'Ism kiritilmagan',
                relationship: 'grandparent',
                autoMerge: true,
              });
            }
          }

          // Find siblings (other children of the same parents)
          const senderSiblings = findChildren(senderParent, senderMembers)
            .filter(c => c.id !== linkedMemberId);
          
          const receiverSiblings = findChildren(matchingReceiverParent, receiverMembers)
            .filter(c => c.id !== receiverSelf.id);

          if (senderSiblings.length > 0 || receiverSiblings.length > 0) {
            childrenToMerge.push({
              parentDescription: `${senderParent.gender === 'male' ? 'Otaning' : 'Onaning'} boshqa farzandlari`,
              sourceChildren: senderSiblings.map(c => ({ 
                id: c.id, 
                name: c.member_name || 'Ism kiritilmagan',
                photoUrl: c.avatar_url || undefined,
                gender: (c.gender as 'male' | 'female') || 'male',
              })),
              targetChildren: receiverSiblings.map(c => ({ 
                id: c.id, 
                name: c.member_name || 'Ism kiritilmagan',
                photoUrl: c.avatar_url || undefined,
                gender: (c.gender as 'male' | 'female') || 'male',
              })),
            });
          }
        }
      }

      return { autoMergeable, childrenToMerge };
    } catch (error) {
      console.error('Error finding merge candidates:', error);
      return { autoMergeable, childrenToMerge };
    }
  };

  /**
   * Execute automatic merging for parents/grandparents
   * Marks the target member as merged and updates references
   */
  const executeAutoMerge = async (
    senderId: string,
    receiverId: string,
    candidates: MergeCandidate[]
  ): Promise<boolean> => {
    try {
      for (const candidate of candidates) {
        if (!candidate.autoMerge) continue;

        // Get both members' data
        const [sourceRes, targetRes] = await Promise.all([
          supabase.from('family_tree_members').select('*').eq('id', candidate.sourceId).single(),
          supabase.from('family_tree_members').select('*').eq('id', candidate.targetId).single()
        ]);

        const source = sourceRes.data as TreeMember | null;
        const target = targetRes.data as TreeMember | null;

        if (!source || !target) continue;

        // Merge data - prefer linked user's data, then source (earlier created)
        const mergedData: Record<string, any> = {};

        // If target has a linked user but source doesn't, add it
        if (target.linked_user_id && !source.linked_user_id) {
          mergedData.linked_user_id = target.linked_user_id;
          mergedData.is_placeholder = false;
        }

        // If target has better name/photo
        if (!source.member_name && target.member_name) {
          mergedData.member_name = target.member_name;
        }
        if (!source.avatar_url && target.avatar_url) {
          mergedData.avatar_url = target.avatar_url;
        }

        // Update source with merged data
        if (Object.keys(mergedData).length > 0) {
          await supabase
            .from('family_tree_members')
            .update({ ...mergedData, updated_at: new Date().toISOString() })
            .eq('id', candidate.sourceId);
        }

        // Update target's relation_type to indicate it's merged into source
        await supabase
          .from('family_tree_members')
          .update({ 
            relation_type: `merged_into_${candidate.sourceId}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', candidate.targetId);

        console.log(`Merged: ${candidate.sourceName} (kept) <- ${candidate.targetName} (merged)`);
      }

      return true;
    } catch (error) {
      console.error('Error executing auto merge:', error);
      return false;
    }
  };

  /**
   * Manually merge two children (user confirms they are the same person)
   */
  const mergeChildren = async (
    sourceChildId: string,
    targetChildId: string,
    senderId: string,
    receiverId: string
  ): Promise<boolean> => {
    try {
      const [sourceRes, targetRes] = await Promise.all([
        supabase.from('family_tree_members').select('*').eq('id', sourceChildId).single(),
        supabase.from('family_tree_members').select('*').eq('id', targetChildId).single()
      ]);

      const source = sourceRes.data as TreeMember | null;
      const target = targetRes.data as TreeMember | null;

      if (!source || !target) return false;

      // Merge data into source
      const mergedData: Record<string, any> = {};

      if (target.linked_user_id && !source.linked_user_id) {
        mergedData.linked_user_id = target.linked_user_id;
        mergedData.is_placeholder = false;
      }
      if (!source.member_name && target.member_name) {
        mergedData.member_name = target.member_name;
      }
      if (!source.avatar_url && target.avatar_url) {
        mergedData.avatar_url = target.avatar_url;
      }

      if (Object.keys(mergedData).length > 0) {
        await supabase
          .from('family_tree_members')
          .update({ ...mergedData, updated_at: new Date().toISOString() })
          .eq('id', sourceChildId);
      }

      // Mark target as merged
      await supabase
        .from('family_tree_members')
        .update({ 
          relation_type: `merged_into_${sourceChildId}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetChildId);

      return true;
    } catch (error) {
      console.error('Error merging children:', error);
      return false;
    }
  };

  return {
    findMergeCandidates,
    executeAutoMerge,
    mergeChildren,
  };
};

// Helper: Find parents of a member
function findParents(member: TreeMember, allMembers: TreeMember[]): TreeMember[] {
  const parents: TreeMember[] = [];
  const relType = member.relation_type || '';

  // If this member is a child_of_ someone
  const childMatch = relType.match(/child_of_([a-f0-9-]+)/);
  if (childMatch) {
    const parentId = childMatch[1];
    const parent = allMembers.find(m => m.id === parentId);
    if (parent) {
      parents.push(parent);
      
      // Also find spouse of that parent
      const spouse = allMembers.find(
        m => m.relation_type === `spouse_of_${parentId}` || 
             parent.relation_type === `spouse_of_${m.id}`
      );
      if (spouse) parents.push(spouse);
    }
  }

  // Check if anyone is father_of_ or mother_of_ this member
  allMembers.forEach(m => {
    if (m.relation_type === `father_of_${member.id}` || 
        m.relation_type === `mother_of_${member.id}`) {
      if (!parents.find(p => p.id === m.id)) {
        parents.push(m);
      }
    }
  });

  // Handle self relation - look for members that are parents of self
  if (relType === 'self') {
    allMembers.forEach(m => {
      const rt = m.relation_type || '';
      if (rt.startsWith('father_of_') || rt.startsWith('mother_of_')) {
        const childId = rt.replace('father_of_', '').replace('mother_of_', '');
        if (childId === member.id && !parents.find(p => p.id === m.id)) {
          parents.push(m);
        }
      }
    });
  }

  return parents;
}

// Helper: Find children of a member
function findChildren(member: TreeMember, allMembers: TreeMember[]): TreeMember[] {
  const children: TreeMember[] = [];
  const relType = member.relation_type || '';

  // Check if this member is father_of_ or mother_of_ someone
  if (relType.startsWith('father_of_') || relType.startsWith('mother_of_')) {
    const childId = relType.replace('father_of_', '').replace('mother_of_', '');
    const child = allMembers.find(m => m.id === childId);
    if (child) children.push(child);
  }

  // Check for members who are child_of_ this member
  allMembers.forEach(m => {
    const rt = m.relation_type || '';
    if (rt.includes(`child_of_${member.id}`)) {
      if (!children.find(c => c.id === m.id)) {
        children.push(m);
      }
    }
  });

  // Also check spouse's children
  const spouseMatch = relType.match(/spouse_of_([a-f0-9-]+)/);
  if (spouseMatch) {
    const spouseId = spouseMatch[1];
    allMembers.forEach(m => {
      const rt = m.relation_type || '';
      if (rt.includes(`child_of_${spouseId}`)) {
        if (!children.find(c => c.id === m.id)) {
          children.push(m);
        }
      }
    });
  }

  return children;
}
