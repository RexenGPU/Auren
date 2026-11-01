import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';
import path from 'node:path';
import type { PageSettings, PageSizeName } from '../../shared/types';
import { DEFAULT_PAGE_SETTINGS } from '../../shared/types';

type X = Record<string, any>;

interface StyleDef {
  id: string;
  type: string;
  name: string;
  basedOn?: string;
  pPr?: X;
  rPr?: X;
}

interface NumberingLevel {
  ilvl: number;
  numFmt: string;
  lvlText: string;
  start: number;
}

interface ImportedDoc {
  html: string;
  pageSettings: PageSettings;
  warnings: string[];
  title: string;
  footnotes: number;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  preserveOrder: true,
  parseTagValue: false,
  trimValues: false,
  processEntities: true,
  allowBooleanAttributes: true,
  removeNSPrefix: false
});

function parseXml(xml: string): X[] {
  return parser.parse(xml) as X[];
}

function tagOf(node: X): string {
  return Object.keys(node).find((k) => k !== ':@' && k !== '#text') || '';
}
function kids(node: X): X[] {
  const t = tagOf(node);
  const v = t ? node[t] : undefined;
  return Array.isArray(v) ? v : [];
}
function attr(node: X | undefined, name: string): string | undefined {
  const a = node?.[':@'];
  if (!a) return undefined;
  const v = a[name];
  return v == null ? undefined : String(v);
}
function named(node: X | undefined, name: string): X | undefined {
  if (!node) return undefined;
  return kids(node).find((k) => tagOf(k) === name);
}
function namedAll(node: X | undefined, name: string): X[] {
  if (!node) return [];
  return kids(node).filter((k) => tagOf(k) === name);
}
function val(node: X | undefined): string | undefined {
  if (!node) return undefined;
  return attr(node, 'w:val');
}
function childVal(node: X | undefined, name: string): string | undefined {
  return val(named(node, name));
}
function textContent(node: X | undefined): string {
  if (!node) return '';
  if (node['#text'] != null) return String(node['#text']);
  const t = tagOf(node);
  if (t === '#text') return String(node['#text'] ?? '');
  let out = '';
  for (const k of kids(node)) out += textContent(k);
  return out;
}
function truthy(node: X | undefined): boolean {
  if (!node) return false;
  const v = val(node);
  return v !== '0' && v !== 'false' && v !== 'off' && v !== 'none';
}
function twipsToPt(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n / 20 : null;
}
function twipsToMm(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round((n / 1440) * 25.4 * 10) / 10 : null;
}
function emuToPx(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(8, Math.round(n / 9525)) : null;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function colorIsAuto(c: string | undefined): boolean {
  return !c || /^auto$/i.test(c) || c === '00000000';
}

function cssColor(c: string): string {
  return `#${c.replace(/^#/, '').slice(-6)}`;
}

function styleChain(styles: Map<string, StyleDef>, id: string | undefined, type: 'paragraph' | 'character'): StyleDef[] {
  const chain: StyleDef[] = [];
  let current = id;
  const guard = new Set<string>();
  while (current && !guard.has(current)) {
    guard.add(current);
    const def = styles.get(current);
    if (!def) break;
    if (def.type === type || def.type === 'both' || def.type === '') chain.push(def);
    current = def.basedOn;
  }
  return chain.reverse();
}

interface RunStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  highlight?: string;
  sizePt?: number;
  font?: string;
  superscript?: boolean;
  subscript?: boolean;
  smallCaps?: boolean;
  spacing?: number;
}

function readRPr(rPr: X | undefined, base: RunStyle = {}): RunStyle {
  if (!rPr) return { ...base };
  const out: RunStyle = { ...base };
  if (named(rPr, 'w:b') !== undefined) out.bold = truthy(named(rPr, 'w:b'));
  if (named(rPr, 'w:i') !== undefined) out.italic = truthy(named(rPr, 'w:i'));
  if (named(rPr, 'w:u') !== undefined) {
    const u = val(named(rPr, 'w:u'));
    out.underline = u !== 'none' && u !== '0';
  }
  if (named(rPr, 'w:strike') !== undefined) out.strike = truthy(named(rPr, 'w:strike'));
  if (named(rPr, 'w:dstrike') !== undefined && truthy(named(rPr, 'w:dstrike'))) out.strike = true;
  const color = childVal(rPr, 'w:color');
  if (color && !colorIsAuto(color)) out.color = cssColor(color);
  const highlight = childVal(rPr, 'w:highlight');
  if (highlight && highlight !== 'none') out.highlight = highlight;
  const shd = named(rPr, 'w:shd');
  const fill = attr(shd, 'w:fill');
  if (fill && !colorIsAuto(fill)) out.highlight = cssColor(fill);
  const sz = childVal(rPr, 'w:sz');
  if (sz) out.sizePt = Number(sz) / 2;
  const fonts = named(rPr, 'w:rFonts');
  const font = attr(fonts, 'w:ascii') || attr(fonts, 'w:hAnsi') || attr(fonts, 'w:cs');
  if (font) out.font = font;
  const vertAlign = childVal(rPr, 'w:vertAlign');
  if (vertAlign === 'superscript') { out.superscript = true; out.subscript = false; }
  if (vertAlign === 'subscript') { out.subscript = true; out.superscript = false; }
  if (named(rPr, 'w:smallCaps') && truthy(named(rPr, 'w:smallCaps'))) out.smallCaps = true;
  const spacing = childVal(rPr, 'w:spacing');
  if (spacing) out.spacing = Number(spacing) / 20;
  return out;
}

