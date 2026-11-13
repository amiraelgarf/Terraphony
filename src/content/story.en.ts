/**
 * Story copy for "Ocean in Motion — The Current Beneath the Surface".
 *
 * Editorial sentences only. Real timestamps, values, notes and deltas are
 * injected at run time from the manifest and the computed events — never
 * written here. Narration has a variant per fidelity mode; this build runs in
 * visual-frame mode, so `visual` lines are the ones shown.
 */

export type ChapterId = 'threshold' | 'language' | 'passage' | 'microscope' | 'contrast' | 'handover' | 'coda';

export type StoryChapter = {
  id: ChapterId;
  number: string;
  title: string;
  eyebrow: string;
  caption: string;
  narration?: { model: string; visual: string };
  sceneCue: 'reveal-source' | 'show-legend' | 'scan-route' | 'inspect-event' | 'compare-frames' | 'enable-tools' | 'finale';
  userMaySkip: boolean;
  nextAction: string;
};

export const STORY_TITLE = 'Ocean in Motion';
export const STORY_SUBTITLE = 'The current beneath the surface';

export const CHAPTERS: StoryChapter[] = [
  {
    id: 'threshold',
    number: '00',
    title: 'A different way to encounter Earth',
    eyebrow: 'Earth Information Jukebox',
    caption: 'There is more than one way to understand a moving ocean.',
    narration: {
      model: 'We often study our planet through images. Today, let’s try listening to one.',
      visual: 'We often study our planet through images. Today, let’s try listening to one.',
    },
    sceneCue: 'reveal-source',
    userMaySkip: true,
    nextAction: 'Begin listening',
  },
  {
    id: 'language',
    number: '01',
    title: 'Colors are not sound',
    eyebrow: 'Learning the language',
    caption: 'What determines a note? Where a colour sits on NASA’s legend is mapped to a fixed musical scale. Further along the legend, higher in the scale.',
    narration: {
      model: 'These colors represent the ocean’s surface temperature. The moving traces reveal currents in a model built from observations. We’re turning selected measurements into musical notes.',
      visual: 'These colors and moving traces come from a NASA visualization of ocean currents and temperature. Our instrument reads the displayed patterns and translates them into music.',
    },
    sceneCue: 'show-legend',
    userMaySkip: true,
    nextAction: 'Continue',
  },
  {
    id: 'passage',
    number: '02',
    title: 'Follow one line across the ocean',
    eyebrow: 'The first passage',
    caption: 'Each step changes the place we’re listening to. Each note can be traced to the source.',
    narration: {
      model: 'We’ll follow one path. Each step changes the place we’re listening to, and each note corresponds to what the model tells us there.',
      visual: 'We’ll follow one path. Each step changes the place we’re listening to, and each note corresponds to what the visualization shows there.',
    },
    sceneCue: 'scan-route',
    userMaySkip: true,
    nextAction: 'Skip to the microscope',
  },
  {
    id: 'microscope',
    number: '03',
    title: 'Where did that note come from?',
    eyebrow: 'The microscope',
    caption: 'You heard a shift. Let’s find the point that shaped it.',
    narration: {
      model: 'You heard a shift. Let’s find the point that shaped it.',
      visual: 'You heard a shift. Let’s find the point that shaped it.',
    },
    sceneCue: 'inspect-event',
    userMaySkip: true,
    nextAction: 'Continue the story',
  },
  {
    id: 'contrast',
    number: '04',
    title: 'One place, another moment',
    eyebrow: 'The contrast',
    caption: 'Keep the path exactly where it is. Move the picture to another moment in the record. The route and our musical rules stay the same.',
    narration: {
      model: 'Now keep the path exactly where it is. Move the picture to another moment in the record. The route and our musical rules stay the same. Listen to what changes.',
      visual: 'Now keep the path exactly where it is. Move the picture to another moment in the record. The route and our musical rules stay the same. Listen to what changes.',
    },
    sceneCue: 'compare-frames',
    userMaySkip: true,
    nextAction: 'Continue',
  },
  {
    id: 'handover',
    number: '05',
    title: 'Your turn to follow the current',
    eyebrow: 'Handing over the instrument',
    caption: 'We’ve followed one line. The next one can be yours. Select a point to hear it. Or draw a route to create a new passage.',
    narration: {
      model: 'Every route asks a different question. Choose one.',
      visual: 'Every route asks a different question. Choose one.',
    },
    sceneCue: 'enable-tools',
    userMaySkip: true,
    nextAction: 'Start exploring',
  },
  {
    id: 'coda',
    number: '06',
    title: 'What you heard, and what you know',
    eyebrow: 'Closing',
    caption: 'An ocean can be described in movement, color, and numbers. We’ve listened to one translation of those patterns. Now you can trace every note back to its source.',
    sceneCue: 'finale',
    userMaySkip: false,
    nextAction: 'Explore another route',
  },
];

export const CLOSING_LINE = 'Every sound has a source. Every discovery begins with a question.';

export function chapterById(id: ChapterId): StoryChapter {
  return CHAPTERS.find((c) => c.id === id)!;
}

export function nextChapter(id: ChapterId): ChapterId | null {
  const i = CHAPTERS.findIndex((c) => c.id === id);
  return i >= 0 && i < CHAPTERS.length - 1 ? CHAPTERS[i + 1].id : null;
}

export function previousChapter(id: ChapterId): ChapterId | null {
  const i = CHAPTERS.findIndex((c) => c.id === id);
  return i > 0 ? CHAPTERS[i - 1].id : null;
}
