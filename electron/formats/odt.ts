import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';
import path from 'node:path';
import type { PageSettings } from '../../shared/types';
import { DEFAULT_PAGE_SETTINGS } from '../../shared/types';
import type { ConversionResult } from './markup';
import { escapeHtml } from './markup';

type X = Record<string, any>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  preserveOrder: true,
  parseTagValue: false,
  trimValues: false,
  processEntities: true,
  allowBooleanAttributes: true
});

function parseXml(xml: string): X[] { return parser.parse(xml) as X[]; }
function tagOf(node: X): string { return Object.keys(node).find((k) => k !== ':@' && k !== '#text') || ''; }
function kids(node: X): X[] { const t = tagOf(node); return t && Array.isArray(node[t]) ? node[t] : []; }
function attr(node: X | undefined, name: string): string | undefined {
  const v = node?.[':@']?.[name];
  return v == null ? undefined : String(v);
}
function named(node: X | undefined, name: string): X | undefined { return node ? kids(node).find((k) => tagOf(k) === name) : undefined; }
function namedAll(node: X | undefined, name: string): X[] { return node ? kids(node).filter((k) => tagOf(k) === name) : []; }
function textOf(node: X): string {
  const tag = tagOf(node);
  if (tag === '#text') return String(node['#text'] ?? '');
  let out = '';
  for (const k of kids(node)) out += textOf(k);
  return out;
}

