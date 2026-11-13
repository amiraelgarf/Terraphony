/**
 * Local-only persistence (no server, no account): the unfinished drafts and the
 * visitor's shelf of pressed records. Every access is guarded — private windows
 * or blocked storage simply mean nothing is remembered.
 */
import type { EarthRecord } from '../data/types';
import type { LandDraft, OceanDraft } from './recordMachine';

const DRAFT_KEY = 'earth-records:draft:v1';
const SHELF_KEY = 'earth-records:shelf:v1';
export const SHELF_LIMIT = 12;

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const loadDrafts = () => read<{ ocean?: Partial<OceanDraft>; land?: Partial<LandDraft> }>(DRAFT_KEY);
export const saveDrafts = (ocean: OceanDraft, land: LandDraft) => write(DRAFT_KEY, { ocean, land });
export const loadShelf = () => (read<EarthRecord[]>(SHELF_KEY) ?? []).filter((r) => r && r.schemaVersion === '1.0');
export const saveShelf = (records: EarthRecord[]) => write(SHELF_KEY, records.slice(0, SHELF_LIMIT));
