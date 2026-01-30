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

interface FamilyTreeCanvasProps {
  members: Record<string, FamilyMember>;
  onOpenProfile: (member: FamilyMember) => void;
  onPositionChange?: (memberId: string, position: { x: number; y: number }) => void;
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
  onOpenProfile,
  onPositionChange,
}: FamilyTreeCanvasProps) => {
  const didFitViewRef = useRef(false);

  // Keep positions stable: only compute positions for NEW nodes
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Handle node position changes and sync to cloud
  const handleNodesChange = useCallback((changes: NodeChange<Node>[]) => {
    onNodesChange(changes);
    
    // Sync position changes to cloud
    changes.forEach((change) => {
      if (change.type === 'position' && change.position && change.dragging === false) {
        // Node was dropped - save position
        onPositionChange?.(change.id, change.position);
      }
    });
  }, [onNodesChange, onPositionChange]);

  // Compute edges from members
  const edgesMemo = useMemo(() => {
    const nextEdges: Edge[] = [];
    const processedCouples = new Set<string>();

    // Spouse/couple edges
    Object.values(members).forEach((member) => {
      if (!member.spouseId) return;
      const spouse = members[member.spouseId];
      if (!spouse) return;

      const coupleKey = [member.id, spouse.id].sort().join('-');
      if (processedCouples.has(coupleKey)) return;
      processedCouples.add(coupleKey);

      const [left, right] = member.gender === 'male' ? [member, spouse] : [spouse, member];

      nextEdges.push({
        id: `spouse-${left.id}-${right.id}`,
        source: left.id,
        target: right.id,
        sourceHandle: 'spouse-right',
        targetHandle: 'spouse-left',
        type: 'spouse',
      });
    });

    // Parent-child edges
    Object.values(members).forEach((member) => {
      if (!member.parentIds || member.parentIds.length === 0) return;

      const father = member.parentIds.find((pid) => members[pid]?.gender === 'male');
      const mother = member.parentIds.find((pid) => members[pid]?.gender === 'female');
      const parentId = father || member.parentIds[0];
      const spouseId = mother || (member.parentIds.length > 1 ? member.parentIds[1] : undefined);

      if (!parentId || !members[parentId]) return;

      nextEdges.push({
        id: `child-${parentId}-${member.id}`,
        source: parentId,
        target: member.id,
        type: 'child',
        data: { spouseId },
      });
    });

    return nextEdges;
  }, [members]);

  // Update edges when members change
  useEffect(() => {
    setEdges(edgesMemo);
  }, [edgesMemo, setEdges]);

  // Update nodes - use saved positions or compute for NEW nodes
  useEffect(() => {
    setNodes((prevNodes) => {
      const prevMap = new Map(prevNodes.map((n) => [n.id, n] as const));
      const nextNodes: Node[] = [];

      for (const member of Object.values(members)) {
        const existing = prevMap.get(member.id);
        
        // Priority: 1) existing node position, 2) saved member position, 3) computed position
        const position =
          existing?.position ??
          member.position ??
          computeNewMemberPosition({
            member,
            members,
            prevNodeMap: prevMap,
          });

        nextNodes.push({
          id: member.id,
          type: 'familyMember',
          position,
          data: {
            member,
            onOpenProfile,
          },
        });
      }

      return nextNodes;
    });
  }, [members, onOpenProfile, setNodes]);

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
