import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import type { BackupInspection } from '../shared/types';

const MAX_BACKUP_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_FILES = 20_000;
const ALLOWED_PREFIXES = ['docs/', 'versions/', 'drafts/', 'templates/'];

function safeRelativePath(entryName: string): string | null {
  const name = entryName.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!name || name.endsWith('/')) return null;
  if (name.startsWith('/') || /^[A-Za-z]:/.test(name)) return null;
  const segments = name.split('/');
  if (segments.some((segment) => segment === '..' || segment === '.' || segment.includes('\u0000'))) return null;
  if (name !== 'library.db' && name !== 'AUREN-BACKUP.json' && !ALLOWED_PREFIXES.some((prefix) => name.startsWith(prefix))) return null;
  return segments.join('/');
}

async function readArchive(filePath: string): Promise<JSZip> {
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) throw new Error('The selected path is not a file.');
  if (stat.size > MAX_BACKUP_BYTES) throw new Error('This backup is too large to restore (2 GB limit).');
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
  if (names.length > MAX_FILES) throw new Error('This backup contains too many files.');
  if (!names.some((name) => name === 'docs/' || name.startsWith('docs/'))) {
    throw new Error('This does not look like an AUREN library backup: the documents folder is missing.');
  }
  return zip;
}

async function collectInfo(filePath: string, zip: JSZip, names: string[]): Promise<BackupInspection> {
  const count = (prefix: string) => names.filter((name) => name.startsWith(prefix) && name.endsWith('.json')).length;
  const manifestEntry = zip.file('AUREN-BACKUP.json');
  if (!manifestEntry) throw new Error('This backup is missing its AUREN manifest.');
  let manifest: { app?: string; version?: number; createdAt?: number; encrypted?: boolean };
  try {
    manifest = JSON.parse(await manifestEntry.async('string'));
  } catch {
    throw new Error('The AUREN backup manifest could not be read.');
  }
  if (manifest.app !== 'Auren' || manifest.version !== 1) {
    throw new Error('This backup was created by an incompatible AUREN version.');
  }
  return {
    path: filePath,
    createdAt: Number(manifest.createdAt) || null,
    documents: count('docs/'),
    versions: count('versions/'),
    drafts: count('drafts/'),
    templates: count('templates/'),
    encrypted: Boolean(manifest.encrypted)
  };
}

export async function inspectBackup(filePath: string): Promise<BackupInspection> {
  const zip = await readArchive(filePath);
  const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
  const info = await collectInfo(filePath, zip, names);
  const firstDoc = names.find((name) => name.startsWith('docs/') && name.endsWith('.json'));
  if (firstDoc) {
    const raw = await zip.file(firstDoc)!.async('string');
    try {
      info.encrypted = Boolean(JSON.parse(raw)?.__aurenEncrypted);
    } catch {
      info.encrypted = Boolean(info.encrypted);
    }
  }
  return info;
}

export async function extractBackup(filePath: string, destination: string): Promise<BackupInspection> {
  const zip = await readArchive(filePath);
  const entries = Object.entries(zip.files).filter(([, entry]) => !entry.dir);
  const names = entries.map(([name]) => name);
  const info = await collectInfo(filePath, zip, names);
  let bytes = 0;
  for (const [entryName, entry] of entries) {
    const relative = safeRelativePath(entryName);
    if (!relative) throw new Error(`The backup contains an unsupported path: ${entryName}`);
    const data = await entry.async('nodebuffer');
    bytes += data.length;
    if (bytes > MAX_BACKUP_BYTES) throw new Error('This backup expands beyond the 2 GB limit.');
    const target = path.join(destination, ...relative.split('/'));
    const parent = path.dirname(target);
    if (!parent.startsWith(destination + path.sep) && parent !== destination) {
      throw new Error('The backup contains an unsafe path.');
    }
    fs.mkdirSync(parent, { recursive: true });
    fs.writeFileSync(target, data);
  }
  const firstDoc = names.find((name) => name.startsWith('docs/') && name.endsWith('.json'));
  if (firstDoc) {
    const raw = await zip.file(firstDoc)!.async('string');
    try {
      info.encrypted = Boolean(JSON.parse(raw)?.__aurenEncrypted);
    } catch {
      // The manifest flag is used when no payload can be inspected.
    }
  }
  return info;
}
