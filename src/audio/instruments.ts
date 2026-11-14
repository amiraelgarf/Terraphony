/**
 * Instrument characters and mixer layers (metadata only; the sound itself is
 * rendered in dsp.ts). Art changes TIMBRE, never the measurement-to-pitch rule.
 *
 *   glass  Glass & tide  celesta solo with strings, horns and harp
 *   wood   Wood & earth  marimba solo with strings, horns and harp
 *   felt   Felt & dusk   felt-piano solo with dark strings and harp
 *
 * Five mixer layers (one rendered stem each; mute / solo are instant):
 *   lead     data: the melody (solo + violins)
 *   bass     data: the block mean (basses)
 *   harmony  strings, horns, harp, timpani — derived, add no data
 *   accent   data: declared changes (glockenspiel)
 *   cadence  ARTISTIC: the closing chord
 */
import type { InstrumentId } from '../data/types';

export type Layer = 'lead' | 'bass' | 'harmony' | 'accent' | 'cadence';
export const LAYERS: Layer[] = ['lead', 'bass', 'harmony', 'accent', 'cadence'];
export const ALL_LAYERS_ON: Record<Layer, boolean> = { lead: true, bass: true, harmony: true, accent: true, cadence: true };

export const PALETTES: { id: InstrumentId; name: string; description: string }[] = [
  { id: 'glass', name: 'Glass & tide', description: 'Celesta solo with strings, horns and harp' },
  { id: 'wood', name: 'Wood & earth', description: 'Marimba solo with strings, horns and harp' },
  { id: 'felt', name: 'Felt & dusk', description: 'Felt piano solo with dark strings and harp' },
];
export const paletteName = (id: InstrumentId) => PALETTES.find((p) => p.id === id)?.name ?? id;
