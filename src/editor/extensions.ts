import { Extension, Node, mergeAttributes } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import katex from 'katex';
import { ImageNodeView } from './ImageNodeView';

/* ------------------------------------------------------------------ font size */

export const FontSize = Extension.create({
  name: 'aurenFontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => attributes.fontSize ? { style: `font-size:${attributes.fontSize}` } : {}
          }
        }
      }
    ];
  }
});

/* ------------------------------------------------------------- paragraph style */

function styleValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function numberAttr(name: string, css: (value: number) => string) {
  return {
    default: null,
    parseHTML: (element: HTMLElement) => {
      const inline = element.style.getPropertyValue(name);
      if (inline) {
        const parsed = parseFloat(inline);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    },
    renderHTML: (attributes: Record<string, unknown>) => {
      const value = Number(attributes[name]);
      if (!Number.isFinite(value) || value === 0) return {};
      return { style: css(value) };
    }
  };
}

export const ParagraphStyle = Extension.create({
  name: 'aurenParagraphStyle',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'caption', 'callout'],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => {
              const value = parseFloat(element.style.lineHeight);
              return Number.isFinite(value) ? value : null;
            },
            renderHTML: (attributes) => attributes.lineHeight ? { style: `line-height:${attributes.lineHeight}` } : {}
          },
          marginTopPt: numberAttr('marginTopPt', (value) => `margin-top:${value}pt`),
          marginBottomPt: numberAttr('marginBottomPt', (value) => `margin-bottom:${value}pt`),
          indentLeftPt: numberAttr('indentLeftPt', (value) => `padding-left:${value}pt`),
          indentRightPt: numberAttr('indentRightPt', (value) => `padding-right:${value}pt`),
          textIndentPt: numberAttr('textIndentPt', (value) => `text-indent:${value}pt`),
          background: {
            default: null,
            parseHTML: (element) => element.style.backgroundColor || null,
            renderHTML: (attributes) => attributes.background ? { style: `background-color:${attributes.background}` } : {}
          }
        }
      }
    ];
  }
});

/* ------------------------------------------------------------------ page break */

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  parseHTML() {
    return [
      { tag: 'div[data-page-break="true"]' },
      { tag: 'div.auren-page-break' },
      { tag: 'hr[data-page-break="true"]' }
    ];
  },
  renderHTML() {
    return ['div', { 'data-page-break': 'true', class: 'auren-page-break' }, ['span', { class: 'auren-page-break-label', 'aria-hidden': 'true' }]];
  }
});

/* ------------------------------------------------------------------- footnote */

export const Footnote = Node.create({
  name: 'footnote',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      text: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-auren-footnote') || element.textContent || ''
      },
      label: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-label') || element.textContent || null
      },
      noteId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-footnote-id') || null
      }
    };
  },
  parseHTML() {
    return [{ tag: 'sup[data-auren-footnote]' }, { tag: 'span[data-auren-footnote]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const label = node.attrs.label || '1';
    return [
      'sup',
      mergeAttributes(HTMLAttributes, {
        'data-auren-footnote': node.attrs.text || '',
        'data-label': label,
        class: 'auren-footnote'
      }),
      String(label)
    ];
  }
});

/* ------------------------------------------------------------------- equation */

function renderMath(latex: string, display = false): HTMLElement {
  const span = document.createElement('span');
  span.className = display ? 'auren-math is-display' : 'auren-math';
  span.setAttribute('data-latex', latex);
  span.setAttribute('data-auren-math', latex);
  span.setAttribute('contenteditable', 'false');
  try {
    span.innerHTML = katex.renderToString(latex || '\\square', {
      throwOnError: false,
      output: 'mathml',
      displayMode: display
    });
  } catch {
    span.textContent = latex;
  }
  return span;
}

export const Equation = Node.create({
  name: 'equation',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-latex') || element.getAttribute('data-auren-math') || element.textContent || ''
      }
    };
  },
  parseHTML() {
    return [
      { tag: 'span[data-auren-math]' },
      { tag: 'span[data-latex]' },
      { tag: 'span.auren-math' }
    ];
  },
  renderHTML({ node }) {
    return renderMath(String(node.attrs.latex || ''));
  }
});

