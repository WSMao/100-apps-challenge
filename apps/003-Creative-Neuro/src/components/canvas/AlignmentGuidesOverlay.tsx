import React from 'react';
import { ViewportPortal } from '@xyflow/react';
import { useProjectStore } from '../../store/useProjectStore.ts';

export const AlignmentGuidesOverlay: React.FC = () => {
  const guides = useProjectStore((s) => s.alignmentGuides);

  if (!guides || guides.length === 0) return null;

  return (
    <ViewportPortal>
      <div
        className="pointer-events-none fixed inset-0 z-[999998]"
        data-testid="alignment-guides-overlay"
      >
        {guides.map((guide, idx) => {
          const isVertical = guide.orientation === 'vertical';
          const length = Math.max(1, guide.end - guide.start);
          return (
            <div
              key={`${guide.orientation}-${guide.position}-${idx}`}
              data-testid="alignment-guide-line"
              data-orientation={guide.orientation}
              data-kind={guide.kind}
              style={{
                position: 'absolute',
                left: isVertical ? `${guide.position}px` : `${guide.start}px`,
                top: isVertical ? `${guide.start}px` : `${guide.position}px`,
                width: isVertical ? '0px' : `${length}px`,
                height: isVertical ? `${length}px` : '0px',
                borderLeft: isVertical ? '1.5px dashed #f43f5e' : undefined,
                borderTop: !isVertical ? '1.5px dashed #f43f5e' : undefined,
                pointerEvents: 'none',
              }}
            />
          );
        })}
      </div>
    </ViewportPortal>
  );
};
