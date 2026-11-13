/**
 * Hash routing: #/ · #/story/<chapter> · #/explore · #/compare · #/method
 * Hash routes make every view deep-linkable and survive refresh on any static host.
 */
import { CHAPTERS, type ChapterId } from '../content/story.en';
import type { AppRoute } from './state';

export type ParsedRoute = { route: AppRoute; chapter?: ChapterId };

export function parseHash(hash: string): ParsedRoute {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  switch (parts[0]) {
    case 'story': {
      const c = CHAPTERS.find((x) => x.id === parts[1]);
      return { route: 'story', chapter: c && c.id !== 'threshold' ? c.id : 'language' };
    }
    case 'explore':
    case 'compare':
    case 'method':
      return { route: parts[0] };
    default:
      return { route: 'entry' };
  }
}

export function toHash(route: AppRoute, chapter: ChapterId): string {
  if (route === 'entry') return '#/';
  if (route === 'story') return `#/story/${chapter}`;
  return `#/${route}`;
}
