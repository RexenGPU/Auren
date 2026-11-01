import {
  AlignmentType,
  BorderStyle,
  convertMillimetersToTwip,
  Document,
  ExternalHyperlink,
  Footer,
  FootnoteReferenceRun,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  PageBreak,
  PageNumber,
  PageOrientation,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  UnderlineType,
  VerticalAlign,
  WidthType,
  type ParagraphChild
} from 'docx';
import { imageSize } from 'image-size';
import type { PageSettings } from '../../shared/types';
import { pageDimensionsMm } from '../../shared/types';

interface PMMark { type: string; attrs?: Record<string, any> }
interface PMNode { type: string; attrs?: Record<string, any>; content?: PMNode[]; marks?: PMMark[]; text?: string }

interface DocxExportInput {
  title: string;
  content: PMNode;
  pageSettings: PageSettings;
  defaultFont: string;
  defaultFontSize: number;
  createdAt?: number;
  updatedAt?: number;
}

interface ExportOutput {
  buffer: Buffer;
  warnings: string[];
}

const HEADING_LEVELS = [
  HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6
];
const HEADING_SIZES_PT = [28, 22, 18, 15, 13, 12];

function parsePt(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (!value) return fallback;
  const str = String(value).trim();
  const num = parseFloat(str);
  if (!Number.isFinite(num)) return fallback;
  if (str.endsWith('px')) return num * 0.75;
  if (str.endsWith('em')) return num * 12;
  return num;
}

