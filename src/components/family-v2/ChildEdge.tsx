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
  
  // Node dimensions
  const nodeWidth = 80;
  const nodeHeight = 80;
  
  // Calculate source center (parent node)
  const sourceX = sourceNode.position.x + nodeWidth / 2;
  const sourceY = sourceNode.position.y + nodeHeight; // Bottom of parent avatar
  
  // Calculate target position (child node center top)
  const targetX = targetNode.position.x + nodeWidth / 2;
  const targetY = targetNode.position.y - 5; // Top of child (slightly above for handle)
  
  // Calculate start point - should be at the center of spouse line (where heart is)
  let startX = sourceX;
  let startY = sourceY + 5;
  
  if (spouseNode) {
    const spouseX = spouseNode.position.x + nodeWidth / 2;
    
    // Get the right edge of source (where spouse line starts)
    const sourceRightX = sourceNode.position.x + nodeWidth;
    const sourceRightY = sourceNode.position.y + nodeHeight / 2;
    
    // Get the left edge of spouse (where spouse line ends)
    const spouseLeftX = spouseNode.position.x;
    const spouseLeftY = spouseNode.position.y + nodeHeight / 2;
    
    // Start from below the heart (so line goes behind heart)
    startX = (sourceRightX + spouseLeftX) / 2;
    startY = ((sourceRightY + spouseLeftY) / 2) + 16; // Start below heart center
  }
  
  // Calculate intermediate point (below couple center)
  const midY = startY + 35;

  // Create smooth flowing path with bezier curves
  const path = `
    M ${startX} ${startY}
    L ${startX} ${midY}
    C ${startX} ${midY + 40}, 
      ${targetX} ${(midY + targetY) / 2}, 
      ${targetX} ${targetY}
  `;

  // Generate animated dots along the path
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

      {/* Start point glow dot */}
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
    </g>
  );
};
