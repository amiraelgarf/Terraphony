/**
 * Side C — A Landscape Interrupted (Dixie Fire, 2021). PLANNED, not playable.
 * Becomes playable only after per-12-hour active-fire counts for the event
 * polygon (VIIRS/MODIS, confidence-filtered, de-duplicated) are integrated and reviewed.
 */
export const FIRE_COPY = {
  side: 'C',
  name: 'A Landscape Interrupted',
  eyebrow: 'Side C / A documented event',
  heading: ['When a place', 'changes.'],
  libraryLine: 'Examine the changing satellite observations during a documented wildfire.',
  question: 'What did the satellites detect, window by window?',
  status: 'In preparation',
  svs: 'https://svs.gsfc.nasa.gov/4993/',
  firms: 'https://firms.modaps.eosdis.nasa.gov/',
  needs: [
    'A defined event polygon and 12-hour windows matching the SVS 4993 visualization (14 Jul – 22 Oct 2021).',
    'VIIRS 375 m active-fire detections with a declared confidence filter and duplicate handling.',
    'A separate burned-area product if burned area is sonified — never equated with detection counts.',
    'A science and ethics review of the copy: the event affected real communities.',
  ],
};