function hex(color: unknown): string | undefined {
  if (!color) return undefined;
  const m = String(color).match(/#?([0-9a-fA-F]{6})/);
  return m ? m[1].toUpperCase() : undefined;
}

function markAttrs(marks: PMMark[] | undefined, type: string): Record<string, any> | undefined {
  return marks?.find((m) => m.type === type)?.attrs;
}

function hasMark(marks: PMMark[] | undefined, type: string): boolean {
  return Boolean(marks?.some((m) => m.type === type));
}

function textRun(text: string, marks: PMMark[] | undefined, input: DocxExportInput, headingLevel?: number, base: {italics?: boolean; color?: string; font?: string} = {}): TextRun {
  const style = markAttrs(marks, 'textStyle') || {};
  const fontSize = parsePt(style.fontSize, headingLevel ? HEADING_SIZES_PT[headingLevel - 1] : input.defaultFontSize);
  const font = String(style.fontFamily || base.font || input.defaultFont).replace(/["']/g, '');
  const color = hex(style.color) || base.color;
  const highlight = markAttrs(marks, 'highlight')?.color;
  const options: any = {
    text,
    font,
    size: Math.max(4, Math.round(fontSize * 2)),
    bold: hasMark(marks, 'bold') || Boolean(headingLevel),
    italics: hasMark(marks, 'italic') || base.italics || undefined,
    strike: hasMark(marks, 'strike') || undefined,
    underline: hasMark(marks, 'underline') ? { type: UnderlineType.SINGLE } : undefined,
    superScript: hasMark(marks, 'superscript') || undefined,
    subScript: hasMark(marks, 'subscript') || undefined,
    color: color || undefined
  };
  if (hasMark(marks, 'code')) {
    options.font = 'Consolas';
    options.shading = { type: ShadingType.CLEAR, fill: 'F2F2F5' };
  }
  if (highlight) {
    const fill = hex(highlight);
    if (fill) options.shading = { type: ShadingType.CLEAR, fill };
  }
  (Object.keys(options) as string[]).forEach((k) => options[k] === undefined && delete options[k]);
  return new TextRun(options);
}

function imageTypeFromDataUrl(dataUrl: string): 'png' | 'jpg' | 'gif' | 'bmp' | null {
  const m = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,/);
  if (!m) return null;
  const t = m[1].toLowerCase();
  if (t === 'png') return 'png';
  if (t === 'jpeg' || t === 'jpg') return 'jpg';
  if (t === 'gif') return 'gif';
  if (t === 'bmp') return 'bmp';
  return null;
}

function buildImage(node: PMNode, warnings: Set<string>): ImageRun | null {
  const src = String(node.attrs?.src || '');
  const type = imageTypeFromDataUrl(src);
  if (!type) {
    warnings.add('An image in an unsupported web format could not be embedded in DOCX. Convert it to PNG or JPEG first.');
    return null;
  }
  let width = Number(node.attrs?.width) || 0;
  let height = Number(node.attrs?.height) || 0;
  try {
    if (!width || !height) {
      const buf = Buffer.from(src.split(',')[1] || '', 'base64');
      const size = imageSize(buf);
      width = width || size.width || 320;
      height = height || size.height || 200;
    }
  } catch {
    width = width || 320;
    height = height || 200;
  }
  return new ImageRun({
    type,
    data: src,
    transformation: { width: Math.round(width), height: Math.round(height) },
    altText: { name: String(node.attrs?.alt || 'Image'), description: String(node.attrs?.alt || ''), title: String(node.attrs?.title || '') }
  });
}

interface BuildContext {
  input: DocxExportInput;
  warnings: Set<string>;
  listLevels: number;
  listType: 'bullet' | 'ordered' | null;
}

function inlineChildren(node: PMNode, ctx: BuildContext, headingLevel?: number, base: {italics?: boolean; color?: string} = {}): Array<TextRun | ExternalHyperlink | FootnoteReferenceRun | ImageRun> {
  const out: Array<TextRun | ExternalHyperlink | FootnoteReferenceRun | ImageRun> = [];
  const children = node.content || [];
  for (const child of children) {
    if (child.type === 'hardBreak') {
      out.push(new TextRun({ break: 1 }));
      continue;
    }
    if (child.type === 'footnote') {
      const note = String(child.attrs?.text || '').trim() || 'Footnote';
      out.push(new FootnoteReferenceRun({ children: [new Paragraph({ children: [new TextRun({ text: note, size: 18, font: ctx.input.defaultFont })] })] }));
      continue;
    }
    if (child.type === 'equation') {
      const latex = String(child.attrs?.latex || '');
      out.push(new TextRun({ text: latex ? ` ${latex} ` : ' ', font: 'Cambria Math', italics: true, size: 22 }));
      ctx.warnings.add('Equations are exported to DOCX as editable equation text, not native Word math objects.');
      continue;
    }
    if (child.type === 'image') {
      const img = buildImage(child, ctx.warnings);
      if (img) out.push(img);
      continue;
    }
    if (child.type === 'text' || child.text != null) {
      const text = child.text || '';
      if (!text) continue;
      const marks = child.marks || [];
      const link = marks.find((m) => m.type === 'link');
      const href = link?.attrs?.href;
      const run = textRun(text, marks, ctx.input, headingLevel, base);
      if (link && /^(https?:|mailto:)/i.test(String(href || ''))) {
        out.push(new ExternalHyperlink({ children: [run], link: String(href) }));
      } else {
        out.push(run);
      }
    }
  }
  if (!out.length) out.push(new TextRun({ text: '', font: ctx.input.defaultFont, size: ctx.input.defaultFontSize * 2 }));
  return out;
}

function paragraphOptions(node: PMNode, ctx: BuildContext, headingLevel?: number, list?: { reference: string; level: number }) {
  const attrs = node.attrs || {};
  const styles = node.marks || [];
  const alignMap: Record<string, any> = {
    left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED
  };
  const align = attrs.textAlign && attrs.textAlign !== 'left' ? alignMap[attrs.textAlign] : undefined;
  const lineHeight = Number(attrs.lineHeight) || 0;
  const before = parsePt(attrs.marginTopPt, 0);
  const after = parsePt(attrs.marginBottomPt, 0);
  const indentLeft = parsePt(attrs.indentLeftPt, 0);
  const indentRight = parsePt(attrs.indentRightPt, 0);
  const textIndent = parsePt(attrs.textIndentPt, 0);
  const spacing = (before || after || lineHeight)
    ? { before: Math.round(before * 20), after: Math.round(after * 20), line: lineHeight ? Math.round(lineHeight * 240) : undefined, lineRule: lineHeight ? 'auto' : undefined }
    : undefined;
  const indent = (indentLeft || indentRight || textIndent)
    ? { left: Math.round(indentLeft * 20), right: Math.round(indentRight * 20), firstLine: Math.round(textIndent * 20) }
    : undefined;
  const background = hex(attrs.background);
  const options: any = {
    alignment: align,
    spacing,
    indent,
    heading: headingLevel ? HEADING_LEVELS[headingLevel - 1] : undefined,
    pageBreakBefore: attrs.pageBreakBefore || undefined,
    shading: background ? { type: ShadingType.CLEAR, fill: background } : undefined,
    numbering: list ? { reference: list.reference, level: list.level } : undefined,
    border: attrs.border ? attrs.border : undefined,
    children: []
  };
  (Object.keys(options) as string[]).forEach((k) => (options[k] === undefined) && delete options[k]);
  return options;
}

function textboxToTable(node: PMNode, ctx: BuildContext): Table {
  const inner = convertBlocks(node.content || [], ctx);
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: 'F5F4FF' },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 8, color: '9B8AFB' },
          bottom: { style: BorderStyle.SINGLE, size: 8, color: '9B8AFB' },
          left: { style: BorderStyle.SINGLE, size: 8, color: '9B8AFB' },
          right: { style: BorderStyle.SINGLE, size: 8, color: '9B8AFB' }
        },
        children: inner.length ? tableSafeChildren(inner) : [new Paragraph('')]
      })]
    })]
  });
}

