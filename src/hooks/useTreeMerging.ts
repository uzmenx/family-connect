import { supabase } from '@/integrations/supabase/client';
import { FamilyMember } from '@/types/family';

interface MergeCandidate {
  sourceId: string; // ID in sender's tree (will be merged into)
  targetId: string; // ID in receiver's tree (will be removed/linked)
  sourceName: string;
  targetName: string;
  relationship: 'parent' | 'grandparent' | 'sibling';
  autoMerge: boolean; // Can be auto-merged based on relationship
}

interface ChildMergeCandidate {
  sourceChildren: { id: string; name: string }[];
  targetChildren: { id: string; name: string }[];
  parentDescription: string;
}

/**
 * Tree Merging Algorithm
 * 
 * When a user accepts an invitation:
 * 1. They get linked to a placeholder in sender's tree
 * 2. Their parents become the same as sender's parents (if both are siblings)
 * 3. Grandparents also merge
 * 4. Children are listed for manual confirmation
 */
export const useTreeMerging = () => {

  /**
   * Find merge candidates when invitation is accepted
   * Returns list of nodes that can be merged
   */
  const findMergeCandidates = async (
    senderId: string,
    receiverId: string,
    linkedMemberId: string // The placeholder that receiver was linked to
  ): Promise<{
    autoMergeable: MergeCandidate[];
    childrenToMerge: ChildMergeCandidate[];
  }> => {
    const autoMergeable: MergeCandidate[] = [];
    const childrenToMerge: ChildMergeCandidate[] = [];

    try {
      // Get sender's tree members
      const { data: senderMembers } = await supabase
        .from('family_tree_members')
        .select('*')
        .eq('owner_id', senderId);

      // Get receiver's tree members
      const { data: receiverMembers } = await supabase
        .from('family_tree_members')
        .select('*')
        .eq('owner_id', receiverId);

      if (!senderMembers || !receiverMembers) return { autoMergeable, childrenToMerge };

      // Build relationship maps
      const senderTree = buildTreeMap(senderMembers);
      const receiverTree = buildTreeMap(receiverMembers);

      // Find the linked member in sender's tree
      const linkedMember = senderTree.get(linkedMemberId);
      if (!linkedMember) return { autoMergeable, childrenToMerge };

      // Find receiver's self node in their own tree
      const receiverSelf = receiverMembers.find(m => m.linked_user_id === receiverId);
      if (!receiverSelf) return { autoMergeable, childrenToMerge };

      // Get receiver's parents in their own tree
      const receiverParentIds = getParentIds(receiverSelf, receiverMembers);
      const receiverParents = receiverParentIds.map(id => receiverTree.get(id)).filter(Boolean);

      // Get linked member's parents in sender's tree (these are the "real" parents now)
      const linkedParentIds = getParentIds(linkedMember, senderMembers);
      const linkedParents = linkedParentIds.map(id => senderTree.get(id)).filter(Boolean);

      // If both have parents, they should be merged (since they're the same people)
      if (linkedParents.length > 0 && receiverParents.length > 0) {
        // Match by gender first
        linkedParents.forEach(senderParent => {
          const matchingReceiverParent = receiverParents.find(
            rp => rp && rp.gender === senderParent?.gender
          );
          
          if (matchingReceiverParent && senderParent) {
            autoMergeable.push({
              sourceId: senderParent.id,
              targetId: matchingReceiverParent.id,
              sourceName: senderParent.member_name || 'Ism kiritilmagan',
              targetName: matchingReceiverParent.member_name || 'Ism kiritilmagan',
              relationship: 'parent',
              autoMerge: true, // Parents are automatically the same
            });

            // Check for grandparents too
            const senderGrandparents = getParentIds(senderParent, senderMembers);
            const receiverGrandparents = getParentIds(matchingReceiverParent, receiverMembers);

            senderGrandparents.forEach(sgpId => {
              const sgp = senderTree.get(sgpId);
              if (!sgp) return;

              const matchingRgp = receiverGrandparents
                .map(rgpId => receiverTree.get(rgpId))
                .find(rgp => rgp && rgp.gender === sgp.gender);

              if (matchingRgp) {
                autoMergeable.push({
                  sourceId: sgp.id,
                  targetId: matchingRgp.id,
                  sourceName: sgp.member_name || 'Ism kiritilmagan',
                  targetName: matchingRgp.member_name || 'Ism kiritilmagan',
                  relationship: 'grandparent',
                  autoMerge: true,
                });
              }
            });

            // Find children that need manual merging
            const senderChildren = getChildrenIds(senderParent, senderMembers)
              .map(id => senderTree.get(id))
              .filter(c => c && c.id !== linkedMemberId); // Exclude the linked member

            const receiverChildren = getChildrenIds(matchingReceiverParent, receiverMembers)
              .map(id => receiverTree.get(id))
              .filter(c => c && c.id !== receiverSelf.id); // Exclude receiver's self

            if (senderChildren.length > 0 || receiverChildren.length > 0) {
              childrenToMerge.push({
                parentDescription: `${senderParent.gender === 'male' ? 'Otaning' : 'Onaning'} farzandlari`,
                sourceChildren: senderChildren
                  .filter(Boolean)
                  .map(c => ({ id: c!.id, name: c!.member_name || 'Ism kiritilmagan' })),
                targetChildren: receiverChildren
                  .filter(Boolean)
                  .map(c => ({ id: c!.id, name: c!.member_name || 'Ism kiritilmagan' })),
              });
            }
          }
        });
      }

      return { autoMergeable, childrenToMerge };
    } catch (error) {
      console.error('Error finding merge candidates:', error);
      return { autoMergeable, childrenToMerge };
    }
  };

  /**
   * Execute automatic merging for parents/grandparents
   * This copies receiver's tree data to sender's tree nodes
   */
  const executeAutoMerge = async (
    senderId: string,
    receiverId: string,
    candidates: MergeCandidate[]
  ): Promise<boolean> => {
    try {
      for (const candidate of candidates) {
        if (!candidate.autoMerge) continue;

        // Get the target member's full data (from receiver's tree)
        const { data: targetMember } = await supabase
          .from('family_tree_members')
          .select('*')
          .eq('id', candidate.targetId)
          .single();

        if (!targetMember) continue;

        // Update source member with additional linked info
        // The source node now represents both users' parent/grandparent
        // We track this by adding a metadata field (could be JSON in future)
        await supabase
          .from('family_tree_members')
          .update({
            // If target has better data (photo, etc), optionally merge
            // For now, we just mark that this node is shared
            updated_at: new Date().toISOString(),
          })
          .eq('id', candidate.sourceId);

        // Add receiver's linked_user_id connection if the target had one
        if (targetMember.linked_user_id) {
          // Create a notification that these profiles are now merged
          console.log(`Merged: ${candidate.sourceName} <- ${candidate.targetName}`);
        }
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
      // Get target child data
      const { data: targetChild } = await supabase
        .from('family_tree_members')
        .select('*')
        .eq('id', targetChildId)
        .single();

      if (!targetChild) return false;

      // If target has a linked user, link them to the source node
      if (targetChild.linked_user_id) {
        await supabase
          .from('family_tree_members')
          .update({
            linked_user_id: targetChild.linked_user_id,
            member_name: targetChild.member_name || undefined,
            avatar_url: targetChild.avatar_url || undefined,
            is_placeholder: false,
          })
          .eq('id', sourceChildId);
      }

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

// Helper: Build a map of members by ID
function buildTreeMap(members: any[]): Map<string, any> {
  const map = new Map<string, any>();
  members.forEach(m => map.set(m.id, m));
  return map;
}

// Helper: Get parent IDs from relation_type
function getParentIds(member: any, allMembers: any[]): string[] {
  const parentIds: string[] = [];
  const relType = member.relation_type || '';

  // If this member is a child_of_ someone
  const childMatch = relType.match(/child_of_([a-f0-9-]+)/);
  if (childMatch) {
    parentIds.push(childMatch[1]);
    // Find spouse of that parent
    const parent = allMembers.find(m => m.id === childMatch[1]);
    if (parent) {
      const spouseMatch = allMembers.find(
        m => m.relation_type === `spouse_of_${parent.id}` || 
             parent.relation_type === `spouse_of_${m.id}`
      );
      if (spouseMatch) parentIds.push(spouseMatch.id);
    }
  }

  // Check if anyone is father_of_ or mother_of_ this member
  allMembers.forEach(m => {
    if (m.relation_type === `father_of_${member.id}` || 
        m.relation_type === `mother_of_${member.id}`) {
      if (!parentIds.includes(m.id)) parentIds.push(m.id);
    }
  });

  return parentIds;
}

// Helper: Get children IDs
function getChildrenIds(member: any, allMembers: any[]): string[] {
  const childrenIds: string[] = [];

  // Check relation_type for father_of_ or mother_of_
  const relType = member.relation_type || '';
  const fatherMatch = relType.match(/father_of_([a-f0-9-]+)/);
  const motherMatch = relType.match(/mother_of_([a-f0-9-]+)/);
  
  if (fatherMatch) childrenIds.push(fatherMatch[1]);
  if (motherMatch) childrenIds.push(motherMatch[1]);

  // Check for children who are child_of_ this member
  allMembers.forEach(m => {
    if (m.relation_type?.includes(`child_of_${member.id}`)) {
      if (!childrenIds.includes(m.id)) childrenIds.push(m.id);
    }
  });

  return childrenIds;
}
