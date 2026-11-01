export type ShapeKind = 'rectangle' | 'ellipse' | 'line' | 'arrow';

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

export function createShapePng(shape: ShapeKind, color: string, width: number, height: number): string {
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(30, Math.round(width * scale));
  canvas.height = Math.max(20, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) return '';
  context.scale(scale, scale);
  const inset = 1.5;
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 2;

  if (shape === 'rectangle') {
    context.globalAlpha = 0.16;
    roundedRect(context, inset, inset, width - inset * 2, height - inset * 2, 9);
    context.fill();
    context.globalAlpha = 1;
    roundedRect(context, inset, inset, width - inset * 2, height - inset * 2, 9);
    context.stroke();
    context.globalAlpha = 0.5;
    context.fillStyle = color;
    context.fillRect(18, height - 20, Math.min(width - 36, 90), 2);
  } else if (shape === 'ellipse') {
    context.globalAlpha = 0.16;
    context.beginPath();
    context.ellipse(width / 2, height / 2, width / 2 - inset, height / 2 - inset, 0, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    context.stroke();
  } else {
    const y = height / 2;
    context.lineWidth = shape === 'arrow' ? 2.4 : 2;
    context.beginPath();
    context.moveTo(inset + 2, y);
    context.lineTo(width - inset - 2, y);
    context.stroke();
    if (shape === 'arrow') {
      const head = 12;
      context.beginPath();
      context.moveTo(width - inset - 2, y);
      context.lineTo(width - inset - head, y - head * 0.6);
      context.lineTo(width - inset - head, y + head * 0.6);
      context.closePath();
      context.fill();
    }
  }
  return canvas.toDataURL('image/png');
}