function convertTable(node: PMNode, ctx: BuildContext): Table {
  const rows = (node.content || []).filter((n) => n.type === 'tableRow');
  const tableRows = rows.map((row) => {
    const cells = (row.content || []).filter((n) => n.type === 'tableCell' || n.type === 'tableHeader');
    return new TableRow({
      tableHeader: (row.content || []).some((c) => c.type === 'tableHeader'),
      children: cells.map((cell) => {
        const attrs = cell.attrs || {};
        const background = hex(attrs.backgroundColor || attrs.background);
        const inner = convertBlocks(cell.content || [], ctx);
        return new TableCell({
          columnSpan: Number(attrs.colspan) > 1 ? Number(attrs.colspan) : undefined,
          rowSpan: Number(attrs.rowspan) > 1 ? Number(attrs.rowspan) : undefined,
          shading: background ? { type: ShadingType.CLEAR, fill: background } : undefined,
          verticalAlign: VerticalAlign.TOP,
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: 'D2D2DC' },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D2D2DC' },
            left: { style: BorderStyle.SINGLE, size: 4, color: 'D2D2DC' },
            right: { style: BorderStyle.SINGLE, size: 4, color: 'D2D2DC' }
          },
          children: inner.length ? tableSafeChildren(inner) : [new Paragraph('')]
        });
      })
    });
  });
  return new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

function convertList(node: PMNode, ctx: BuildContext, ordered: boolean): Paragraph[] {
  const out: Paragraph[] = [];
  const reference = ordered ? 'auren-ordered' : 'auren-bullet';
  const level = Math.min(8, ctx.listLevels);
  const items = (node.content || []).filter((n) => n.type === 'listItem' || n.type === 'taskItem');
  for (const item of items) {
    const isTask = item.type === 'taskItem';
    const checked = Boolean(item.attrs?.checked);
    const blocks = (item.content || []);
    let first = true;
    for (const block of blocks) {
      if (block.type === 'paragraph') {
        const options = paragraphOptions(block, ctx, undefined, { reference, level });
        const runs = inlineChildren(block, ctx);
        if (isTask && first) runs.unshift(new TextRun({ text: checked ? '☑  ' : '☐  ', font: 'Segoe UI Symbol', size: ctx.input.defaultFontSize * 2 }));
        options.children = runs;
        out.push(new Paragraph(options));
        first = false;
      } else if (block.type === 'bulletList') {
        out.push(...convertList(block, { ...ctx, listLevels: level + 1 }, false));
      } else if (block.type === 'orderedList') {
        out.push(...convertList(block, { ...ctx, listLevels: level + 1 }, true));
      } else {
        const converted = convertBlocks([block], { ...ctx, listLevels: level + 1 });
        out.push(...converted.filter((n): n is Paragraph => n instanceof Paragraph));
      }
    }
    if (!blocks.length) {
      out.push(new Paragraph({ ...paragraphOptions({ type: 'paragraph' } as PMNode, ctx, undefined, { reference, level }), children: [new TextRun('')] }));
    }
  }
  return out;
}

/** Table cells cannot hold a TableOfContents field, so degrade it to a plain label. */
function tableSafeChildren(nodes: Array<Paragraph | Table | TableOfContents>): Array<Paragraph | Table> {
  return nodes.map((node) => node instanceof TableOfContents
    ? new Paragraph({ children: [new TextRun({ text: 'Contents', bold: true })] })
    : node as Paragraph | Table);
}