/* ---------------------------------------------------------------- callout box */

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      variant: {
        default: 'note',
        parseHTML: (element) => element.getAttribute('data-callout') || 'note'
      }
    };
  },
  parseHTML() {
    return [
      { tag: 'div[data-auren-textbox="true"]' },
      { tag: 'div[data-callout]' },
      { tag: 'aside[data-callout]' }
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    const variant = String(node.attrs.variant || 'note');
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-auren-textbox': 'true',
        'data-callout': variant,
        class: `auren-callout is-${variant}`
      }),
      0
    ];
  }
});

/* ---------------------------------------------------------------------- shape */

export const Shape = Node.create({
  name: 'shape',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      shape: { default: 'rectangle', parseHTML: (element) => element.getAttribute('data-shape') || 'rectangle' },
      color: { default: '#8b7cf6', parseHTML: (element) => element.getAttribute('data-shape-color') || '#8b7cf6' },
      width: { default: 420, parseHTML: (element) => Number(element.getAttribute('data-width')) || 420 },
      height: { default: 140, parseHTML: (element) => Number(element.getAttribute('data-height')) || 140 },
      pngDataUrl: { default: '', parseHTML: (element) => element.getAttribute('data-png') || element.querySelector('img')?.getAttribute('src') || '' },
      alt: { default: 'Decorative shape', parseHTML: (element) => element.getAttribute('data-alt') || 'Decorative shape' }
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-auren-shape]' }];
  },
  renderHTML({ node }) {
    const wrap = document.createElement('div');
    wrap.className = 'auren-shape';
    wrap.setAttribute('data-auren-shape', 'true');
    wrap.setAttribute('data-shape', String(node.attrs.shape || 'rectangle'));
    wrap.setAttribute('data-shape-color', String(node.attrs.color || '#8b7cf6'));
    wrap.setAttribute('data-width', String(node.attrs.width || 420));
    wrap.setAttribute('data-height', String(node.attrs.height || 140));
    wrap.setAttribute('data-alt', String(node.attrs.alt || 'Decorative shape'));
    wrap.setAttribute('contenteditable', 'false');
    if (node.attrs.pngDataUrl) {
      wrap.setAttribute('data-png', String(node.attrs.pngDataUrl));
      const img = document.createElement('img');
      img.src = String(node.attrs.pngDataUrl);
      img.alt = String(node.attrs.alt || 'Decorative shape');
      img.draggable = false;
      wrap.appendChild(img);
    }
    return wrap;
  }
});

/* ------------------------------------------------------------------------ TOC */

interface TocEntry { level: number; text: string; pos: number }

function readEntries(raw: unknown): TocEntry[] {
  if (Array.isArray(raw)) return raw as TocEntry[];
  try {
    const parsed = JSON.parse(String(raw || '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const TableOfContents = Node.create({
  name: 'tableOfContents',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      entries: {
        default: '[]',
        parseHTML: (element) => element.getAttribute('data-entries') || '[]'
      }
    };
  },
  parseHTML() {
    return [{ tag: 'nav[data-auren-toc]' }, { tag: 'div[data-auren-toc]' }];
  },
  renderHTML({ node }) {
    const nav = document.createElement('nav');
    nav.className = 'auren-toc';
    nav.setAttribute('data-auren-toc', 'true');
    nav.setAttribute('data-entries', String(node.attrs.entries || '[]'));
    nav.setAttribute('contenteditable', 'false');
    const title = document.createElement('div');
    title.className = 'auren-toc-title';
    title.textContent = 'Contents';
    nav.appendChild(title);
    const entries = readEntries(node.attrs.entries);
    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'auren-toc-empty';
      empty.textContent = 'Add headings to populate the table of contents.';
      nav.appendChild(empty);
    }
    entries.forEach((entry) => {
      const row = document.createElement('div');
      row.className = `auren-toc-row level-${entry.level}`;
      const link = document.createElement('a');
      link.href = '#';
      link.dataset.pos = String(entry.pos);
      link.textContent = entry.text || 'Untitled heading';
      row.appendChild(link);
      nav.appendChild(row);
    });
    return nav;
  }
});

