import { supabase } from '@/integrations/supabase/client';

interface MergeCandidate {
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  relationship: 'parent' | 'grandparent' | 'sibling';
}

interface ChildProfile {
  id: string;
  name: string;
  photoUrl?: string;
  gender: 'male' | 'female';
}

interface SuggestedChildPair {
  sourceChild: ChildProfile;
  targetChild: ChildProfile;
  similarity: number; // 0-100, higher = more similar
}

interface ChildMergeData {
  parentDescription: string;
  sourceChildren: ChildProfile[];
  targetChildren: ChildProfile[];
  suggestedPairs: SuggestedChildPair[];
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
 * Smart Tree Merging Algorithm
 * 
 * 1. Parents/Grandparents: Auto-merge silently based on gender + relationship position
 * 2. Siblings: Show smart suggestions based on name similarity + gender match
 */
export const useTreeMerging = () => {

  /**
   * Calculate name similarity (0-100)
   * Uses simple character matching for Uzbek names
   */
  const calculateNameSimilarity = (name1: string, name2: string): number => {
    if (!name1 || !name2) return 0;
    
    const n1 = name1.toLowerCase().trim();
    const n2 = name2.toLowerCase().trim();
    
    // Exact match
    if (n1 === n2) return 100;
    
    // Check if one contains the other
    if (n1.includes(n2) || n2.includes(n1)) return 80;
    
    // Check first 3 characters (common in names like "Ali", "Alisher")
    if (n1.length >= 3 && n2.length >= 3 && n1.substring(0, 3) === n2.substring(0, 3)) {
      return 60;
    }
    
    // Calculate Levenshtein-like similarity
    const maxLen = Math.max(n1.length, n2.length);
    if (maxLen === 0) return 100;
    
    let matches = 0;
    const minLen = Math.min(n1.length, n2.length);
    
    for (let i = 0; i < minLen; i++) {
      if (n1[i] === n2[i]) matches++;
    }
    
    return Math.round((matches / maxLen) * 100);
  };

  /**
   * Create smart suggestions for child pairings
   * Matches children by gender first, then by name similarity
   */
  const createSmartSuggestions = (
    sourceChildren: ChildProfile[],
    targetChildren: ChildProfile[]
  ): SuggestedChildPair[] => {
    const suggestions: SuggestedChildPair[] = [];
    const usedTargetIds = new Set<string>();

    // Sort source by name for consistent ordering
    const sortedSource = [...sourceChildren].sort((a, b) => 
      a.name.localeCompare(b.name)
    );

    for (const source of sortedSource) {
      // Find best matching target with same gender
      const availableTargets = targetChildren.filter(
        t => t.gender === source.gender && !usedTargetIds.has(t.id)
      );

      if (availableTargets.length === 0) continue;

      // Calculate similarity for each
      const scored = availableTargets.map(target => ({
        target,
        similarity: calculateNameSimilarity(source.name, target.name),
      }));

      // Sort by similarity (highest first)
      scored.sort((a, b) => b.similarity - a.similarity);

      // Use best match if similarity > 30%
      const best = scored[0];
      if (best && best.similarity > 30) {
        suggestions.push({
          sourceChild: source,
          targetChild: best.target,
          similarity: best.similarity,
        });
        usedTargetIds.add(best.target.id);
      }
    }

    return suggestions;
  };

  /**
   * Find merge candidates when invitation is accepted
   * Parents/grandparents are auto-merged, siblings need user confirmation
   */
  const findMergeCandidates = async (
    senderId: string,
    receiverId: string,
    linkedMemberId: string
  ): Promise<{
    autoMergeable: MergeCandidate[];
    childMergeData: ChildMergeData | null;
  }> => {
    const autoMergeable: MergeCandidate[] = [];
    let childMergeData: ChildMergeData | null = null;

    try {
      const [senderRes, receiverRes] = await Promise.all([
        supabase.from('family_tree_members').select('*').eq('owner_id', senderId).is('merged_into', null),
        supabase.from('family_tree_members').select('*').eq('owner_id', receiverId).is('merged_into', null)
      ]);

      // Filter out legacy merged_into_ relation types
      const senderMembers = ((senderRes.data || []) as TreeMember[]).filter(
        m => !m.relation_type.startsWith('merged_into_')
      );
      const receiverMembers = ((receiverRes.data || []) as TreeMember[]).filter(
        m => !m.relation_type.startsWith('merged_into_')
      );

      if (senderMembers.length === 0 || receiverMembers.length === 0) {
        return { autoMergeable, childMergeData };
      }

      const senderMap = new Map<string, TreeMember>();
      const receiverMap = new Map<string, TreeMember>();
      
      senderMembers.forEach(m => senderMap.set(m.id, m));
      receiverMembers.forEach(m => receiverMap.set(m.id, m));

      const linkedMember = senderMap.get(linkedMemberId);
      if (!linkedMember) return { autoMergeable, childMergeData };

      const receiverSelf = receiverMembers.find(m => m.linked_user_id === receiverId);
      if (!receiverSelf) return { autoMergeable, childMergeData };

      // Get parents
      const senderParents = findParents(linkedMember, senderMembers);
      const receiverParents = findParents(receiverSelf, receiverMembers);

      // Auto-merge parents by gender (no confirmation needed)
      for (const senderParent of senderParents) {
        const matchingReceiverParent = receiverParents.find(
          rp => rp.gender === senderParent.gender
        );

        if (matchingReceiverParent) {
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
          });

          // Auto-merge grandparents
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
              });
            }
          }

          // Collect siblings for user confirmation
          const senderSiblings = findChildren(senderParent, senderMembers)
            .filter(c => c.id !== linkedMemberId);
          
          const receiverSiblings = findChildren(matchingReceiverParent, receiverMembers)
            .filter(c => c.id !== receiverSelf.id);

          if (senderSiblings.length > 0 || receiverSiblings.length > 0) {
            const sourceChildren: ChildProfile[] = senderSiblings.map(c => ({
              id: c.id,
              name: c.member_name || 'Ism kiritilmagan',
              photoUrl: c.avatar_url || undefined,
              gender: (c.gender as 'male' | 'female') || 'male',
            }));

            const targetChildren: ChildProfile[] = receiverSiblings.map(c => ({
              id: c.id,
              name: c.member_name || 'Ism kiritilmagan',
              photoUrl: c.avatar_url || undefined,
              gender: (c.gender as 'male' | 'female') || 'male',
            }));

            // Create smart suggestions
            const suggestedPairs = createSmartSuggestions(sourceChildren, targetChildren);

            childMergeData = {
              parentDescription: `${senderParent.member_name || 'Ota-ona'} ning farzandlari`,
              sourceChildren,
              targetChildren,
              suggestedPairs,
            };
          }
        }
      }

      return { autoMergeable, childMergeData };
    } catch (error) {
      console.error('Error finding merge candidates:', error);
      return { autoMergeable, childMergeData };
    }
  };

  /**
   * Execute automatic merging for parents/grandparents (silent, no UI)
   * MUHIM: relation_type ni O'ZGARTIRMASLIK kerak - merged_into maydonidan foydalanamiz
   */
  const executeAutoMerge = async (
    candidates: MergeCandidate[]
  ): Promise<boolean> => {
    try {
      for (const candidate of candidates) {
        const [sourceRes, targetRes] = await Promise.all([
          supabase.from('family_tree_members').select('*').eq('id', candidate.sourceId).single(),
          supabase.from('family_tree_members').select('*').eq('id', candidate.targetId).single()
        ]);

        const source = sourceRes.data as TreeMember | null;
        const target = targetRes.data as TreeMember | null;

        if (!source || !target) continue;

        // Merge data - prefer linked user's data
        const mergedData: Record<string, unknown> = {};

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
            .eq('id', candidate.sourceId);
        }

        // Mark target as merged - use merged_into column instead of destroying relation_type!
        await supabase
          .from('family_tree_members')
          .update({ 
            merged_into: candidate.sourceId,
            updated_at: new Date().toISOString()
          })
          .eq('id', candidate.targetId);

        console.log(`Auto-merged: ${candidate.sourceName} ← ${candidate.targetName}`);
      }

      return true;
    } catch (error) {
      console.error('Error executing auto merge:', error);
      return false;
    }
  };

  /**
   * Merge two children (confirmed by user)
   * MUHIM: relation_type ni O'ZGARTIRMASLIK kerak - merged_into maydonidan foydalanamiz
   */
  const mergeChild = async (
    sourceChildId: string,
    targetChildId: string
  ): Promise<boolean> => {
    try {
      const [sourceRes, targetRes] = await Promise.all([
        supabase.from('family_tree_members').select('*').eq('id', sourceChildId).single(),
        supabase.from('family_tree_members').select('*').eq('id', targetChildId).single()
      ]);

      const source = sourceRes.data as TreeMember | null;
      const target = targetRes.data as TreeMember | null;

      if (!source || !target) return false;

      const mergedData: Record<string, unknown> = {};

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

      // Use merged_into column instead of destroying relation_type!
      await supabase
        .from('family_tree_members')
        .update({ 
          merged_into: sourceChildId,
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
    mergeChild,
    calculateNameSimilarity,
  };
};

// Helper: Find parents of a member
function findParents(member: TreeMember, allMembers: TreeMember[]): TreeMember[] {
  const parents: TreeMember[] = [];
  const relType = member.relation_type || '';

  const childMatch = relType.match(/child_of_([a-f0-9-]+)/);
  if (childMatch) {
    const parentId = childMatch[1];
    const parent = allMembers.find(m => m.id === parentId);
    if (parent) {
      parents.push(parent);
      const spouse = allMembers.find(
        m => m.relation_type === `spouse_of_${parentId}` || 
             parent.relation_type === `spouse_of_${m.id}`
      );
      if (spouse) parents.push(spouse);
    }
  }

  allMembers.forEach(m => {
    if (m.relation_type === `father_of_${member.id}` || 
        m.relation_type === `mother_of_${member.id}`) {
      if (!parents.find(p => p.id === m.id)) {
        parents.push(m);
      }
    }
  });

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

  if (relType.startsWith('father_of_') || relType.startsWith('mother_of_')) {
    const childId = relType.replace('father_of_', '').replace('mother_of_', '');
    const child = allMembers.find(m => m.id === childId);
    if (child) children.push(child);
  }

  allMembers.forEach(m => {
    const rt = m.relation_type || '';
    if (rt.includes(`child_of_${member.id}`)) {
      if (!children.find(c => c.id === m.id)) {
        children.push(m);
      }
    }
  });

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