function convertBlocks(nodes: PMNode[], ctx: BuildContext): Array<Paragraph | Table | TableOfContents> {
  const out: Array<Paragraph | Table | TableOfContents> = [];
  for (const node of nodes) {
    switch (node.type) {
      case 'paragraph': {
        const options = paragraphOptions(node, ctx);
        options.children = inlineChildren(node, ctx);
        out.push(new Paragraph(options));
        break;
      }
      case 'heading': {
        const level = Math.max(1, Math.min(6, Number(node.attrs?.level) || 1));
        const options = paragraphOptions(node, ctx, level);
        options.children = inlineChildren(node, ctx, level);
        out.push(new Paragraph(options));
        break;
      }
      case 'bulletList':
        out.push(...convertList(node, ctx, false));
        break;
      case 'orderedList':
        out.push(...convertList(node, ctx, true));
        break;
      case 'taskList':
        out.push(...convertList(node, ctx, false));
        break;
      case 'blockquote': {
        for (const child of node.content || []) {
          if (child.type === 'paragraph') {
            const options = paragraphOptions(child, ctx);
            options.children = inlineChildren(child, ctx, undefined, { italics: true });
            options.indent = { ...(options.indent || {}), left: 360 };
            options.border = { left: { style: BorderStyle.SINGLE, size: 18, color: '8B7CF6', space: 8 } };
            out.push(new Paragraph(options));
          } else {
            out.push(...convertBlocks([child], ctx));
          }
        }
        break;
      }
      case 'codeBlock': {
        const text = (node.content || []).map((t) => t.text || '').join('');
        out.push(new Paragraph({
          children: [new TextRun({ text: text || ' ', font: 'Consolas', size: 20, color: '333344' })],
          shading: { type: ShadingType.CLEAR, fill: 'F2F2F6' },
          spacing: { before: 80, after: 80, line: 300 }
        }));
        break;
      }
      case 'horizontalRule':
        out.push(new Paragraph({
          children: [new TextRun('')],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'B9B7C6', space: 1 } },
          spacing: { before: 120, after: 120 }
        }));
        break;
      case 'pageBreak':
        out.push(new Paragraph({ children: [new PageBreak()] }));
        break;
      case 'image': {
        const img = buildImage(node, ctx.warnings);
        if (img) {
          out.push(new Paragraph({
            children: [img],
            alignment: AlignmentType.CENTER,
            spacing: { before: 120, after: 120 }
          }));
        }
        break;
      }
      case 'shape': {
        const png = String(node.attrs?.pngDataUrl || '');
        if (png) {
          const img = buildImage({ ...node, type: 'image', attrs: { src: png, width: node.attrs?.width || 520, height: node.attrs?.height || 120, alt: node.attrs?.alt || 'Decorative shape' } }, ctx.warnings);
          if (img) out.push(new Paragraph({ children: [img], alignment: AlignmentType.CENTER }));
        } else {
          ctx.warnings.add('A decorative shape could not be exported to DOCX.');
        }
        break;
      }
      case 'table':
        out.push(convertTable(node, ctx));
        break;
      case 'textbox':
      case 'callout':
        out.push(textboxToTable(node, ctx));
        out.push(new Paragraph({ children: [new TextRun('')] }));
        ctx.warnings.add('Text boxes are exported as styled tables for Word compatibility.');
        break;
      case 'tableOfContents':
        out.push(new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-3' }));
        break;
      case 'equation':
        out.push(new Paragraph({
          children: [new TextRun({ text: String(node.attrs?.latex || ''), font: 'Cambria Math', italics: true, size: 24 })],
          alignment: AlignmentType.CENTER
        }));
        ctx.warnings.add('Equations are exported to DOCX as editable equation text.');
        break;
      case 'caption': {
        const options = paragraphOptions(node, ctx);
        options.children = inlineChildren(node, ctx, undefined, { italics: true, color: '666677' });
        options.alignment = AlignmentType.CENTER;
        out.push(new Paragraph(options));
        break;
      }
      case 'orderedListItem':
      case 'listItem':
      case 'taskItem':
        out.push(...convertBlocks([{ type: 'paragraph', content: node.content }], ctx));
        break;
      default: {
        if (node.type === 'text') break;
        if (node.content?.length) out.push(...convertBlocks(node.content, ctx));
      }
    }
  }
  return out;
}

function pageTokenRuns(text: string, input: DocxExportInput): Array<TextRun> {
  const runs: TextRun[] = [];
  const token = /\{\{(page|pages|total|title)\}\}/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = token.exec(text))) {
    if (match.index > cursor) {
      runs.push(new TextRun({ text: text.slice(cursor, match.index), size: 17, color: '7C7C8A', font: input.defaultFont }));
    }
    const field = match[1];
    if (field === 'page') {
      runs.push(new TextRun({ children: [PageNumber.CURRENT], size: 17, color: '7C7C8A', font: input.defaultFont }));
    } else if (field === 'pages' || field === 'total') {
      runs.push(new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 17, color: '7C7C8A', font: input.defaultFont }));
    } else {
      runs.push(new TextRun({ text: input.title, size: 17, color: '7C7C8A', font: input.defaultFont }));
    }
    cursor = token.lastIndex;
  }
  if (cursor < text.length) {
    runs.push(new TextRun({ text: text.slice(cursor), size: 17, color: '7C7C8A', font: input.defaultFont }));
  }
  return runs;
}