/* -------------------------------------------------------------------- caption */

export const Caption = Node.create({
  name: 'caption',
  group: 'block',
  content: 'inline*',
  addAttributes() {
    return {
      kind: { default: 'figure', parseHTML: (element) => element.getAttribute('data-caption-kind') || 'figure' }
    };
  },
  parseHTML() {
    return [{ tag: 'p[data-caption]' }, { tag: 'figcaption' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes(HTMLAttributes, { 'data-caption': 'true', class: 'auren-caption' }), 0];
  }
});

/* ------------------------------------------------------------------ resizable image */

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const attr = Number(element.getAttribute('width'));
          if (Number.isFinite(attr) && attr > 0) return attr;
          const style = parseFloat(element.style.width);
          return Number.isFinite(style) && style > 0 ? style : null;
        },
        renderHTML: (attributes) => attributes.width ? { width: attributes.width } : {}
      },
      height: {
        default: null,
        parseHTML: (element) => {
          const attr = Number(element.getAttribute('height'));
          if (Number.isFinite(attr) && attr > 0) return attr;
          const style = parseFloat(element.style.height);
          return Number.isFinite(style) && style > 0 ? style : null;
        },
        renderHTML: (attributes) => attributes.height ? { height: attributes.height } : {}
      }
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  }
}).configure({
  inline: false,
  allowBase64: true,
  HTMLAttributes: { class: 'auren-image' }
});

/* ------------------------------------------------------------------- search */

export interface SearchMatch { from: number; to: number }
export interface SearchPluginState {
  query: string;
  matches: SearchMatch[];
  index: number;
}

export const searchPluginKey = new PluginKey<SearchPluginState>('aurenSearch');

function collectMatches(doc: PMNode, query: string): SearchMatch[] {
  const q = query.toLocaleLowerCase();
  const matches: SearchMatch[] = [];
  if (!q) return matches;
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return true;
    const text = node.text.toLocaleLowerCase();
    let at = 0;
    while (at <= text.length - q.length) {
      const found = text.indexOf(q, at);
      if (found < 0) break;
      matches.push({ from: pos + found, to: pos + found + q.length });
      at = found + Math.max(1, q.length);
    }
    return true;
  });
  return matches;
}

function buildSearchState(doc: PMNode, query: string, wantedIndex: number): SearchPluginState {
  const matches = collectMatches(doc, query);
  let index = matches.length === 0 ? 0 : Math.max(0, Math.min(matches.length - 1, wantedIndex));
  return { query, matches, index };
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    aurenSearch: {
      setSearch: (query: string) => ReturnType;
      findNext: () => ReturnType;
      findPrevious: () => ReturnType;
      replaceCurrentMatch: (replacement: string) => ReturnType;
      replaceAllMatches: (replacement: string) => ReturnType;
      clearSearch: () => ReturnType;
    };
  }
}

