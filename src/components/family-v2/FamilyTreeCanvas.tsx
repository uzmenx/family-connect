import { useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  NodeTypes,
  EdgeTypes,
  NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import FamilyMemberNode from './FamilyMemberNode';
import SpouseEdge from './SpouseEdge';
import ChildEdge from './ChildEdge';
import { FamilyMember } from '@/types/family';
import { computeNewMemberPosition } from './layout';
 import { MergedProfile } from '@/hooks/useMergeMode';

interface FamilyTreeCanvasProps {
  members: Record<string, FamilyMember>;
  positions: Record<string, { x: number; y: number }>;
  onOpenProfile: (member: FamilyMember) => void;
  onPositionChange: (memberId: string, x: number, y: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
   // Merge mode props
   isMergeMode?: boolean;
   mergeSelectedIds?: string[];
   mergedProfiles?: Map<string, MergedProfile>;
   onLongPress?: (memberId: string) => void;
   onToggleMergeSelect?: (memberId: string) => void;
}

const nodeTypes: NodeTypes = {
  familyMember: FamilyMemberNode as any,
};

const edgeTypes: EdgeTypes = {
  spouse: SpouseEdge as any,
  child: ChildEdge as any,
};

export const FamilyTreeCanvas = ({
  members,
  positions,
  onOpenProfile,
  onPositionChange,
  onDragStart,
  onDragEnd,
   isMergeMode = false,
   mergeSelectedIds = [],
   mergedProfiles = new Map(),
   onLongPress,
   onToggleMergeSelect,
}: FamilyTreeCanvasProps) => {
  const didFitViewRef = useRef(false);
  const isDraggingRef = useRef(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Handle node changes - only save position on drag end
  const handleNodesChange = useCallback((changes: NodeChange<Node>[]) => {
    onNodesChange(changes);
    
    changes.forEach((change) => {
      if (change.type === 'position') {
        if (change.dragging && !isDraggingRef.current) {
          isDraggingRef.current = true;
          onDragStart?.();
        }
        if (!change.dragging && isDraggingRef.current && change.position) {
          isDraggingRef.current = false;
          onPositionChange(change.id, change.position.x, change.position.y);
          onDragEnd?.();
        }
      }
    });
  }, [onNodesChange, onPositionChange, onDragStart, onDragEnd]);

  // Build edges from relationships
  const edgesMemo = useMemo(() => {
    const nextEdges: Edge[] = [];
    const processedCouples = new Set<string>();

    Object.values(members).forEach((member) => {
      // Spouse edges
      if (member.spouseId && members[member.spouseId]) {
        const coupleKey = [member.id, member.spouseId].sort().join('-');
        if (!processedCouples.has(coupleKey)) {
          processedCouples.add(coupleKey);
          const spouse = members[member.spouseId];
          const [left, right] = member.gender === 'male' ? [member, spouse] : [spouse, member];

          nextEdges.push({
            id: `spouse-${left.id}-${right.id}`,
            source: left.id,
            target: right.id,
            type: 'spouse',
          });
        }
      }

      // Child edges
      if (member.parentIds?.length) {
        const father = member.parentIds.find((pid) => members[pid]?.gender === 'male');
        const mother = member.parentIds.find((pid) => members[pid]?.gender === 'female');
        const parentId = father || member.parentIds[0];
        const spouseId = mother || (member.parentIds.length > 1 ? member.parentIds[1] : undefined);

        if (parentId && members[parentId]) {
          nextEdges.push({
            id: `child-${parentId}-${member.id}`,
            source: parentId,
            target: member.id,
            type: 'child',
            data: { spouseId },
          });
        }
      }
    });

    return nextEdges;
  }, [members]);

  // Update edges when members change
  useEffect(() => {
    setEdges(edgesMemo);
  }, [edgesMemo, setEdges]);

  // Update nodes - use cloud positions, fallback to computed
  useEffect(() => {
    setNodes((prevNodes) => {
      const prevMap = new Map(prevNodes.map((n) => [n.id, n] as const));
      const nextNodes: Node[] = [];

      for (const member of Object.values(members)) {
        const existing = prevMap.get(member.id);
        
        // Priority: 1) existing dragged position, 2) cloud position, 3) computed
        const position =
          (isDraggingRef.current && existing?.position) ||
          positions[member.id] ||
          existing?.position ||
          computeNewMemberPosition({ member, members, prevNodeMap: prevMap });

       // Get merged names for this member
       const mergedProfile = mergedProfiles.get(member.id);
       const mergedNames = mergedProfile?.mergedNames || [];
 
        nextNodes.push({
          id: member.id,
          type: 'familyMember',
          position,
         data: { 
           member, 
           onOpenProfile,
           isMergeMode,
           isSelected: mergeSelectedIds.includes(member.id),
           isPrimary: mergeSelectedIds[0] === member.id,
           mergedNames,
           onLongPress,
           onToggleSelect: onToggleMergeSelect,
         },
        });
      }

      return nextNodes;
    });
 }, [members, positions, onOpenProfile, setNodes, isMergeMode, mergeSelectedIds, mergedProfiles, onLongPress, onToggleMergeSelect]);

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-border bg-card/50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView={false}
        onInit={(instance) => {
          if (didFitViewRef.current) return;
          instance.fitView({ padding: 0.4 });
          didFitViewRef.current = true;
        }}
        minZoom={0.2}
        maxZoom={2}
        attributionPosition="bottom-left"
        className="bg-background"
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={24} 
          size={1.5}
          color="hsl(var(--muted-foreground) / 0.15)"
        />
        <Controls 
          showInteractive={false}
          className="!bg-card !border-border !rounded-xl !shadow-md"
        />
      </ReactFlow>
    </div>
  );
};