export async function exportDocx(input: DocxExportInput): Promise<ExportOutput> {
  const warnings = new Set<string>();
  const ctx: BuildContext = { input, warnings, listLevels: 0, listType: null };
  const body = convertBlocks(input.content?.content || [], ctx);
  const page = pageDimensionsMm(input.pageSettings);
  const contentWidth = page.width - input.pageSettings.marginLeft - input.pageSettings.marginRight;

  const headerRuns = input.pageSettings.headerEnabled
    ? pageTokenRuns(input.pageSettings.header || '', input)
    : [];
  const footerRuns: TextRun[] = [];
  if (input.pageSettings.footerEnabled && input.pageSettings.footer) footerRuns.push(...pageTokenRuns(input.pageSettings.footer, input));
  if (input.pageSettings.footerEnabled && input.pageSettings.pageNumbering) {
    if (footerRuns.length) footerRuns.push(new TextRun({ text: '    ·    ', size: 17, color: '7C7C8A', font: input.defaultFont }));
    footerRuns.push(new TextRun({ children: [PageNumber.CURRENT], size: 17, color: '7C7C8A', font: input.defaultFont }));
    footerRuns.push(new TextRun({ text: ' / ', size: 17, color: '7C7C8A', font: input.defaultFont }));
    footerRuns.push(new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 17, color: '7C7C8A', font: input.defaultFont }));
  }

  const numbering = {
    config: [
      {
        reference: 'auren-bullet',
        levels: Array.from({ length: 9 }, (_, level) => ({
          level,
          format: LevelFormat.BULLET,
          text: level === 0 ? '•' : level === 1 ? '◦' : '▪',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 360 + level * 360, hanging: 260 } } }
        }))
      },
      {
        reference: 'auren-ordered',
        levels: Array.from({ length: 9 }, (_, level) => ({
          level,
          format: LevelFormat.DECIMAL,
          text: level === 0 ? '%1.' : level === 1 ? '%2.' : `%${level + 1}.`,
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 360 + level * 360, hanging: 260 } } }
        }))
      }
    ]
  };

  const doc = new Document({
    title: input.title,
    creator: 'AUREN',
    lastModifiedBy: 'AUREN',
    description: 'Created with AUREN — Create without limits.',
    features: { updateFields: true },
    numbering,
    styles: {
      default: {
        document: {
          run: { font: input.defaultFont, size: input.defaultFontSize * 2, color: '22222A' }
        }
      }
    },
    sections: [{
      properties: {
        page: {
          size: {
            width: convertMillimetersToTwip(page.width),
            height: convertMillimetersToTwip(page.height),
            orientation: page.width > page.height ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT
          },
          margin: {
            top: convertMillimetersToTwip(input.pageSettings.marginTop),
            right: convertMillimetersToTwip(input.pageSettings.marginRight),
            bottom: convertMillimetersToTwip(input.pageSettings.marginBottom),
            left: convertMillimetersToTwip(input.pageSettings.marginLeft),
            header: 600,
            footer: 600
          }
        },
        column: input.pageSettings.columns > 1 ? { count: input.pageSettings.columns, space: 720, equalWidth: true } : undefined
      },
      headers: input.pageSettings.headerEnabled || input.pageSettings.pageNumbering ? {
        default: new Header({
          children: [new Paragraph({
            children: headerRuns.length ? headerRuns : [new TextRun({ text: input.title, size: 17, color: '7C7C8A', font: input.defaultFont })],
            alignment: AlignmentType.RIGHT,
            border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'E2E1EC', space: 4 } }
          })]
        })
      } : undefined,
      footers: input.pageSettings.footerEnabled || input.pageSettings.pageNumbering ? {
        default: new Footer({
          children: [new Paragraph({
            children: footerRuns.length ? footerRuns : [new TextRun({ text: ' ', size: 17 })],
            alignment: AlignmentType.CENTER
          })]
        })
      } : undefined,
      children: body.length ? body : [new Paragraph('')]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  if (body.length === 0) warnings.add('The document was empty when exported.');
  if (contentWidth <= 20) warnings.add('Page margins leave very little content width.');
  return { buffer, warnings: [...warnings] };
}