export const Search = Extension.create({
  name: 'aurenSearch',
  addProseMirrorPlugins() {
    return [
      new Plugin<SearchPluginState>({
        key: searchPluginKey,
        state: {
          init: () => ({ query: '', matches: [], index: 0 }),
          apply(tr, value) {
            const meta = tr.getMeta(searchPluginKey) as Partial<SearchPluginState> | undefined;
            if (meta) {
              const query = meta.query !== undefined ? meta.query : value.query;
              const index = meta.index !== undefined ? meta.index : value.index;
              return buildSearchState(tr.doc, query, index);
            }
            if (tr.docChanged && value.query) return buildSearchState(tr.doc, value.query, value.index);
            return value;
          }
        },
        props: {
          decorations(state) {
            const plugin = searchPluginKey.getState(state);
            if (!plugin || !plugin.query || !plugin.matches.length) return null;
            const decorations = plugin.matches.map((match, index) => Decoration.inline(match.from, match.to, {
              class: index === plugin.index ? 'auren-search-match is-current' : 'auren-search-match'
            }));
            return DecorationSet.create(state.doc, decorations);
          }
        }
      })
    ];
  },
  addCommands() {
    return {
      setSearch: (query: string) => ({ state, dispatch }) => {
        dispatch?.(state.tr.setMeta(searchPluginKey, { query, index: 0 }));
        return true;
      },
      findNext: () => ({ state, dispatch }) => {
        const plugin = searchPluginKey.getState(state);
        if (!plugin?.matches.length) return false;
        const index = (plugin.index + 1) % plugin.matches.length;
        const tr = state.tr.setMeta(searchPluginKey, { index });
        const match = plugin.matches[index];
        if (match) tr.scrollIntoView();
        dispatch?.(tr);
        return true;
      },
      findPrevious: () => ({ state, dispatch }) => {
        const plugin = searchPluginKey.getState(state);
        if (!plugin?.matches.length) return false;
        const index = (plugin.index - 1 + plugin.matches.length) % plugin.matches.length;
        const tr = state.tr.setMeta(searchPluginKey, { index });
        const match = plugin.matches[index];
        if (match) tr.scrollIntoView();
        dispatch?.(tr);
        return true;
      },
      replaceCurrentMatch: (replacement: string) => ({ state, dispatch }) => {
        const plugin = searchPluginKey.getState(state);
        if (!plugin?.matches.length) return false;
        const match = plugin.matches[plugin.index];
        if (!match) return false;
        const tr = state.tr.insertText(replacement, match.from, match.to);
        tr.setMeta(searchPluginKey, { query: plugin.query, index: plugin.index });
        dispatch?.(tr);
        return true;
      },
      replaceAllMatches: (replacement: string) => ({ state, dispatch }) => {
        const plugin = searchPluginKey.getState(state);
        if (!plugin?.matches.length) return false;
        const tr = state.tr;
        [...plugin.matches].reverse().forEach((match) => {
          tr.insertText(replacement, match.from, match.to);
        });
        tr.setMeta(searchPluginKey, { query: plugin.query, index: 0 });
        dispatch?.(tr);
        return true;
      },
      clearSearch: () => ({ state, dispatch }) => {
        dispatch?.(state.tr.setMeta(searchPluginKey, { query: '', index: 0 }));
        return true;
      }
    };
  }
});

/* ------------------------------------------------------------------ pagination */

interface PageBreakDecoration { pos: number; height: number }
interface PaginationState { breaks: PageBreakDecoration[]; pages: number }

export const paginationPluginKey = new PluginKey<PaginationState>('aurenPagination');
export const PAGE_GAP = 28;

function measurePagination(view: EditorView): PaginationState | null {
  const dom = view.dom as HTMLElement;
  const contentHeight = parseFloat(dom.dataset.pageContentHeight || '0');
  const pitch = parseFloat(dom.dataset.pagePitch || '0');
  if (!contentHeight || !pitch) return null;
  if (dom.dataset.columns && dom.dataset.columns !== '1') {
    const pages = Math.max(1, Math.ceil(dom.scrollHeight / pitch));
    return { breaks: [], pages };
  }
  const spacers = Array.from(dom.querySelectorAll<HTMLElement>(':scope > .auren-page-spacer'));
  const previous = spacers.map((spacer) => spacer.style.display);
  spacers.forEach((spacer) => { spacer.style.display = 'none'; });
  void dom.offsetHeight;

  const blocks: Array<{ pos: number; top: number; height: number; type: string }> = [];
  view.state.doc.forEach((node, offset) => {
    const element = view.nodeDOM(offset) as HTMLElement | null;
    if (!element || !(element instanceof HTMLElement)) return;
    blocks.push({
      pos: offset,
      top: element.offsetTop,
      height: element.offsetHeight,
      type: node.type.name
    });
  });

  spacers.forEach((spacer, index) => { spacer.style.display = previous[index] || ''; });

  const breaks: PageBreakDecoration[] = [];
  let added = 0;
  let pageStart = 0;
  let forceNext = false;
  let maxBottom = 0;

  for (const block of blocks) {
    if (block.type === 'pageBreak') {
      forceNext = true;
      continue;
    }
    let top = block.top + added;
    if (forceNext) {
      if (top < pageStart + pitch - 0.5) {
        const height = pageStart + pitch - top;
        if (height > 0.5) {
          breaks.push({ pos: block.pos, height });
          added += height;
          top += height;
        }
      }
      pageStart += pitch;
      forceNext = false;
    }
    while (top >= pageStart + contentHeight - 0.5) pageStart += pitch;
    let bottom = top + block.height;
    if (bottom > pageStart + contentHeight + 0.5 && top > pageStart + 0.5) {
      const height = pageStart + pitch - top;
      if (height > 0.5) {
        breaks.push({ pos: block.pos, height });
        added += height;
        top += height;
        bottom = top + block.height;
        pageStart += pitch;
      }
    }
    while (bottom > pageStart + contentHeight && pageStart + pitch <= bottom) pageStart += pitch;
    if (bottom > maxBottom) maxBottom = bottom;
  }

  const pages = Math.max(1, Math.floor(Math.max(0, maxBottom - 0.5) / pitch) + 1);
  return { breaks, pages };
}