function parseLengthMm(value: string | undefined, fallback = 0): number {
  if (!value) return fallback;
  const m = value.match(/^(-?[\d.]+)\s*(mm|cm|in|pt|pc|px)?$/);
  if (!m) return fallback;
  const n = Number(m[1]);
  const unit = m[2] || 'mm';
  switch (unit) {
    case 'mm': return n;
    case 'cm': return n * 10;
    case 'in': return n * 25.4;
    case 'pt': return n * 25.4 / 72;
    case 'pc': return n * 25.4 / 6;
    case 'px': return n * 25.4 / 96;
    default: return n;
  }
}
function parseLengthPt(value: string | undefined, fallback = 0): number {
  return parseLengthMm(value, fallback) * 72 / 25.4;
}
function parseLengthPx(value: string | undefined, fallback = 0): number {
  return parseLengthMm(value, fallback) * 96 / 25.4;
}
function odfColor(value: string | undefined): string | undefined {
  if (!value || value === 'transparent') return undefined;
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  const m = value.match(/^#([0-9a-f]{3})$/i);
  if (m) return `#${m[1].split('').map((c) => c + c).join('')}`;
  return value;
}
function quoteAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

interface StyleRecord {
  name: string;
  family: string;
  parent?: string;
  text?: Record<string, string>;
  paragraph?: Record<string, string>;
  tableCell?: Record<string, string>;
  tableRow?: Record<string, string>;
}

interface OdtContext {
  styles: Map<string, StyleRecord>;
  fonts: Map<string, string>;
  listStyles: Map<string, boolean>;
  zip: JSZip;
  warnings: Set<string>;
  noteIndex: number;
  media: Map<string, string>;
}

function attrsOf(node: X | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  const a = node?.[':@'];
  if (!a) return result;
  for (const [k, v] of Object.entries(a)) result[k] = String(v);
  return result;
}

function collectStyles(roots: X[], context: OdtContext) {
  const visit = (node: X) => {
    const tag = tagOf(node);
    if (tag === 'style:font-face') {
      const name = attr(node, 'style:name');
      const family = attr(node, 'svg:font-family') || attr(node, 'style:font-family-generic');
      if (name && family) context.fonts.set(name, family.replace(/^['"]|['"]$/g, ''));
    }
    if (tag === 'text:list-style') {
      const name = attr(node, 'style:name');
      if (name) {
        const ordered = namedAll(node, 'text:list-level-style-number').length > 0;
        if (!context.listStyles.has(name)) context.listStyles.set(name, ordered);
      }
    }
    if (tag === 'style:style') {
      const name = attr(node, 'style:name');
      if (name) {
        const rec: StyleRecord = {
          name,
          family: attr(node, 'style:family') || '',
          parent: attr(node, 'style:parent-style-name'),
          text: attrsOf(named(node, 'style:text-properties')),
          paragraph: attrsOf(named(node, 'style:paragraph-properties')),
          tableCell: attrsOf(named(node, 'style:table-cell-properties')),
          tableRow: attrsOf(named(node, 'style:table-row-properties'))
        };
        if (!context.styles.has(name) || Object.keys(rec.text || {}).length || Object.keys(rec.paragraph || {}).length) {
          context.styles.set(name, rec);
        }
      }
    }
    for (const child of kids(node)) visit(child);
  };
  for (const root of roots) visit(root);
}

function styleChain(context: OdtContext, name: string | undefined, family: 'text' | 'paragraph'): StyleRecord[] {
  const result: StyleRecord[] = [];
  let current = name;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const rec = context.styles.get(current);
    if (!rec) break;
    if (!rec.family || rec.family === family || rec.family === 'both') result.push(rec);
    current = rec.parent;
  }
  return result.reverse();
}

interface OdfRunStyle {
  bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean;
  color?: string; background?: string; sizePt?: number; font?: string;
  superscript?: boolean; subscript?: boolean;
}

function mergeTextProps(context: OdtContext, styleName: string | undefined): OdfRunStyle {
  const style: OdfRunStyle = {};
  for (const rec of styleChain(context, styleName, 'text')) {
    const p = rec.text || {};
    const weight = p['fo:font-weight'];
    if (weight) style.bold = weight === 'bold' || Number(weight) >= 600;
    if (p['fo:font-style']) style.italic = p['fo:font-style'] === 'italic' || p['fo:font-style'] === 'oblique';
    if (p['fo:text-decoration']) {
      style.underline = /underline/.test(p['fo:text-decoration']);
      style.strike = /line-through/.test(p['fo:text-decoration']);
    }
    if (p['style:text-underline-style'] && p['style:text-underline-style'] !== 'none') style.underline = true;
    if (p['style:text-line-through-style'] && p['style:text-line-through-style'] !== 'none') style.strike = true;
    if (p['fo:color']) style.color = odfColor(p['fo:color']);
    if (p['fo:background-color']) style.background = odfColor(p['fo:background-color']);
    if (p['fo:font-size']) style.sizePt = parseLengthPt(p['fo:font-size']);
    const fontName = p['style:font-name'];
    if (fontName && context.fonts.has(fontName)) style.font = context.fonts.get(fontName);
    else if (p['fo:font-family']) style.font = p['fo:font-family'].replace(/^['"]|['"]$/g, '').split(',')[0];
    const position = p['style:text-position'];
    if (position) {
      if (/super/i.test(position)) style.superscript = true;
      if (/sub/i.test(position)) style.subscript = true;
    }
  }
  return style;
}

interface OdfParaStyle {
  align?: string; marginLeftPt?: number; marginRightPt?: number; textIndentPt?: number;
  marginTopPt?: number; marginBottomPt?: number; lineHeight?: number; background?: string;
  pageBreakBefore?: boolean;
}

function mergeParaProps(context: OdtContext, styleName: string | undefined): OdfParaStyle {
  const style: OdfParaStyle = {};
  for (const rec of styleChain(context, styleName, 'paragraph')) {
    const p = rec.paragraph || {};
    if (p['fo:text-align']) {
      const a = p['fo:text-align'];
      style.align = a === 'end' ? 'right' : a === 'center' ? 'center' : a === 'justify' ? 'justify' : 'left';
    }
    if (p['fo:margin-left']) style.marginLeftPt = parseLengthPt(p['fo:margin-left']);
    if (p['fo:margin-right']) style.marginRightPt = parseLengthPt(p['fo:margin-right']);
    if (p['fo:text-indent']) style.textIndentPt = parseLengthPt(p['fo:text-indent']);
    if (p['fo:margin-top']) style.marginTopPt = parseLengthPt(p['fo:margin-top']);
    if (p['fo:margin-bottom']) style.marginBottomPt = parseLengthPt(p['fo:margin-bottom']);
    if (p['fo:background-color']) style.background = odfColor(p['fo:background-color']);
    if (p['style:page-break-before'] === 'always' || p['fo:break-before'] === 'page') style.pageBreakBefore = true;
    const line = p['style:line-height'];
    if (line) {
      if (line.endsWith('%')) style.lineHeight = parseFloat(line) / 100;
      else if (/^[\d.]+$/.test(line)) style.lineHeight = Number(line);
      else style.lineHeight = parseLengthPt(line) / parseLengthPt('12pt');
    }
  }
  return style;
}

function wrapOdfRun(html: string, style: OdfRunStyle): string {
  if (!html) return html;
  const css: string[] = [];
  if (style.font) css.push(`font-family:${style.font.replace(/[;"'{}]/g, '')}`);
  if (style.sizePt) css.push(`font-size:${Math.round(style.sizePt * 10) / 10}pt`);
  if (style.color) css.push(`color:${style.color}`);
  if (style.background) css.push(`background-color:${style.background}`);
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

function paraStyleHtml(style: OdfParaStyle): string {
  const css: string[] = [];
  if (style.align && style.align !== 'left') css.push(`text-align:${style.align}`);
  if (style.marginLeftPt) css.push(`margin-left:${style.marginLeftPt}pt`);
  if (style.marginRightPt) css.push(`margin-right:${style.marginRightPt}pt`);
  if (style.textIndentPt) css.push(`text-indent:${style.textIndentPt}pt`);
  if (style.marginTopPt) css.push(`margin-top:${style.marginTopPt}pt`);
  if (style.marginBottomPt) css.push(`margin-bottom:${style.marginBottomPt}pt`);
  if (style.lineHeight) css.push(`line-height:${style.lineHeight.toFixed(2)}`);
  if (style.background) css.push(`background-color:${style.background}`);
  return css.length ? ` style="${css.join(';')}"` : '';
}

async function imageFromFrame(context: OdtContext, frame: X): Promise<string> {
  const image = named(frame, 'draw:image');
  if (!image) {
    const textBox = named(frame, 'draw:text-box');
    if (textBox) {
      const inner = await odtBlocks(context, kids(textBox));
      return `<div data-auren-textbox="true">${inner}</div>`;
    }
    return '';
  }
  const href = attr(image, 'xlink:href') || '';
  if (!href) return '';
  const cached = context.media.get(href);
  if (cached) return cached;
  const file = context.zip.file(href);
  if (!file) return '';
  const ext = path.extname(href).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.svg' ? 'image/svg+xml' : ext === '.gif' ? 'image/gif' : ext === '.bmp' ? 'image/bmp' : 'image/png';
  const data = await file.async('base64');
  const src = `data:${mime};base64,${data}`;
  const width = parseLengthPx(attr(frame, 'svg:width')) || parseLengthPx(attr(frame, 'fo:width')) || 320;
  const height = parseLengthPx(attr(frame, 'svg:height')) || parseLengthPx(attr(frame, 'fo:height')) || 200;
  const alt = attr(named(frame, 'svg:desc'), '') || attr(frame, 'draw:name') || '';
  const result = `<img src="${src}" width="${Math.round(width)}" height="${Math.round(height)}" alt="${escapeHtml(alt)}">`;
  context.media.set(href, result);
  return result;
}

async function inlineHtml(context: OdtContext, nodes: X[]): Promise<string> {
  let out = '';
  for (const node of nodes) {
    const tag = tagOf(node);
    if (tag === '#text') {
      const text = String(node['#text'] ?? '');
      out += escapeHtml(text);
    } else if (tag === 'text:span') {
      const style = mergeTextProps(context, attr(node, 'text:style-name'));
      out += wrapOdfRun(await inlineHtml(context, kids(node)), style);
    } else if (tag === 'text:a') {
      const href = attr(node, 'xlink:href') || '#';
      out += `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${await inlineHtml(context, kids(node))}</a>`;
    } else if (tag === 'text:s') {
      const count = Number(attr(node, 'text:c') || 1);
      out += '&nbsp;'.repeat(Math.max(1, count));
    } else if (tag === 'text:tab') {
      out += '&nbsp;&nbsp;&nbsp;&nbsp;';
    } else if (tag === 'text:line-break') {
      out += '<br>';
    } else if (tag === 'text:bookmark' || tag === 'text:bookmark-start' || tag === 'text:bookmark-end') {
      // ignore
    } else if (tag === 'text:note') {
      context.noteIndex++;
      const noteBody = named(node, 'text:note-body');
      const noteText = noteBody ? textOf(noteBody).replace(/\s+/g, ' ').trim() : '';
      out += `<footnote data-text="${escapeHtml(noteText)}">${context.noteIndex}</footnote>`;
    } else if (tag === 'draw:frame') {
      out += await imageFromFrame(context, node);
    } else if (tag === 'draw:a') {
      const href = attr(node, 'xlink:href') || '';
      out += `<a href="${escapeHtml(href)}">${await inlineHtml(context, kids(node))}</a>`;
    } else if (tag === 'office:annotation') {
      // ignore comments
    } else if (tag === 'text:ruby' || tag === 'text:ruby-text') {
      out += await inlineHtml(context, kids(node));
    } else {
      out += await inlineHtml(context, kids(node));
    }
  }
  return out;
}

async function listToHtml(context: OdtContext, list: X): Promise<string> {
  const styleName = attr(list, 'text:style-name');
  const ordered = styleName ? Boolean(context.listStyles.get(styleName)) : false;
  const tag = ordered ? 'ol' : 'ul';
  let html = `<${tag}>`;
  for (const item of namedAll(list, 'text:list-item')) {
    let content = '';
    for (const child of kids(item)) {
      const t = tagOf(child);
      if (t === 'text:p' || t === 'text:h') {
        const paraStyle = mergeParaProps(context, attr(child, 'text:style-name'));
        const inline = await inlineHtml(context, kids(child));
        content += `${inline}${paraStyle.align ? '' : ''}`;
      } else if (t === 'text:list') {
        content += await listToHtml(context, child);
      }
    }
    html += `<li>${content || '<br>'}</li>`;
  }
  html += `</${tag}>`;
  return html;
}

async function tableToHtml(context: OdtContext, table: X): Promise<string> {
  let html = '<table style="border-collapse:collapse;width:100%"><tbody>';
  for (const row of namedAll(table, 'table:table-row')) {
    html += '<tr>';
    for (const cell of kids(row)) {
      const tag = tagOf(cell);
      if (tag === 'table:covered-table-cell') continue;
      if (tag !== 'table:table-cell') continue;
      const colspan = Number(attr(cell, 'table:number-columns-spanned') || 1);
      const rowspan = Number(attr(cell, 'table:number-rows-spanned') || 1);
      const styleName = attr(cell, 'table:style-name');
      const cellStyle = context.styles.get(styleName || '');
      const css = ['border:1px solid #d5d3df', 'padding:6pt 8pt', 'vertical-align:top'];
      if (cellStyle?.tableCell?.['fo:background-color']) {
        const bg = odfColor(cellStyle.tableCell['fo:background-color']);
        if (bg) css.push(`background-color:${bg}`);
      }
      const attrs = `${colspan > 1 ? ` colspan="${colspan}"` : ''}${rowspan > 1 ? ` rowspan="${rowspan}"` : ''} style="${css.join(';')}"`;
      html += `<td${attrs}>${await odtBlocks(context, kids(cell))}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table><p></p>';
  return html;
}

async function odtBlocks(context: OdtContext, nodes: X[]): Promise<string> {
  let html = '';
  for (const node of nodes) {
    const tag = tagOf(node);
    if (tag === 'text:p') {
      const style = mergeParaProps(context, attr(node, 'text:style-name'));
      if (style.pageBreakBefore) html += '<div data-page-break="true"></div>';
      const inner = await inlineHtml(context, kids(node));
      html += `<p${paraStyleHtml(style)}>${inner || '<br>'}</p>`;
    } else if (tag === 'text:h') {
      const level = Math.max(1, Math.min(6, Number(attr(node, 'text:outline-level') || 1)));
      const style = mergeParaProps(context, attr(node, 'text:style-name'));
      if (style.pageBreakBefore) html += '<div data-page-break="true"></div>';
      const inner = await inlineHtml(context, kids(node));
      html += `<h${level}${paraStyleHtml(style)}>${inner || '<br>'}</h${level}>`;
    } else if (tag === 'text:list') {
      html += await listToHtml(context, node);
    } else if (tag === 'table:table') {
      html += await tableToHtml(context, node);
    } else if (tag === 'text:section') {
      html += await odtBlocks(context, kids(node));
    } else if (tag === 'text:soft-page-break') {
      // A layout artifact, not an author page break.
    } else if (tag === 'office:annotation') {
      // Comments are not imported.
    } else if (tag === 'text:table-of-content') {
      context.warnings.add('An ODT table of contents was imported as static text.');
      html += await odtBlocks(context, kids(node));
    } else if (tag === 'draw:frame' || tag === 'draw:g') {
      html += `<p style="text-align:center">${await imageFromFrame(context, node)}</p>`;
    } else if (tag === 'draw:page-thumbnail') {
      // ignore
    } else if (tag === 'text:sequence-decls' || tag === 'text:variable-decls' || tag === 'text:user-field-decls') {
      // ignore
    } else if (kids(node).length) {
      html += await odtBlocks(context, kids(node));
    }
  }
  return html;
}

function readPageSettings(stylesRoots: X[], context: OdtContext): PageSettings {
  const page: PageSettings = { ...DEFAULT_PAGE_SETTINGS, header: '', footer: '', headerEnabled: false, footerEnabled: false };
  const layouts = new Map<string, X>();
  const visit = (node: X) => {
    if (tagOf(node) === 'style:page-layout') {
      const name = attr(node, 'style:name');
      if (name) layouts.set(name, node);
    }
    for (const child of kids(node)) visit(child);
  };
  for (const root of stylesRoots) visit(root);
  let master: X | undefined;
  const findMaster = (node: X) => {
    if (tagOf(node) === 'style:master-page' && (attr(node, 'style:name') === 'Standard' || !master)) master = node;
    for (const child of kids(node)) findMaster(child);
  };
  for (const root of stylesRoots) findMaster(root);
  const layoutName = attr(master, 'style:page-layout-name');
  const layout = layoutName ? layouts.get(layoutName) : undefined;
  const props = named(layout, 'style:page-layout-properties');
  const w = parseLengthMm(attr(props, 'fo:page-width'), 210);
  const h = parseLengthMm(attr(props, 'fo:page-height'), 297);
  page.widthMm = w;
  page.heightMm = h;
  page.orientation = attr(props, 'style:print-orientation') === 'landscape' || w > h ? 'landscape' : 'portrait';
  const match = Object.entries({ A4: [210, 297], A3: [297, 420], Letter: [215.9, 279.4], Legal: [215.9, 355.6] })
    .find(([, dims]) => Math.abs(dims[0] - Math.min(w, h)) < 2 && Math.abs(dims[1] - Math.max(w, h)) < 2);
  page.size = (match?.[0] as PageSettings['size']) || 'Custom';
  page.marginTop = parseLengthMm(attr(props, 'fo:margin-top'), 20);
  page.marginRight = parseLengthMm(attr(props, 'fo:margin-right'), 20);
  page.marginBottom = parseLengthMm(attr(props, 'fo:margin-bottom'), 20);
  page.marginLeft = parseLengthMm(attr(props, 'fo:margin-left'), 20);
  page.columns = Math.max(1, Math.min(3, Number(attr(props, 'fo:column-count') || 1)));
  const header = named(master, 'style:header');
  const footer = named(master, 'style:footer');
  if (header) {
    page.headerEnabled = true;
    page.header = namedAll(header, 'text:p').map((p) => textOf(p)).join('   ').trim();
  }
  if (footer) {
    page.footerEnabled = true;
    page.footer = namedAll(footer, 'text:p').map((p) => textOf(p)).join('   ').trim();
    if (namedAll(footer, 'text:page-number').length || /page/i.test(page.footer)) page.pageNumbering = true;
  }
  return page;
}

export async function importOdt(buffer: Buffer): Promise<ConversionResult> {
  const zip = await JSZip.loadAsync(buffer);
  const contentFile = zip.file('content.xml');
  if (!contentFile) throw new Error('This file is not a valid OpenDocument text (missing content.xml).');
  const stylesFile = zip.file('styles.xml');
  const contentRoots = parseXml(await contentFile.async('string'));
  const styleRoots = stylesFile ? parseXml(await stylesFile.async('string')) : [];
  const context: OdtContext = {
    styles: new Map(), fonts: new Map(), listStyles: new Map(), zip,
    warnings: new Set(), noteIndex: 0, media: new Map()
  };
  collectStyles(contentRoots, context);
  collectStyles(styleRoots, context);
  const content = contentRoots.find((r) => tagOf(r) === 'office:document-content');
  const body = named(content, 'office:body');
  const text = named(body, 'office:text');
  if (!text) throw new Error('This OpenDocument file contains no text body.');
  let html = await odtBlocks(context, kids(text));
  if (!html.trim()) html = '<p></p>';
  const pageSettings = readPageSettings(styleRoots, context);
  let title = '';
  const meta = zip.file('meta.xml');
  if (meta) {
    try {
      const metaRoots = parseXml(await meta.async('string'));
      const metaRoot = metaRoots.find((r) => tagOf(r) === 'office:document-meta');
      const t = named(named(metaRoot, 'office:meta'), 'dc:title');
      title = t ? textOf(t).trim() : '';
    } catch { /* ignore */ }
  }
  context.warnings.add('Complex ODT layout, shapes, and fields may be simplified during import.');
  return { html, warnings: [...context.warnings], title, pageSettings };
}

/* ------------------------------------------------------------------ ODT export */

interface PMNode { type: string; attrs?: Record<string, any>; content?: PMNode[]; marks?: Array<{ type: string; attrs?: Record<string, any> }>; text?: string }

interface OdtExportState {
  textStyles: Map<string, string>;
  paraStyles: Map<string, string>;
  styleXml: string[];
  fonts: Set<string>;
  images: Map<string, { data: Buffer; ext: string }>;
  headings: PMNode[];
  warnings: Set<string>;
  footnote: number;
}

function collectHeadings(nodes: PMNode[], into: PMNode[]) {
  for (const node of nodes) {
    if (node.type === 'heading') into.push(node);
    if (node.content) collectHeadings(node.content, into);
  }
}

function addFont(state: OdtExportState, font: string | undefined) {
  if (font) state.fonts.add(font.replace(/["']/g, ''));
}

function textStyle(state: OdtExportState, node: PMNode, baseFont: string): string | null {
  const marks = node.marks || [];
  const attrs: string[] = [];
  let font = '';
  let size = 0;
  let color = '';
  let background = '';
  let bold = false; let italic = false; let underline = false; let strike = false;
  let sup = false; let sub = false;
  for (const mark of marks) {
    if (mark.type === 'bold') bold = true;
    if (mark.type === 'italic') italic = true;
    if (mark.type === 'underline') underline = true;
    if (mark.type === 'strike') strike = true;
    if (mark.type === 'superscript') sup = true;
    if (mark.type === 'subscript') sub = true;
    if (mark.type === 'textStyle') {
      const a = mark.attrs || {};
      if (a.fontFamily) font = String(a.fontFamily).replace(/["']/g, '');
      if (a.fontSize) size = parseLengthPt(String(a.fontSize), 0);
      if (a.color) color = String(a.color);
    }
    if (mark.type === 'highlight') background = String(mark.attrs?.color || '');
    if (mark.type === 'code') font = 'Consolas';
  }
  if (bold) attrs.push('fo:font-weight="bold"');
  if (italic) attrs.push('fo:font-style="italic"');
  if (underline) attrs.push('style:text-underline-style="solid"');
  if (strike) attrs.push('style:text-line-through-style="solid"');
  if (sup) attrs.push('style:text-position="super 58%"');
  if (sub) attrs.push('style:text-position="sub 58%"');
  if (color) attrs.push(`fo:color="${quoteAttr(color)}"`);
  if (background) attrs.push(`fo:background-color="${quoteAttr(background)}"`);
  if (size) attrs.push(`fo:font-size="${size}pt"`);
  if (font) {
    addFont(state, font);
    attrs.push(`style:font-name="${quoteAttr(font)}"`);
  }
  if (!attrs.length) return null;
  const key = attrs.join('|');
  if (state.textStyles.has(key)) return state.textStyles.get(key)!;
  const name = `T${state.textStyles.size + 1}`;
  state.textStyles.set(key, name);
  state.styleXml.push(`<style:style style:name="${name}" style:family="text"><style:text-properties ${attrs.join(' ')}/></style:style>`);
  return name;
}

function paraStyle(state: OdtExportState, node: PMNode): string {
  const attrs = node.attrs || {};
  const props: string[] = [];
  if (attrs.textAlign && attrs.textAlign !== 'left') props.push(`fo:text-align="${attrs.textAlign === 'justify' ? 'justify' : attrs.textAlign}"`);
  const indentLeft = Number(attrs.indentLeftPt) || 0;
  const indentRight = Number(attrs.indentRightPt) || 0;
  const textIndent = Number(attrs.textIndentPt) || 0;
  if (indentLeft) props.push(`fo:margin-left="${indentLeft}pt"`);
  if (indentRight) props.push(`fo:margin-right="${indentRight}pt"`);
  if (textIndent) props.push(`fo:text-indent="${textIndent}pt"`);
  if (attrs.marginTopPt) props.push(`fo:margin-top="${Number(attrs.marginTopPt)}pt"`);
  if (attrs.marginBottomPt) props.push(`fo:margin-bottom="${Number(attrs.marginBottomPt)}pt"`);
  if (attrs.lineHeight) props.push(`style:line-height="${Math.round(Number(attrs.lineHeight) * 100)}%"`);
  if (attrs.background) props.push(`fo:background-color="${quoteAttr(String(attrs.background))}"`);
  if (attrs.pageBreakBefore) props.push('fo:break-before="page"');
  if (!props.length) return '';
  const key = props.join('|');
  if (state.paraStyles.has(key)) return state.paraStyles.get(key)!;
  const name = `P${state.paraStyles.size + 1}`;
  state.paraStyles.set(key, name);
  state.styleXml.push(`<style:style style:name="${name}" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties ${props.join(' ')}/></style:style>`);
  return name;
}

function addImage(state: OdtExportState, dataUrl: string): { href: string; width: number; height: number } | null {
  const m = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!m) return null;
  const extMap: Record<string, string> = { png: 'png', jpeg: 'jpg', jpg: 'jpg', gif: 'gif', bmp: 'bmp', webp: 'webp', 'svg+xml': 'svg' };
  const ext = extMap[m[1].toLowerCase()];
  if (!ext) return null;
  const key = dataUrl.length + ':' + dataUrl.slice(-32);
  if (!state.images.has(key)) state.images.set(key, { data: Buffer.from(m[2], 'base64'), ext });
  const index = [...state.images.keys()].indexOf(key) + 1;
  return { href: `Pictures/image${index}.${ext}`, width: 0, height: 0 };
}

function inlineXml(state: OdtExportState, node: PMNode, baseFont: string): string {
  const style = textStyle(state, node, baseFont);
  const wrap = (text: string) => style ? `<text:span text:style-name="${style}">${text}</text:span>` : text;
  if (node.type === 'text') return wrap(escapeHtml(node.text || '').replace(/  /g, ' <text:s/>'));
  if (node.type === 'hardBreak') return '<text:line-break/>';
  if (node.type === 'footnote') {
    state.footnote++;
    const text = String(node.attrs?.text || '');
    return `<text:note text:note-class="footnote" text:id="ftn${state.footnote}"><text:note-citation>${state.footnote}</text:note-citation><text:note-body><text:p>${escapeHtml(text)}</text:p></text:note-body></text:note>`;
  }
  if (node.type === 'equation') {
    return wrap(escapeHtml(String(node.attrs?.latex || '')));
  }
  return '';
}

function inlineXmlAll(state: OdtExportState, nodes: PMNode[], baseFont: string): string {
  let out = '';
  for (const node of nodes) {
    if (node.type === 'text') {
      const marks = node.marks || [];
      const link = marks.find((m) => m.type === 'link');
      const inner = inlineXml(state, node, baseFont);
      if (link?.attrs?.href) out += `<text:a xlink:type="simple" xlink:href="${quoteAttr(String(link.attrs.href))}">${inner}</text:a>`;
      else out += inner;
    } else if (node.type === 'image') {
      const src = String(node.attrs?.src || '');
      const img = addImage(state, src);
      if (img) {
        const widthPx = Number(node.attrs?.width) || 320;
        const heightPx = Number(node.attrs?.height) || 200;
        const widthCm = widthPx * 2.54 / 96;
        const heightCm = heightPx * 2.54 / 96;
        const name = `Image${state.images.size}`;
        out += `<draw:frame draw:name="${name}" text:anchor-type="as-char" svg:width="${widthCm.toFixed(2)}cm" svg:height="${heightCm.toFixed(2)}cm"><draw:image xlink:href="${img.href}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame>`;
      } else {
        state.warnings.add('An image could not be embedded in the ODT export.');
      }
    } else {
      out += inlineXml(state, node, baseFont);
    }
  }
  return out;
}

function odtListXml(state: OdtExportState, node: PMNode, listType: 'bullet' | 'ordered', baseFont: string): string {
  let out = `<text:list text:style-name="${listType === 'ordered' ? 'LOrdered' : 'LBullet'}">`;
  for (const item of node.content || []) {
    out += '<text:list-item>';
    let first = true;
    for (const child of item.content || []) {
      if (child.type === 'paragraph') {
        const prefix = item.type === 'taskItem' ? (item.attrs?.checked ? '☑  ' : '☐  ') : '';
        out += `<text:p${paraStyle(state, child) ? ` text:style-name="${paraStyle(state, child)}"` : ''}>${escapeHtml(prefix)}${inlineXmlAll(state, child.content || [], baseFont)}</text:p>`;
      } else if (child.type === 'bulletList') {
        out += odtListXml(state, child, 'bullet', baseFont);
      } else if (child.type === 'orderedList') {
        out += odtListXml(state, child, 'ordered', baseFont);
      } else if (child.type === 'taskList') {
        out += odtListXml(state, child, 'bullet', baseFont);
      }
    }
    out += '</text:list-item>';
  }
  out += '</text:list>';
  return out;
}

function tableXml(state: OdtExportState, node: PMNode, baseFont: string): string {
  const rows = (node.content || []).filter((n) => n.type === 'tableRow');
  const columnCount = Math.max(1, ...rows.map((r) => (r.content || []).filter((c) => c.type === 'tableCell' || c.type === 'tableHeader').length));
  let out = '<table:table table:name="Table" table:style-name="Table1">';
  for (let c = 0; c < columnCount; c++) out += '<table:table-column table:style-name="TableColumn"/>';
  for (const row of rows) {
    out += '<table:table-row>';
    for (const cell of (row.content || []).filter((c) => c.type === 'tableCell' || c.type === 'tableHeader')) {
      const attrs = cell.attrs || {};
      const span = Number(attrs.colspan) > 1 ? ` table:number-columns-spanned="${Number(attrs.colspan)}"` : '';
      const rspan = Number(attrs.rowspan) > 1 ? ` table:number-rows-spanned="${Number(attrs.rowspan)}"` : '';
      out += `<table:table-cell table:style-name="TableCell" office:value-type="string"${span}${rspan}>`;
      const children = cell.content || [];
      if (!children.length) out += '<text:p/>';
      for (const child of children) {
        if (child.type === 'paragraph') {
          out += `<text:p${paraStyle(state, child) ? ` text:style-name="${paraStyle(state, child)}"` : ''}>${inlineXmlAll(state, child.content || [], baseFont)}</text:p>`;
        } else if (child.type === 'bulletList' || child.type === 'orderedList') {
          out += odtListXml(state, child, child.type === 'orderedList' ? 'ordered' : 'bullet', baseFont);
        } else if (child.type === 'table') {
          out += tableXml(state, child, baseFont);
        } else {
          out += `<text:p><text:span>${escapeHtml(child.text || '')}</text:span></text:p>`;
        }
      }
      out += '</table:table-cell>';
    }
    out += '</table:table-row>';
  }
  out += '</table:table><text:p/>';
  return out;
}

function blockXml(state: OdtExportState, nodes: PMNode[], baseFont: string, context: { quote?: boolean; code?: boolean } = {}): string {
  let out = '';
  for (const node of nodes) {
    const pstyle = paraStyle(state, node);
    const styleAttr = pstyle ? ` text:style-name="${pstyle}"` : '';
    switch (node.type) {
      case 'paragraph':
        out += `<text:p${styleAttr}>${inlineXmlAll(state, node.content || [], baseFont)}</text:p>`;
        break;
      case 'heading': {
        const level = Math.max(1, Math.min(6, Number(node.attrs?.level) || 1));
        out += `<text:h text:outline-level="${level}"${styleAttr}>${inlineXmlAll(state, node.content || [], baseFont)}</text:h>`;
        break;
      }
      case 'bulletList':
        out += odtListXml(state, node, 'bullet', baseFont);
        break;
      case 'orderedList':
        out += odtListXml(state, node, 'ordered', baseFont);
        break;
      case 'taskList':
        out += odtListXml(state, node, 'bullet', baseFont);
        break;
      case 'table':
        out += tableXml(state, node, baseFont);
        break;
      case 'blockquote':
        out += blockXml(state, node.content || [], baseFont, { quote: true });
        break;
      case 'codeBlock': {
        const text = (node.content || []).map((t) => t.text || '').join('');
        out += `<text:p text:style-name="Code">${escapeHtml(text)}</text:p>`;
        break;
      }
      case 'horizontalRule':
        out += '<text:p text:style-name="Rule"/>';
        break;
      case 'pageBreak':
        out += '<text:p text:style-name="PageBreak"/>';
        break;
      case 'image': {
        const img = addImage(state, String(node.attrs?.src || ''));
        if (img) {
          const widthPx = Number(node.attrs?.width) || 320;
          const heightPx = Number(node.attrs?.height) || 200;
          out += `<text:p text:style-name="Image"><draw:frame draw:name="Image${state.images.size}" text:anchor-type="as-char" svg:width="${(widthPx * 2.54 / 96).toFixed(2)}cm" svg:height="${(heightPx * 2.54 / 96).toFixed(2)}cm"><draw:image xlink:href="${img.href}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame></text:p>`;
        }
        break;
      }
      case 'shape': {
        const png = String(node.attrs?.pngDataUrl || '');
        if (png) {
          const img = addImage(state, png);
          if (img) out += `<text:p text:style-name="Image"><draw:frame draw:name="Shape${state.images.size}" text:anchor-type="as-char" svg:width="14cm" svg:height="3cm"><draw:image xlink:href="${img.href}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame></text:p>`;
        }
        break;
      }
      case 'equation':
        out += `<text:p text:style-name="Equation">${escapeHtml(String(node.attrs?.latex || ''))}</text:p>`;
        state.warnings.add('Equations are exported to ODT as equation text.');
        break;
      case 'tableOfContents': {
        for (const h of state.headings) {
          const level = Math.max(1, Math.min(6, Number(h.attrs?.level) || 1));
          out += `<text:p text:style-name="${level > 1 ? 'TocIndent' : 'Toc'}">${escapeHtml(h.content?.map((t) => t.text || '').join('') || '')}</text:p>`;
        }
        state.warnings.add('The table of contents is exported to ODT as static entries without page numbers.');
        break;
      }
      case 'textbox':
      case 'callout':
        out += `<text:p text:style-name="Callout">${inlineXmlAll(state, (node.content || []).flatMap((c) => c.content || []), baseFont)}</text:p>`;
        state.warnings.add('Text boxes are flattened in ODT exports.');
        break;
      case 'caption':
        out += `<text:p text:style-name="Caption">${inlineXmlAll(state, node.content || [], baseFont)}</text:p>`;
        break;
      default:
        if (node.content) out += blockXml(state, node.content, baseFont, context);
    }
  }
  return out;
}

function base64ToZipPath(href: string) {
  return href;
}

function odtHeaderFooterXml(text: string, title: string): string {
  const token = /\{\{(page|pages|total|title)\}\}/g;
  let out = '';
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = token.exec(text))) {
    if (match.index > cursor) out += escapeHtml(text.slice(cursor, match.index));
    if (match[1] === 'page') {
      out += '<text:page-number text:select-page="current">1</text:page-number>';
    } else if (match[1] === 'pages' || match[1] === 'total') {
      out += '<text:page-count>1</text:page-count>';
    } else {
      out += escapeHtml(title);
    }
    cursor = token.lastIndex;
  }
  if (cursor < text.length) out += escapeHtml(text.slice(cursor));
  return out;
}

export async function exportOdt(content: PMNode, title: string, page: PageSettings, defaultFont: string): Promise<{ buffer: Buffer; warnings: string[] }> {
  const state: OdtExportState = {
    textStyles: new Map(), paraStyles: new Map(), styleXml: [],
    fonts: new Set([defaultFont]), images: new Map(), headings: [], warnings: new Set(), footnote: 0
  };
  collectHeadings(content.content || [], state.headings);
  addFont(state, defaultFont);
  const body = blockXml(state, content.content || [], defaultFont);
  const stylesXml = state.styleXml.join('\n');
  const fontFaces = [...state.fonts].map((f) => `<style:font-face style:name="${quoteAttr(f)}" svg:font-family="${quoteAttr(f)}"/>`).join('');
  const dims = page.orientation === 'landscape'
    ? { width: Math.max(page.widthMm, page.heightMm), height: Math.min(page.widthMm, page.heightMm) }
    : { width: Math.min(page.widthMm, page.heightMm), height: Math.max(page.widthMm, page.heightMm) };
  const headerText = page.headerEnabled ? odtHeaderFooterXml(page.header, title) : '';
  const footerText = page.footerEnabled ? odtHeaderFooterXml(page.footer, title) : '';
  const pageNumber = page.footerEnabled && page.pageNumbering && !/\{\{page\}\}/.test(page.footer);
  const headerFooterXml = (headerText || footerText || pageNumber) ? `
    <style:master-page style:name="Standard" style:page-layout-name="pm1">
      ${headerText ? `<style:header><text:p>${headerText}</text:p></style:header>` : ''}
      ${(footerText || pageNumber) ? `<style:footer><text:p>${footerText}${pageNumber ? `${footerText ? '   ·   ' : ''}<text:page-number text:select-page="current">1</text:page-number>` : ''}</text:p></style:footer>` : ''}
    </style:master-page>` : '<style:master-page style:name="Standard" style:page-layout-name="pm1"/>';

  const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" office:version="1.3">
<office:font-face-decls>${fontFaces}</office:font-face-decls>
<office:automatic-styles>
${stylesXml}
<style:style style:name="Standard" style:family="paragraph" style:class="text"><style:paragraph-properties fo:text-align="left"/></style:style>
</office:automatic-styles>
<office:body><office:text>
${body}
</office:text></office:body>
</office:document-content>`;

  const stylesDoc = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" office:version="1.3">
<office:font-face-decls>${fontFaces}</office:font-face-decls>
<office:styles>
<style:default-style style:family="paragraph"><style:paragraph-properties fo:orphans="2" fo:widows="2"/><style:text-properties style:font-name="${quoteAttr(defaultFont)}" fo:font-size="12pt"/></style:default-style>
<style:style style:name="Standard" style:family="paragraph" style:class="text"/>
<style:style style:name="Code" style:family="paragraph"><style:text-properties style:font-name="Consolas" fo:font-size="10pt"/><style:paragraph-properties fo:background-color="#f2f2f6" fo:padding="6pt"/></style:style>
<style:style style:name="Rule" style:family="paragraph"><style:paragraph-properties fo:border-bottom="1pt solid #c9c7d4" fo:margin-top="10pt" fo:margin-bottom="10pt"/></style:style>
<style:style style:name="PageBreak" style:family="paragraph"><style:paragraph-properties fo:break-before="page"/></style:style>
<style:style style:name="Image" style:family="paragraph"><style:paragraph-properties fo:text-align="center"/></style:style>
<style:style style:name="Equation" style:family="paragraph"><style:paragraph-properties fo:text-align="center"/><style:text-properties fo:font-style="italic" style:font-name="Cambria Math"/></style:style>
<style:style style:name="Toc" style:family="paragraph"><style:paragraph-properties fo:margin-bottom="4pt"/></style:style>
<style:style style:name="TocIndent" style:family="paragraph"><style:paragraph-properties fo:margin-left="18pt" fo:margin-bottom="4pt"/></style:style>
<style:style style:name="Callout" style:family="paragraph"><style:paragraph-properties fo:background-color="#f7f5ff" fo:border="1pt solid #ded9ff" fo:padding="8pt"/></style:style>
<style:style style:name="Caption" style:family="paragraph"><style:paragraph-properties fo:text-align="center"/><style:text-properties fo:font-style="italic" fo:font-size="10pt" fo:color="#666677"/></style:style>
<style:style style:name="Table1" style:family="table"><style:table-properties table:border-model="collapsing" fo:width="100%"/></style:style>
<style:style style:name="TableColumn" style:family="table-column"><style:table-column-properties style:column-width="4cm"/></style:style>
<style:style style:name="TableCell" style:family="table-cell"><style:table-cell-properties fo:border="0.5pt solid #d5d3df" fo:padding="4pt"/></style:style>
<text:list-style style:name="LBullet"><text:list-level-style-bullet text:level="1" text:bullet-char="•"/><text:list-level-style-bullet text:level="2" text:bullet-char="◦"/><text:list-level-style-bullet text:level="3" text:bullet-char="▪"/><text:list-level-style-bullet text:level="4" text:bullet-char="•"/><text:list-level-style-bullet text:level="5" text:bullet-char="◦"/></text:list-style>
<text:list-style style:name="LOrdered"><text:list-level-style-number text:level="1" style:num-format="1" style:num-suffix="."/><text:list-level-style-number text:level="2" style:num-format="a" style:num-suffix="."/><text:list-level-style-number text:level="3" style:num-format="i" style:num-suffix="."/><text:list-level-style-number text:level="4" style:num-format="1" style:num-suffix="."/><text:list-level-style-number text:level="5" style:num-format="a" style:num-suffix="."/></text:list-style>
</office:styles>
<office:automatic-styles>
<style:page-layout style:name="pm1">
<style:page-layout-properties fo:page-width="${dims.width}mm" fo:page-height="${dims.height}mm" style:print-orientation="${page.orientation}" fo:margin-top="${page.marginTop}mm" fo:margin-right="${page.marginRight}mm" fo:margin-bottom="${page.marginBottom}mm" fo:margin-left="${page.marginLeft}mm" fo:background-color="#ffffff" style:writing-mode="lr-tb"${page.columns > 1 ? ` fo:column-count="${page.columns}" fo:column-gap="8mm"` : ''}/>
</style:page-layout>
</office:automatic-styles>
<office:master-styles>${headerFooterXml}</office:master-styles>
</office:document-styles>`;

  const now = new Date().toISOString();
  const metaXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" office:version="1.3">
<office:meta><dc:title>${escapeHtml(title)}</dc:title><meta:generator>AUREN 1.0</meta:generator><dc:creator>AUREN</dc:creator><meta:creation-date>${now}</meta:creation-date><dc:date>${now}</dc:date></office:meta>
</office:document-meta>`;

  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">
<manifest:file-entry manifest:full-path="/" manifest:version="1.3" manifest:media-type="application/vnd.oasis.opendocument.text"/>
<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
<manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
${[...state.images.entries()].map(([key, img]) => {
    const index = [...state.images.keys()].indexOf(key) + 1;
    return `<manifest:file-entry manifest:full-path="Pictures/image${index}.${img.ext}" manifest:media-type="image/${img.ext === 'jpg' ? 'jpeg' : img.ext}"/>`;
  }).join('')}
</manifest:manifest>`;

  const zip = new JSZip();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
  zip.file('content.xml', contentXml);
  zip.file('styles.xml', stylesDoc);
  zip.file('meta.xml', metaXml);
  zip.file('META-INF/manifest.xml', manifest);
  const entries = [...state.images.entries()];
  entries.forEach(([, img], idx) => zip.file(`Pictures/image${idx + 1}.${img.ext}`, img.data));
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 }, mimeType: 'application/vnd.oasis.opendocument.text' });
  return { buffer, warnings: [...state.warnings] };
}
