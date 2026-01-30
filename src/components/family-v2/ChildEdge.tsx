import { EdgeProps, useStore } from '@xyflow/react';

interface ChildEdgeData {
  spouseId?: string;
}

export const ChildEdge = ({
  id,
  source,
  target,
  data,
}: EdgeProps) => {
  // Subscribe to node changes to get real-time positions
  const sourceNode = useStore((state) => state.nodeLookup.get(source));
  const targetNode = useStore((state) => state.nodeLookup.get(target));
  
  const edgeData = data as ChildEdgeData | undefined;
  const spouseId = edgeData?.spouseId;
  
  // Always call the hook, but only use the result if spouseId exists
  const spouseNode = useStore((state) => 
    spouseId ? state.nodeLookup.get(spouseId) : undefined
  );
  
  if (!sourceNode || !targetNode) return null;
  
  // Node dimensions (must match FamilyMemberNode avatar size)
  const nodeWidth = 80;
  const nodeHeight = 80;
  
  // Calculate target position (child node center top)
  const targetX = targetNode.position.x + nodeWidth / 2;
  const targetY = targetNode.position.y; // Top of child avatar
  
  // Calculate start point - from heart center between parents
  let startX: number;
  let startY: number;
  
  if (spouseNode) {
    // Get positions of both parents
    const sourceRightX = sourceNode.position.x + nodeWidth;
    const spouseLeftX = spouseNode.position.x;
    
    // Heart center is between the two parents
    startX = (sourceRightX + spouseLeftX) / 2;
    startY = Math.max(sourceNode.position.y, spouseNode.position.y) + nodeHeight / 2 + 14; // Below heart
  } else {
    // Single parent - start from bottom center
    startX = sourceNode.position.x + nodeWidth / 2;
    startY = sourceNode.position.y + nodeHeight; // Bottom of parent
  }

  // Calculate midpoint for smooth curve
  const midY = startY + 35;
  
  // Smooth S-curve path
  const path = `
    M ${startX} ${startY}
    L ${startX} ${midY}
    C ${startX} ${midY + 30}, 
      ${targetX} ${(midY + targetY) / 2 - 20}, 
      ${targetX} ${targetY}
  `;

  // Generate animated dots
  const dots = [];
  const numDots = 4;
  for (let i = 0; i < numDots; i++) {
    dots.push(
      <circle
        key={`dot-child-${id}-${i}`}
        r="2"
        fill="hsl(210, 70%, 60%)"
        opacity={0.9}
      >
        <animateMotion
          dur={`${2.5 + i * 0.4}s`}
          repeatCount="indefinite"
          begin={`${i * 0.5}s`}
        >
          <mpath href={`#child-path-${id}`} />
        </animateMotion>
      </circle>
    );
  }

  return (
    <g>
      {/* Glow filter and gradient definitions */}
      <defs>
        <filter id={`glow-child-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={`child-gradient-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(210, 80%, 70%)" />
          <stop offset="40%" stopColor="hsl(200, 75%, 55%)" />
          <stop offset="100%" stopColor="hsl(190, 70%, 50%)" />
        </linearGradient>
      </defs>

      {/* Hidden path for motion */}
      <path
        id={`child-path-${id}`}
        d={path}
        fill="none"
        stroke="none"
      />

      {/* Background glow */}
      <path
        d={path}
        fill="none"
        stroke="hsl(210, 60%, 55%)"
        strokeWidth={5}
        strokeOpacity={0.25}
        filter={`url(#glow-child-${id})`}
        strokeLinecap="round"
      />

      {/* Main gradient line */}
      <path
        id={id}
        d={path}
        fill="none"
        stroke={`url(#child-gradient-${id})`}
        strokeWidth={2}
        strokeLinecap="round"
      />

      {/* Animated particles */}
      {dots}

      {/* Start point glow dot (at heart center) */}
      <circle
        cx={startX}
        cy={startY}
        r="4"
        fill="hsl(210, 70%, 60%)"
        opacity={0.6}
      >
        <animate
          attributeName="r"
          values="3;5;3"
          dur="2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.4;0.8;0.4"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>

      {/* End point at child (connection dot) */}
      <circle
        cx={targetX}
        cy={targetY}
        r="4"
        fill="hsl(200, 70%, 55%)"
        opacity={0.7}
      >
        <animate
          attributeName="r"
          values="3;4.5;3"
          dur="1.8s"
          repeatCount="indefinite"
        />
      </circle>
    </g>
  );
};