function samePagination(a: PaginationState | undefined, b: PaginationState): boolean {
  if (!a) return false;
  if (a.pages !== b.pages) return false;
  if (a.breaks.length !== b.breaks.length) return false;
  return a.breaks.every((item, index) => item.pos === b.breaks[index].pos && Math.abs(item.height - b.breaks[index].height) < 0.6);
}

export const Pagination = Extension.create({
  name: 'aurenPagination',
  addProseMirrorPlugins() {
    let frame = 0;
    return [
      new Plugin<PaginationState>({
        key: paginationPluginKey,
        state: {
          init: () => ({ breaks: [], pages: 1 }),
          apply(tr, value) {
            const meta = tr.getMeta(paginationPluginKey) as PaginationState | undefined;
            if (meta) return meta;
            return value;
          }
        },
        props: {
          decorations(state) {
            const plugin = paginationPluginKey.getState(state);
            if (!plugin?.breaks.length) return null;
            return DecorationSet.create(state.doc, plugin.breaks.map((item) => Decoration.widget(item.pos, () => {
              const spacer = document.createElement('div');
              spacer.className = 'auren-page-spacer';
              spacer.style.height = `${Math.round(item.height * 100) / 100}px`;
              spacer.setAttribute('aria-hidden', 'true');
              return spacer;
            }, { side: -1, key: `auren-page-${item.pos}-${Math.round(item.height)}` })));
          }
        },
        view: (view) => {
          const run = () => {
            frame = 0;
            const measured = measurePagination(view);
            if (!measured) return;
            const current = paginationPluginKey.getState(view.state);
            if (view.dom.dataset) view.dom.dataset.pages = String(measured.pages);
            if (!samePagination(current, measured)) {
              const tr = view.state.tr.setMeta(paginationPluginKey, measured).setMeta('addToHistory', false);
              view.dispatch(tr);
            }
            window.dispatchEvent(new CustomEvent('auren:pages', { detail: { pages: measured.pages } }));
          };
          const schedule = () => {
            if (frame) cancelAnimationFrame(frame);
            frame = requestAnimationFrame(run);
          };
          const onRefresh = () => schedule();
          const onResize = () => schedule();
          window.addEventListener('auren:refresh-pagination', onRefresh);
          window.addEventListener('resize', onResize);
          schedule();
          if (document.fonts?.ready) void document.fonts.ready.then(schedule);
          return {
            update(nextView, previousState) {
              if (nextView.state.doc !== previousState.doc) schedule();
            },
            destroy() {
              if (frame) cancelAnimationFrame(frame);
              window.removeEventListener('auren:refresh-pagination', onRefresh);
              window.removeEventListener('resize', onResize);
            }
          };
        }
      })
    ];
  }
});

/* -------------------------------------------------------------- spellchecking */

export const spellcheckPluginKey = new PluginKey<{ unknown: Set<string>; ignored: Set<string> }>('aurenSpellcheck');

