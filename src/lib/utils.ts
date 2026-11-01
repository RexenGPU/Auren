import { useAppStore } from '../store/app';
import { translate } from './i18n';

export function useT() {
  const language = useAppStore((state) => state.settings?.language ?? 'en');
  return (key: string, vars?: Record<string, string | number>) => translate(language, key, vars);
}

export function formatDate(timestamp: number, language: 'en' | 'fr', style: 'short' | 'long' | 'time' = 'short'): string {
  const locale = language === 'fr' ? 'fr-FR' : 'en-US';
  const date = new Date(timestamp);
  if (style === 'time') {
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
  }
  if (style === 'long') {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(date);
  }
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(locale, sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

export function timeAgo(timestamp: number, language: 'en' | 'fr'): string {
  const delta = Date.now() - timestamp;
  const locale = language === 'fr' ? 'fr-FR' : 'en-US';
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;
  if (delta < 45_000) return language === 'fr' ? 'à l’instant' : 'just now';
  if (delta < hour) return rtf.format(-Math.max(1, Math.round(delta / minute)), 'minute');
  if (delta < day) return rtf.format(-Math.max(1, Math.round(delta / hour)), 'hour');
  if (delta < day * 7) return rtf.format(-Math.max(1, Math.round(delta / day)), 'day');
  return formatDate(timestamp, language);
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function greetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'view.home.greeting.morning';
  if (hour < 18) return 'view.home.greeting.afternoon';
  return 'view.home.greeting.evening';
}

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function countWords(text: string): number {
  const matches = text.trim().match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu);
  return matches ? matches.length : 0;
}

export function plainText(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || '').replace(/\s+/g, ' ').trim();
}

export function relativeDay(timestamp: number, language: 'en' | 'fr'): string {
  const date = new Date(timestamp);
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (timestamp >= start) return language === 'fr' ? 'Aujourd’hui' : 'Today';
  if (timestamp >= start - 86_400_000) return language === 'fr' ? 'Hier' : 'Yesterday';
  if (timestamp >= start - 6 * 86_400_000) return language === 'fr' ? 'Cette semaine' : 'This week';
  return language === 'fr' ? 'Plus tôt' : 'Earlier';
}
