import type { PageSettings, PageSizeName } from '../../shared/types';
import { DEFAULT_PAGE_SETTINGS, PAGE_SIZES, pageDimensionsMm } from '../../shared/types';

export const MM_TO_PX = 96 / 25.4;

export function createPageSettings(size: PageSizeName = 'A4', patch: Partial<PageSettings> = {}): PageSettings {
  const base = { ...DEFAULT_PAGE_SETTINGS, ...patch, size };
  if (size !== 'Custom' && PAGE_SIZES[size]) {
    base.widthMm = PAGE_SIZES[size].width;
    base.heightMm = PAGE_SIZES[size].height;
  }
  return normalizePageSettings(base);
}

export function normalizePageSettings(page: PageSettings): PageSettings {
  const next = { ...DEFAULT_PAGE_SETTINGS, ...page };
  next.size = (['A4', 'A3', 'Letter', 'Legal', 'Custom'] as PageSizeName[]).includes(next.size) ? next.size : 'A4';
  if (next.size !== 'Custom' && PAGE_SIZES[next.size]) {
    next.widthMm = PAGE_SIZES[next.size].width;
    next.heightMm = PAGE_SIZES[next.size].height;
  }
  next.marginTop = clamp(next.marginTop, 0, 90);
  next.marginRight = clamp(next.marginRight, 0, 90);
  next.marginBottom = clamp(next.marginBottom, 0, 90);
  next.marginLeft = clamp(next.marginLeft, 0, 90);
  next.columns = clamp(Math.round(next.columns || 1), 1, 3);
  return next;
}

export function pagePx(page: PageSettings): { width: number; height: number; marginTop: number; marginRight: number; marginBottom: number; marginLeft: number } {
  const dims = pageDimensionsMm(page);
  return {
    width: dims.width * MM_TO_PX,
    height: dims.height * MM_TO_PX,
    marginTop: page.marginTop * MM_TO_PX,
    marginRight: page.marginRight * MM_TO_PX,
    marginBottom: page.marginBottom * MM_TO_PX,
    marginLeft: page.marginLeft * MM_TO_PX
  };
}

export function renderPageTokens(template: string, values: { page: number; total: number; title: string }): string {
  return (template || '')
    .replace(/\{\{\s*page\s*\}\}/gi, String(values.page))
    .replace(/\{\{\s*total\s*\}\}/gi, String(values.total))
    .replace(/\{\{\s*title\s*\}\}/gi, values.title);
}

function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
}
