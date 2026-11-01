import { useEffect, useRef, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Maximize2 } from 'lucide-react';

export function ImageNodeView({ node, selected, updateAttributes }: NodeViewProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [dragging, setDragging] = useState(false);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const attrWidth = Number(node.attrs.width) || null;
  const attrHeight = Number(node.attrs.height) || null;

  useEffect(() => {
    if (!dragging) setSize(null);
  }, [attrWidth, attrHeight, dragging]);

  const startResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const image = imageRef.current;
    if (!image) return;
    const startX = event.clientX;
    const startWidth = image.getBoundingClientRect().width;
    const ratio = attrHeight && attrWidth ? attrHeight / attrWidth : image.naturalHeight / Math.max(1, image.naturalWidth);
    const max = image.parentElement?.parentElement?.clientWidth || 820;
    setDragging(true);
    setSize({ width: startWidth, height: startWidth * ratio });
    const move = (moveEvent: PointerEvent) => {
      const width = Math.max(90, Math.min(max, startWidth + moveEvent.clientX - startX));
      setSize({ width, height: width * ratio });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDragging(false);
      setSize((current) => {
        if (current) updateAttributes({ width: Math.round(current.width), height: Math.round(current.height) });
        return current;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const width = size?.width || attrWidth || undefined;
  const height = size?.height || attrHeight || undefined;

  return (
    <NodeViewWrapper className={`auren-image-node ${selected ? 'is-selected' : ''} ${dragging ? 'is-resizing' : ''}`} data-drag-handle>
      <div className="auren-image-frame" style={{ width: width ? `${Math.round(width)}px` : undefined }}>
        <img
          ref={imageRef}
          src={String(node.attrs.src || '')}
          alt={String(node.attrs.alt || '')}
          title={String(node.attrs.title || '')}
          style={{ width: width ? `${Math.round(width)}px` : undefined, height: height ? `${Math.round(height)}px` : undefined }}
          draggable={false}
        />
        <button
          type="button"
          className="auren-image-resize"
          onPointerDown={startResize}
          aria-label="Resize image"
          title="Drag to resize"
        >
          <Maximize2 size={11} />
        </button>
        {(selected || dragging) && (
          <span className="auren-image-size">{Math.round(width || 0)} × {Math.round(height || 0)}</span>
        )}
      </div>
    </NodeViewWrapper>
  );
}
