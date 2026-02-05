 import { useState, useCallback, useMemo } from 'react';
 import { FamilyMember } from '@/types/family';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 import { toast } from 'sonner';
 
 export interface MergeSuggestion {
   sourceId: string;
   targetId: string;
   sourceName: string;
   targetName: string;
   reason: string;
   gender: 'male' | 'female';
 }
 
 export interface MergedProfile {
   primaryId: string;
   mergedIds: string[];
   mergedNames: string[];
 }
 
 export const useMergeMode = (members: Record<string, FamilyMember>) => {
   const { user } = useAuth();
   const [isActive, setIsActive] = useState(false);
   const [selectedIds, setSelectedIds] = useState<string[]>([]);
   const [mergedProfiles, setMergedProfiles] = useState<Map<string, MergedProfile>>(new Map());
   const [isProcessing, setIsProcessing] = useState(false);
 
   // Start merge mode with first selected profile
   const startMergeMode = useCallback((memberId: string) => {
     setIsActive(true);
     setSelectedIds([memberId]);
   }, []);
 
   // Toggle selection of a profile
   const toggleSelection = useCallback((memberId: string) => {
     if (!isActive) return;
     
     const member = members[memberId];
     const firstMember = members[selectedIds[0]];
     
     // Gender validation
     if (firstMember && member && firstMember.gender !== member.gender) {
       toast.error("Faqat bir xil jinsdagi profillarni birlashtirish mumkin");
       return;
     }
     
     setSelectedIds(prev => {
       if (prev.includes(memberId)) {
         // Can't deselect the first one
         if (prev[0] === memberId) {
           cancelMerge();
           return [];
         }
         return prev.filter(id => id !== memberId);
       }
       return [...prev, memberId];
     });
   }, [isActive, members, selectedIds]);
 
   // Cancel merge mode
   const cancelMerge = useCallback(() => {
     setIsActive(false);
     setSelectedIds([]);
   }, []);
 
   // Execute merge - first selected becomes primary
   const executeMerge = useCallback(async () => {
     if (selectedIds.length < 2 || !user?.id) return;
     
     setIsProcessing(true);
     
     try {
       const primaryId = selectedIds[0];
       const mergedIds = selectedIds.slice(1);
       
       // Get primary member data
       const primary = members[primaryId];
       if (!primary) throw new Error('Primary member not found');
       
       // Collect merged names
       const mergedNames = mergedIds.map(id => members[id]?.name || 'Noma\'lum');
       
       // Mark other members as merged into primary
       for (const mergedId of mergedIds) {
         const merged = members[mergedId];
         if (!merged) continue;
         
         // Update relation_type to indicate merge
         await supabase
           .from('family_tree_members')
           .update({ 
             relation_type: `merged_into_${primaryId}`,
             updated_at: new Date().toISOString()
           })
           .eq('id', mergedId);
         
         // If merged has linked user but primary doesn't, transfer it
         if (merged.linkedUserId && !primary.linkedUserId) {
           await supabase
             .from('family_tree_members')
             .update({ 
               linked_user_id: merged.linkedUserId,
               is_placeholder: false 
             })
             .eq('id', primaryId);
         }
       }
       
       // Update local merged profiles map
       setMergedProfiles(prev => {
         const next = new Map(prev);
         const existing = next.get(primaryId);
         next.set(primaryId, {
           primaryId,
           mergedIds: existing ? [...existing.mergedIds, ...mergedIds] : mergedIds,
           mergedNames: existing ? [...existing.mergedNames, ...mergedNames] : mergedNames,
         });
         return next;
       });
       
       toast.success(`${mergedIds.length} ta profil birlashtirildi`);
       cancelMerge();
       
       // Trigger reload
       window.dispatchEvent(new CustomEvent('family-tree-reload'));
       
     } catch (error) {
       console.error('Error executing merge:', error);
       toast.error('Birlashtirishda xatolik');
     } finally {
       setIsProcessing(false);
     }
   }, [selectedIds, members, user?.id, cancelMerge]);
 
   // Generate smart suggestions based on merged profiles
   const suggestions = useMemo((): MergeSuggestion[] => {
     if (selectedIds.length < 2) return [];
     
     const suggestions: MergeSuggestion[] = [];
     const primaryId = selectedIds[0];
     const primary = members[primaryId];
     
     if (!primary) return [];
     
     // For each selected profile, find related profiles that might also need merging
     selectedIds.forEach(selectedId => {
       const selected = members[selectedId];
       if (!selected || selectedId === primaryId) return;
       
       // Check parents - if M and H are merging, their parents should merge too
       const primaryParents = primary.parentIds || [];
       const selectedParents = selected.parentIds || [];
       
       primaryParents.forEach(ppId => {
         const pp = members[ppId];
         if (!pp) return;
         
         selectedParents.forEach(spId => {
           const sp = members[spId];
           if (!sp) return;
           
           // Same gender parents should be suggested for merge
           if (pp.gender === sp.gender && ppId !== spId) {
             // Check if already suggested
             if (!suggestions.some(s => 
               (s.sourceId === ppId && s.targetId === spId) ||
               (s.sourceId === spId && s.targetId === ppId)
             )) {
               suggestions.push({
                 sourceId: ppId,
                 targetId: spId,
                 sourceName: pp.name || 'Noma\'lum',
                 targetName: sp.name || 'Noma\'lum',
                 reason: pp.gender === 'male' ? 'Otalar birlashtirish tavsiya' : 'Onalar birlashtirish tavsiya',
                 gender: pp.gender,
               });
             }
           }
         });
       });
       
       // Check grandparents
       primaryParents.forEach(ppId => {
         const pp = members[ppId];
         if (!pp) return;
         const ppParents = pp.parentIds || [];
         
         selectedParents.forEach(spId => {
           const sp = members[spId];
           if (!sp || pp.gender !== sp.gender) return;
           const spParents = sp.parentIds || [];
           
           ppParents.forEach(gppId => {
             const gpp = members[gppId];
             if (!gpp) return;
             
             spParents.forEach(gspId => {
               const gsp = members[gspId];
               if (!gsp) return;
               
               if (gpp.gender === gsp.gender && gppId !== gspId) {
                 if (!suggestions.some(s => 
                   (s.sourceId === gppId && s.targetId === gspId) ||
                   (s.sourceId === gspId && s.targetId === gppId)
                 )) {
                   suggestions.push({
                     sourceId: gppId,
                     targetId: gspId,
                     sourceName: gpp.name || 'Noma\'lum',
                     targetName: gsp.name || 'Noma\'lum',
                     reason: gpp.gender === 'male' ? 'Bobolar birlashtirish tavsiya' : 'Buvilar birlashtirish tavsiya',
                     gender: gpp.gender,
                   });
                 }
               }
             });
           });
         });
       });
     });
     
     return suggestions;
   }, [selectedIds, members]);
 
   // Apply a suggestion
   const applySuggestion = useCallback((suggestion: MergeSuggestion) => {
     setSelectedIds(prev => {
       const newIds = [...prev];
       if (!newIds.includes(suggestion.sourceId)) {
         newIds.push(suggestion.sourceId);
       }
       if (!newIds.includes(suggestion.targetId)) {
         newIds.push(suggestion.targetId);
       }
       return newIds;
     });
   }, []);
 
   return {
     isActive,
     selectedIds,
     mergedProfiles,
     suggestions,
     isProcessing,
     startMergeMode,
     toggleSelection,
     cancelMerge,
     executeMerge,
     applySuggestion,
   };
 };