function combineRunStyle(styles: Map<string, StyleDef>, rPr: X | undefined, runStyleId: string | undefined): RunStyle {
  let style: RunStyle = {};
  for (const def of styleChain(styles, runStyleId, 'character')) style = readRPr(def.rPr, style);
  return readRPr(rPr, style);
}

function wrapRunStyle(html: string, style: RunStyle): string {
  if (!html) return html;
  const css: string[] = [];
  if (style.font) css.push(`font-family:${style.font.replace(/["']/g, '')}`);
  if (style.sizePt) css.push(`font-size:${style.sizePt}pt`);
  if (style.color) css.push(`color:${style.color}`);
  if (style.highlight) css.push(`background-color:${style.highlight}`);
  if (style.smallCaps) css.push('font-variant:small-caps');
  if (style.spacing) css.push(`letter-spacing:${style.spacing}pt`);
  let out = html;
  if (style.strike) out = `<s>${out}</s>`;
  if (style.underline) out = `<u>${out}</u>`;
  if (style.italic) out = `<em>${out}</em>`;
  if (style.bold) out = `<strong>${out}</strong>`;
  if (style.superscript) out = `<sup>${out}</sup>`;
  if (style.subscript) out = `<sub>${out}</sub>`;
  if (css.length) out = `<span style="${css.join(';')}">${out}</span>`;
  return out;
}

const HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: '#fff59d', green: '#b9f6ca', cyan: '#b2ebf2', magenta: '#f8bbd0',
  blue: '#bbdefb', red: '#ffcdd2', darkBlue: '#9fa8da', darkCyan: '#80cbc4',
  darkGreen: '#a5d6a7', darkMagenta: '#ce93d8', darkRed: '#ef9a9a',
  darkYellow: '#ffe082', gray: '#e0e0e0', lightGray: '#f5f5f5', black: '#424242'
};

function highlightColor(name: string): string {
  return HIGHLIGHT_COLORS[name] || name;
}

interface ParseContext {
  zip: JSZip;
  styles: Map<string, StyleDef>;
  numbering: Map<string, NumberingLevel[]>;
  rels: Map<string, { target: string; mode?: string }>;
  warnings: Set<string>;
  footnotes: Map<string, string>;
  footnoteOrder: string[];
  mediaCache: Map<string, string>;
  seenHeading: boolean;
}

async function readRelationships(zip: JSZip, folder: string): Promise<Map<string, { target: string; mode?: string }>> {
  const map = new Map<string, { target: string; mode?: string }>();
  const relPath = folder ? `${folder}/_rels/document.xml.rels` : '_rels/document.xml.rels';
  const file = zip.file(relPath);
  if (!file) return map;
  const xml = await file.async('string');
  const roots = parseXml(xml);
  const relationships = roots.find((r) => tagOf(r) === 'Relationships');
  for (const rel of namedAll(relationships, 'Relationship')) {
    const rid = attr(rel, 'Id');
    const target = attr(rel, 'Target');
    if (rid && target) map.set(rid, { target, mode: attr(rel, 'TargetMode') });
  }
  return map;
}