function collectSpelling(state: EditorState): DecorationSet {
  const plugin = spellcheckPluginKey.getState(state);
  if (!plugin || (!plugin.unknown.size && !plugin.ignored.size)) return DecorationSet.empty;
  const decorations: Decoration[] = [];
  state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return true;
    const wordPattern = /[\p{L}][\p{L}'’\-]*/gu;
    let match: RegExpExecArray | null;
    while ((match = wordPattern.exec(node.text))) {
      const word = match[0];
      const lower = word.toLocaleLowerCase();
      if (word.length < 3 || plugin.ignored.has(lower)) continue;
      if (/^[A-Z]{2,}$/.test(word) && word.length < 6) continue;
      if (plugin.unknown.has(lower)) {
        decorations.push(Decoration.inline(pos + match.index, pos + match.index + word.length, {
          class: 'auren-spell-error',
          'data-word': lower
        }));
      }
    }
    return true;
  });
  return DecorationSet.create(state.doc, decorations);
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    aurenSpellcheck: {
      setSpellErrors: (words: string[]) => ReturnType;
      ignoreSpellWord: (word: string) => ReturnType;
    };
  }
}

export const Spellcheck = Extension.create({
  name: 'aurenSpellcheck',
  addProseMirrorPlugins() {
    return [
      new Plugin<{ unknown: Set<string>; ignored: Set<string> }>({
        key: spellcheckPluginKey,
        state: {
          init: () => ({ unknown: new Set<string>(), ignored: new Set<string>() }),
          apply(tr, value) {
            const meta = tr.getMeta(spellcheckPluginKey) as { words?: string[]; ignore?: string } | undefined;
            if (meta?.words) return { unknown: new Set(meta.words.map((word) => word.toLocaleLowerCase())), ignored: value.ignored };
            if (meta?.ignore) {
              const ignored = new Set(value.ignored);
              ignored.add(meta.ignore.toLocaleLowerCase());
              return { unknown: value.unknown, ignored };
            }
            return value;
          }
        },
        props: { decorations: collectSpelling }
      })
    ];
  },
  addCommands() {
    return {
      setSpellErrors: (words: string[]) => ({ state, dispatch }) => {
        const plugin = spellcheckPluginKey.getState(state);
        const ignored = plugin?.ignored || new Set<string>();
        dispatch?.(state.tr.setMeta(spellcheckPluginKey, { words: words.filter((word) => !ignored.has(word.toLocaleLowerCase())) }));
        return true;
      },
      ignoreSpellWord: (word: string) => ({ state, dispatch }) => {
        dispatch?.(state.tr.setMeta(spellcheckPluginKey, { ignore: word }));
        return true;
      }
    };
  }
});

/* ----------------------------------------------------------- writing hints */

export function writingHintStats(editor: Editor): { repeated: number; spacing: number; punctuation: number } {
  let repeated = 0;
  let spacing = 0;
  let punctuation = 0;
  editor.state.doc.descendants((node) => {
    if (!node.isText || !node.text) return true;
    repeated += (node.text.match(/\b([\p{L}]{3,})\s+\1\b/giu) || []).length;
    spacing += (node.text.match(/ {2,}/g) || []).length;
    punctuation += (node.text.match(/[.,;:!?][\p{L}]/gu) || []).length;
    return true;
  });
  return { repeated, spacing, punctuation };
}

export const WritingHints = Extension.create<{ enabled: boolean }>({
  name: 'aurenWritingHints',
  addOptions() {
    return { enabled: true };
  },
  addProseMirrorPlugins() {
    const enabled = this.options.enabled;
    return [
      new Plugin({
        key: new PluginKey('aurenWritingHints'),
        props: {
          decorations(state) {
            if (!enabled) return null;
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return true;
              const text = node.text;
              const patterns: Array<{ regex: RegExp; className: string }> = [
                { regex: /\b([\p{L}]{3,})\s+\1\b/giu, className: 'auren-hint repeated' },
                { regex: / {2,}/g, className: 'auren-hint spacing' },
                { regex: /[.,;:!?][\p{L}]/gu, className: 'auren-hint punctuation' }
              ];
              patterns.forEach(({ regex, className }) => {
                let match: RegExpExecArray | null;
                regex.lastIndex = 0;
                while ((match = regex.exec(text))) {
                  decorations.push(Decoration.inline(pos + match.index, pos + match.index + match[0].length, { class: className }));
                }
              });
              return true;
            });
            return DecorationSet.create(state.doc, decorations);
          }
        }
      })
    ];
  }
});