function resolveTarget(context: ParseContext, target: string): string {
  if (/^https?:/i.test(target)) return target;
  const clean = target.replace(/^\/?word\//, '').replace(/^\.\//, '');
  return `word/${clean}`;
}

async function relationHref(context: ParseContext, rid: string | undefined): Promise<string> {
  if (!rid) return '';
  const rel = context.rels.get(rid);
  if (!rel) return '';
  if (rel.mode === 'External' || /^[a-z]+:/i.test(rel.target)) return rel.target;
  return '';
}

async function imageDataUrl(context: ParseContext, rid: string | undefined): Promise<string> {
  if (!rid) return '';
  const cached = context.mediaCache.get(rid);
  if (cached) return cached;
  const rel = context.rels.get(rid);
  if (!rel) return '';
  const file = context.zip.file(resolveTarget(context, rel.target));
  if (!file) return '';
  const data = await file.async('base64');
  const ext = path.extname(rel.target).toLowerCase().replace('.', '');
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : ext === 'gif' ? 'image/gif' : ext === 'bmp' ? 'image/bmp' : 'image/png';
  const url = `data:${mime};base64,${data}`;
  context.mediaCache.set(rid, url);
  return url;
}

async function parseImage(context: ParseContext, drawing: X, asBlock: boolean): Promise<string> {
  const blip = findDeep(drawing, 'a:blip');
  const rid = attr(blip, 'r:embed') || attr(blip, 'r:link');
  const extent = findDeep(drawing, 'wp:extent');
  const width = emuToPx(attr(extent, 'cx'));
  const height = emuToPx(attr(extent, 'cy'));
  const docPr = findDeep(drawing, 'wp:docPr');
  const alt = attr(docPr, 'descr') || attr(docPr, 'title') || attr(docPr, 'name') || '';
  const src = await imageDataUrl(context, rid);
  if (!src) {
    const txbx = findDeep(drawing, 'wps:txbx') || findDeep(drawing, 'w:txbxContent');
    if (txbx) {
      const inner = await blocksToHtml(context, kids(txbx), true);
      return `<div data-auren-textbox="true">${inner}</div>`;
    }
    context.warnings.add('A drawing or shape without readable content was skipped.');
    return '';
  }
  const size = width && height ? ` width="${width}" height="${height}"` : width ? ` width="${width}"` : '';
  return `<img src="${src}"${size} alt="${escapeHtml(alt)}"${asBlock ? ' data-block="true"' : ''}>`;
}

function findDeep(node: X | undefined, name: string): X | undefined {
  if (!node) return undefined;
  if (tagOf(node) === name) return node;
  for (const child of kids(node)) {
    const found = findDeep(child, name);
    if (found) return found;
  }
  return undefined;
}

async function runToHtml(context: ParseContext, run: X, inherited: RunStyle): Promise<string> {
  const rPr = named(run, 'w:rPr');
  const style = combineRunStyle(context.styles, rPr, childVal(rPr, 'w:rStyle'));
  const merged = { ...inherited, ...style };
  let html = '';
  for (const child of kids(run)) {
    const tag = tagOf(child);
    if (tag === 'w:t') {
      html += escapeHtml(textContent(child));
    } else if (tag === 'w:tab') {
      html += '<span data-tab="true">\u2003\u2003</span>';
    } else if (tag === 'w:br') {
      if (attr(child, 'w:type') === 'page') html += '<div data-page-break="true"></div>';
      else html += '<br>';
    } else if (tag === 'w:cr') {
      html += '<br>';
    } else if (tag === 'w:noBreakHyphen') {
      html += '\u2011';
    } else if (tag === 'w:drawing') {
      html += await parseImage(context, child, false);
    } else if (tag === 'w:pict') {
      const imagedata = findDeep(child, 'v:imagedata');
      const rid = attr(imagedata, 'r:id');
      const src = await imageDataUrl(context, rid);
      if (src) html += `<img src="${src}" alt="">`;
    } else if (tag === 'w:footnoteReference') {
      const noteId = attr(child, 'w:id') || '';
      const noteText = context.footnotes.get(noteId) || '';
      const number = context.footnoteOrder.indexOf(noteId) + 1 || context.footnoteOrder.length + 1;
      html += `<sup data-auren-footnote="${escapeHtml(noteText)}" data-footnote-id="${escapeHtml(noteId)}">${number}</sup>`;
      if (!context.footnoteOrder.includes(noteId)) context.footnoteOrder.push(noteId);
    } else if (tag === 'w:endnoteReference') {
      html += '<sup>†</sup>';
    } else if (tag === 'w:sym') {
      const code = attr(child, 'w:char');
      if (code) html += escapeHtml(String.fromCharCode(parseInt(code, 16)));
    } else if (tag === 'm:oMath' || tag === 'm:oMathPara') {
      const mathText = textContent(child).trim();
      if (mathText) {
        html += `<span data-auren-math="${escapeHtml(mathText)}">${escapeHtml(mathText)}</span>`;
        context.warnings.add('Word equations were imported as editable equation text.');
      }
    }
  }
  if (!html) return '';
  return wrapRunStyle(html, merged);
}

interface ParagraphStyleInfo {
  heading: number;
  align?: string;
  indLeft?: number;
  indRight?: number;
  firstLine?: number;
  hanging?: number;
  spacingBefore?: number;
  spacingAfter?: number;
  lineHeight?: number;
  background?: string;
  pageBreakBefore?: boolean;
  numId?: string;
  ilvl?: number;
  keepNext?: boolean;
  sectPr?: X;
}

function readPPr(context: ParseContext, pPr: X | undefined, styleId: string | undefined): ParagraphStyleInfo {
  const info: ParagraphStyleInfo = { heading: 0 };
  const styleDefs = styleChain(context.styles, styleId, 'paragraph');
  const sources: Array<X | undefined> = [...styleDefs.map((s) => s.pPr), pPr];
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    if (!source) continue;
    const direct = i === sources.length - 1;
    const jc = childVal(source, 'w:jc');
    if (jc) info.align = jc === 'both' ? 'justify' : jc === 'center' ? 'center' : jc === 'right' ? 'right' : 'left';
    const ind = named(source, 'w:ind');
    if (ind) {
      const left = twipsToPt(attr(ind, 'w:left') ?? attr(ind, 'w:start'));
      const right = twipsToPt(attr(ind, 'w:right') ?? attr(ind, 'w:end'));
      const first = twipsToPt(attr(ind, 'w:firstLine'));
      const hanging = twipsToPt(attr(ind, 'w:hanging'));
      if (left != null) info.indLeft = left;
      if (right != null) info.indRight = right;
      if (first != null) info.firstLine = first;
      if (hanging != null) info.hanging = hanging;
    }
    const spacing = named(source, 'w:spacing');
    if (spacing) {
      const before = twipsToPt(attr(spacing, 'w:before'));
      const after = twipsToPt(attr(spacing, 'w:after'));
      const line = attr(spacing, 'w:line');
      const rule = attr(spacing, 'w:lineRule');
      if (before != null) info.spacingBefore = before;
      if (after != null) info.spacingAfter = after;
      if (line && (rule === 'auto' || !rule) && Number(line) > 0) info.lineHeight = Number(line) / 240;
      else if (line && rule === 'exact') info.lineHeight = Number(line) / 20 / 12;
    }
    const shd = named(source, 'w:shd');
    const fill = attr(shd, 'w:fill');
    if (fill && !colorIsAuto(fill)) info.background = cssColor(fill);
    if (named(source, 'w:pageBreakBefore') && truthy(named(source, 'w:pageBreakBefore'))) info.pageBreakBefore = true;
    if (named(source, 'w:keepNext') && truthy(named(source, 'w:keepNext'))) info.keepNext = true;
    const numPr = named(source, 'w:numPr');
    if (numPr) {
      const numId = childVal(numPr, 'w:numId');
      const ilvl = childVal(numPr, 'w:ilvl');
      if (numId) info.numId = numId;
      if (ilvl != null) info.ilvl = Number(ilvl);
    }
    const sectPr = named(source, 'w:sectPr');
    if (sectPr) info.sectPr = sectPr;
    const outline = childVal(source, 'w:outlineLvl');
    if (outline != null && Number(outline) < 6) info.heading = Number(outline) + 1;
  }
  for (const def of styleDefs) {
    const name = def.name.toLowerCase();
    const m = name.match(/^heading\s*([1-6])$/);
    if (m) info.heading = Number(m[1]);
    if (name === 'title') info.heading = Math.max(info.heading, 1);
  }
  return info;
}

async function paragraphInner(context: ParseContext, paragraph: X, runStyle: RunStyle): Promise<string> {
  let html = '';
  for (const child of kids(paragraph)) {
    const tag = tagOf(child);
    if (tag === 'w:r') {
      html += await runToHtml(context, child, runStyle);
    } else if (tag === 'w:hyperlink') {
      const rid = attr(child, 'r:id');
      const anchor = attr(child, 'w:anchor');
      let href = await relationHref(context, rid);
      if (!href && anchor) href = `#${anchor}`;
      let inner = '';
      for (const item of kids(child)) {
        if (tagOf(item) === 'w:r') inner += await runToHtml(context, item, runStyle);
      }
      html += href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>` : inner;
    } else if (tag === 'w:ins' || tag === 'w:smartTag' || tag === 'w:sdtContent' || tag === 'w:customXml') {
      for (const item of kids(child)) {
        if (tagOf(item) === 'w:r') html += await runToHtml(context, item, runStyle);
        else if (tagOf(item) === 'w:hyperlink') {
          let inner = '';
          for (const r of namedAll(item, 'w:r')) inner += await runToHtml(context, r, runStyle);
          html += inner;
        }
      }
    } else if (tag === 'w:fldSimple') {
      const instr = attr(child, 'w:instr') || '';
      if (/PAGE/i.test(instr)) {
        html += '<span data-auren-field="page">1</span>';
      } else {
        for (const item of kids(child)) {
          if (tagOf(item) === 'w:r') html += await runToHtml(context, item, runStyle);
        }
      }
    } else if (tag === 'm:oMath') {
      const mathText = textContent(child).trim();
      if (mathText) html += `<span data-auren-math="${escapeHtml(mathText)}">${escapeHtml(mathText)}</span>`;
    } else if (tag === 'w:sdt') {
      const content = named(child, 'w:sdtContent');
      if (content) {
        for (const item of kids(content)) {
          if (tagOf(item) === 'w:r') html += await runToHtml(context, item, runStyle);
        }
      }
    }
  }
  return html;
}

function paragraphInlineStyle(info: ParagraphStyleInfo): string {
  const css: string[] = [];
  if (info.align && info.align !== 'left') css.push(`text-align:${info.align}`);
  if (info.indLeft != null) css.push(`margin-left:${info.indLeft}pt`);
  if (info.indRight != null) css.push(`margin-right:${info.indRight}pt`);
  if (info.firstLine != null) css.push(`text-indent:${info.firstLine}pt`);
  if (info.hanging != null) css.push(`text-indent:-${info.hanging}pt`);
  if (info.spacingBefore != null) css.push(`margin-top:${info.spacingBefore}pt`);
  if (info.spacingAfter != null) css.push(`margin-bottom:${info.spacingAfter}pt`);
  if (info.lineHeight != null) css.push(`line-height:${info.lineHeight.toFixed(2)}`);
  if (info.background) css.push(`background-color:${info.background}`);
  return css.length ? ` style="${css.join(';')}"` : '';
}

interface ListItemData {
  level: number;
  html: string;
  ordered: boolean;
}

function renderList(items: ListItemData[], startIndex: number, level: number): { html: string; next: number } {
  const tag = items[startIndex]?.ordered ? 'ol' : 'ul';
  let html = `<${tag}>`;
  let i = startIndex;
  while (i < items.length) {
    const item = items[i];
    if (item.level < level) break;
    if (item.level > level) {
      const nested = renderList(items, i, level + 1);
      html += nested.html;
      i = nested.next;
      continue;
    }
    let content = item.html || '<br>';
    i++;
    while (i < items.length && items[i].level > level) {
      const nested = renderList(items, i, level + 1);
      content += nested.html;
      i = nested.next;
    }
    html += `<li>${content}</li>`;
  }
  html += `</${tag}>`;
  return { html, next: i };
}

function listMarkerOrdered(context: ParseContext, numId: string, ilvl: number): boolean {
  const levels = context.numbering.get(numId);
  const level = levels?.find((l) => l.ilvl === ilvl);
  const fmt = level?.numFmt || 'bullet';
  return fmt !== 'bullet' && fmt !== 'none';
}

async function blocksToHtml(context: ParseContext, nodes: X[], insideCell = false): Promise<string> {
  let html = '';
  let pendingNumId = '';
  let pendingItems: ListItemData[] = [];

  const flushList = () => {
    if (!pendingItems.length) return;
    html += renderList(pendingItems, 0, 0).html;
    pendingItems = [];
    pendingNumId = '';
  };

  for (const node of nodes) {
    const tag = tagOf(node);
    if (tag === 'w:p') {
      const pPr = named(node, 'w:pPr');
      const styleId = childVal(pPr, 'w:pStyle');
      const info = readPPr(context, pPr, styleId);
      if (info.pageBreakBefore) { flushList(); html += '<div data-page-break="true"></div>'; }
      let runStyle: RunStyle = {};
      const paragraphMarkRPr = named(pPr, 'w:rPr');
      if (paragraphMarkRPr) runStyle = readRPr(paragraphMarkRPr, runStyle);
      const inner = await paragraphInner(context, node, runStyle);
      if (info.numId) {
        if (pendingNumId && pendingNumId !== info.numId) flushList();
        pendingNumId = info.numId;
        pendingItems.push({
          level: Math.max(0, info.ilvl ?? 0),
          html: inner,
          ordered: listMarkerOrdered(context, info.numId, info.ilvl ?? 0)
        });
      } else {
        flushList();
        const heading = info.heading;
        if (heading >= 1 && heading <= 6) {
          context.seenHeading = true;
          html += `<h${heading}${paragraphInlineStyle(info)}>${inner || '<br>'}</h${heading}>`;
        } else if (!inner.trim()) {
          html += `<p${paragraphInlineStyle(info)}><br></p>`;
        } else {
          html += `<p${paragraphInlineStyle(info)}>${inner}</p>`;
        }
      }
      if (info.sectPr) {
        flushList();
        html += '<div data-page-break="true"></div>';
      }
    } else if (tag === 'w:tbl') {
      flushList();
      html += await tableToHtml(context, node);
    } else if (tag === 'w:sectPr') {
      // captured separately
    } else if (tag === 'w:sdt') {
      flushList();
      const content = named(node, 'w:sdtContent');
      if (content) html += await blocksToHtml(context, kids(content), insideCell);
    } else if (tag === 'w:customXml' || tag === 'w:ins') {
      flushList();
      html += await blocksToHtml(context, kids(node), insideCell);
    } else if (tag === 'w:altChunk') {
      context.warnings.add('An embedded alternative-format block could not be imported.');
    }
  }
  flushList();
  return html;
}

async function tableToHtml(context: ParseContext, table: X): Promise<string> {
  const tblPr = named(table, 'w:tblPr');
  const borders = named(tblPr, 'w:tblBorders');
  let borderCss = 'border:1px solid #cfcfd8;';
  if (borders) {
    const top = named(borders, 'w:top');
    if (top && val(top) === 'nil') borderCss = 'border:none;';
  }
  const jc = childVal(tblPr, 'w:jc');
  const align = jc === 'center' ? 'margin-left:auto;margin-right:auto;' : jc === 'right' ? 'margin-left:auto;' : '';
  let html = `<table style="border-collapse:collapse;width:100%;${align}${borderCss}"><tbody>`;
  const rows = namedAll(table, 'w:tr');
  const rowData: Array<Array<{ cell: X; colStart: number; span: number; vMerge?: string; rowSpan: number }>> = [];
  for (const row of rows) {
    const cells = namedAll(row, 'w:tc');
    let col = 0;
    const rowCells: Array<{ cell: X; colStart: number; span: number; vMerge?: string; rowSpan: number }> = [];
    for (const cell of cells) {
      const tcPr = named(cell, 'w:tcPr');
      const span = Number(childVal(tcPr, 'w:gridSpan') || 1);
      const vMerge = childVal(tcPr, 'w:vMerge');
      rowCells.push({ cell, colStart: col, span, vMerge, rowSpan: 1 });
      col += span;
    }
    rowData.push(rowCells);
  }
  for (let r = 0; r < rowData.length; r++) {
    const row = rows[r];
    const trPr = named(row, 'w:trPr');
    const isHeader = Boolean(named(trPr, 'w:tblHeader') && truthy(named(trPr, 'w:tblHeader')));
    html += `<tr>`;
    for (const cellInfo of rowData[r]) {
      if (cellInfo.vMerge === 'continue') continue;
      if (cellInfo.vMerge === 'restart') {
        let span = 1;
        for (let rr = r + 1; rr < rowData.length; rr++) {
          const next = rowData[rr].find((c) => c.colStart === cellInfo.colStart);
          if (next && next.vMerge === 'continue') span++;
          else break;
        }
        cellInfo.rowSpan = span;
      }
      const tcPr = named(cellInfo.cell, 'w:tcPr');
      const shd = named(tcPr, 'w:shd');
      const fill = attr(shd, 'w:fill');
      const width = childVal(tcPr, 'w:tcW');
      const styles: string[] = ['border:1px solid #cfcfd8', 'vertical-align:top', 'padding:6pt 8pt'];
      if (fill && !colorIsAuto(fill)) styles.push(`background-color:${cssColor(fill)}`);
      if (width && /^\d+$/.test(width)) styles.push(`width:${Math.round(Number(width) / 20)}pt`);
      const attrs = [
        cellInfo.span > 1 ? `colspan="${cellInfo.span}"` : '',
        cellInfo.rowSpan > 1 ? `rowspan="${cellInfo.rowSpan}"` : '',
        `style="${styles.join(';')}"`
      ].filter(Boolean).join(' ');
      const tag = isHeader ? 'th' : 'td';
      html += `<${tag} ${attrs}>${await blocksToHtml(context, kids(cellInfo.cell), true)}</${tag}>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table><p></p>';
  return html;
}

function parsePageSettings(sectPr: X | undefined): { pageSettings: PageSettings; headerRid?: string; footerRid?: string } {
  const page: PageSettings = { ...DEFAULT_PAGE_SETTINGS, header: '', footer: '', headerEnabled: false, footerEnabled: false };
  let headerRid: string | undefined;
  let footerRid: string | undefined;
  if (!sectPr) return { pageSettings: page };
  const pgSz = named(sectPr, 'w:pgSz');
  const w = twipsToMm(attr(pgSz, 'w:w'));
  const h = twipsToMm(attr(pgSz, 'w:h'));
  const orient = attr(pgSz, 'w:orient');
  if (w && h) {
    page.widthMm = w; page.heightMm = h;
    const match = Object.entries({ A4: [210, 297], A3: [297, 420], Letter: [215.9, 279.4], Legal: [215.9, 355.6] })
      .find(([, dims]) => Math.abs(dims[0] - Math.min(w, h)) < 2 && Math.abs(dims[1] - Math.max(w, h)) < 2);
    page.size = (match?.[0] as PageSizeName) || 'Custom';
    page.orientation = orient === 'landscape' || w > h ? 'landscape' : 'portrait';
  }
  const pgMar = named(sectPr, 'w:pgMar');
  if (pgMar) {
    page.marginTop = twipsToMm(attr(pgMar, 'w:top')) ?? page.marginTop;
    page.marginRight = twipsToMm(attr(pgMar, 'w:right')) ?? page.marginRight;
    page.marginBottom = twipsToMm(attr(pgMar, 'w:bottom')) ?? page.marginBottom;
    page.marginLeft = twipsToMm(attr(pgMar, 'w:left')) ?? page.marginLeft;
  }
  const cols = named(sectPr, 'w:cols');
  const num = attr(cols, 'w:num');
  if (num) page.columns = Math.max(1, Math.min(3, Number(num)));
  const headerRefs = namedAll(sectPr, 'w:headerReference');
  const footerRefs = namedAll(sectPr, 'w:footerReference');
  if (headerRefs.length) {
    const def = headerRefs.find((r) => attr(r, 'w:type') === 'default') || headerRefs[0];
    headerRid = attr(def, 'r:id');
    page.headerEnabled = true;
  }
  if (footerRefs.length) {
    const def = footerRefs.find((r) => attr(r, 'w:type') === 'default') || footerRefs[0];
    footerRid = attr(def, 'r:id');
    page.footerEnabled = true;
  }
  return { pageSettings: page, headerRid, footerRid };
}

async function headerFooterText(context: ParseContext, rid: string | undefined, pageNumbering: { value: boolean }): Promise<string> {
  if (!rid) return '';
  const rel = context.rels.get(rid);
  if (!rel) return '';
  const file = context.zip.file(resolveTarget(context, rel.target));
  if (!file) return '';
  const xml = await file.async('string');
  const roots = parseXml(xml);
  const root = roots.find((r) => /w:(hdr|ftr)$|header|footer/i.test(tagOf(r)));
  if (!root) return '';
  const lines: string[] = [];
  for (const p of namedAll(root, 'w:p')) {
    let line = '';
    for (const r of namedAll(p, 'w:r')) {
      const fld = named(r, 'w:fldChar');
      if (fld) continue;
      const instr = named(r, 'w:instrText');
      if (instr) {
        const code = textContent(instr);
        if (/PAGE/i.test(code)) { line += '{{page}}'; pageNumbering.value = true; }
        continue;
      }
      const t = named(r, 'w:t');
      if (t) line += textContent(t);
    }
    if (line.trim()) lines.push(line.trim());
  }
  return lines.join('   ');
}

function footnotesFromXml(roots: X[]): { map: Map<string, string>; order: string[] } {
  const root = roots.find((r) => tagOf(r) === 'w:footnotes');
  const map = new Map<string, string>();
  const order: string[] = [];
  if (!root) return { map, order };
  for (const note of namedAll(root, 'w:footnote')) {
    const id = attr(note, 'w:id');
    if (!id || Number(id) < 1) continue;
    const text = namedAll(note, 'w:p').map((p) => textContent(p)).join(' ').replace(/\s+/g, ' ').trim();
    if (text) { map.set(id, text); order.push(id); }
  }
  return { map, order };
}

export async function importDocx(buffer: Buffer): Promise<ImportedDoc> {
  const zip = await JSZip.loadAsync(buffer);
  const documentFile = zip.file('word/document.xml');
  if (!documentFile) throw new Error('This file is not a valid Word document (missing document.xml).');
  const xml = await documentFile.async('string');
  const roots = parseXml(xml);
  const doc = roots.find((r) => tagOf(r) === 'w:document');
  const body = named(doc, 'w:body');
  if (!body) throw new Error('This Word document contains no body.');

  const styles = new Map<string, StyleDef>();
  const stylesFile = zip.file('word/styles.xml');
  if (stylesFile) {
    const styleRoots = parseXml(await stylesFile.async('string'));
    const stylesRoot = styleRoots.find((r) => tagOf(r) === 'w:styles');
    for (const style of namedAll(stylesRoot, 'w:style')) {
      const id = attr(style, 'w:styleId') || '';
      if (!id) continue;
      styles.set(id, {
        id,
        type: attr(style, 'w:type') || '',
        name: childVal(named(style, 'w:name'), 'w:val') || childVal(style, 'w:name') || '',
        basedOn: childVal(style, 'w:basedOn'),
        pPr: named(style, 'w:pPr'),
        rPr: named(style, 'w:rPr')
      });
    }
  }

  const numbering = new Map<string, NumberingLevel[]>();
  const numberingFile = zip.file('word/numbering.xml');
  if (numberingFile) {
    const numRoots = parseXml(await numberingFile.async('string'));
    const numRoot = numRoots.find((r) => tagOf(r) === 'w:numbering');
    const abstract = new Map<string, NumberingLevel[]>();
    for (const an of namedAll(numRoot, 'w:abstractNum')) {
      const aid = attr(an, 'w:abstractNumId');
      if (!aid) continue;
      const levels: NumberingLevel[] = [];
      for (const lvl of namedAll(an, 'w:lvl')) {
        const ilvl = Number(attr(lvl, 'w:ilvl') || 0);
        levels.push({
          ilvl,
          numFmt: childVal(lvl, 'w:numFmt') || 'bullet',
          lvlText: childVal(lvl, 'w:lvlText') || '',
          start: Number(childVal(lvl, 'w:start') || 1)
        });
      }
      abstract.set(aid, levels);
    }
    for (const num of namedAll(numRoot, 'w:num')) {
      const numId = attr(num, 'w:numId');
      const aid = childVal(num, 'w:abstractNumId');
      if (numId && aid && abstract.has(aid)) numbering.set(numId, abstract.get(aid)!);
    }
  }

  const rels = await readRelationships(zip, 'word');
  const footnoteRoots: X[] = [];
  const footnoteFile = zip.file('word/footnotes.xml');
  if (footnoteFile) footnoteRoots.push(...parseXml(await footnoteFile.async('string')));
  const parsedFootnotes = footnotesFromXml(footnoteRoots);

  const context: ParseContext = {
    zip, styles, numbering, rels,
    warnings: new Set(), footnotes: parsedFootnotes.map, footnoteOrder: [],
    mediaCache: new Map(), seenHeading: false
  };

  const sectPr = named(body, 'w:sectPr') || (() => {
    let found: X | undefined;
    const visit = (nodes: X[]) => {
      for (const n of nodes) {
        if (tagOf(n) === 'w:sectPr') found = n;
        if (tagOf(n) === 'w:p') {
          const pPr = named(n, 'w:pPr');
          const s = named(pPr, 'w:sectPr');
          if (s) found = s;
        }
      }
    };
    visit(kids(body));
    return found;
  })();

  const section = parsePageSettings(sectPr);
  const pageNumbering = { value: false };
  if (section.headerRid) {
    section.pageSettings.header = await headerFooterText(context, section.headerRid, pageNumbering);
  }
  if (section.footerRid) {
    section.pageSettings.footer = await headerFooterText(context, section.footerRid, pageNumbering);
  }
  section.pageSettings.pageNumbering = pageNumbering.value || section.pageSettings.pageNumbering;

  let html = await blocksToHtml(context, kids(body));
  if (!html.trim()) html = '<p></p>';

  // Footnote appendix (imported notes remain readable and searchable).
  if (context.footnoteOrder.length) {
    const items = context.footnoteOrder.map((noteId, index) => {
      const text = context.footnotes.get(noteId) || '';
      return `<p><sup>${index + 1}</sup> ${escapeHtml(text)}</p>`;
    }).join('');
    html += `<hr><h3>Footnotes</h3>${items}`;
    context.warnings.add('Word footnotes were imported as a footnotes section at the end of the document.');
  }

  // Core properties title
  let title = '';
  const core = zip.file('docProps/core.xml');
  if (core) {
    try {
      const coreRoots = parseXml(await core.async('string'));
      const coreRoot = coreRoots.find((r) => tagOf(r) === 'cp:coreProperties');
      const t = named(coreRoot, 'dc:title');
      title = textContent(t).trim();
    } catch { /* ignore */ }
  }

  if (!context.seenHeading) context.warnings.add('No headings were found in this document.');
  if (!section.pageSettings.headerEnabled && !section.pageSettings.footerEnabled) {
    // no warning, normal for many documents
  }
  context.warnings.add('Complex Word layout (floating objects, fields, themes) may be simplified during import.');

  return {
    html,
    pageSettings: section.pageSettings,
    warnings: [...context.warnings],
    title,
    footnotes: context.footnoteOrder.length
  };
}
