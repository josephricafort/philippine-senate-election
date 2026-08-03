import { readFile } from 'fs/promises';
import path from 'path';

// Satori (next/og's ImageResponse renderer) runs server-side with no access to next/font or
// CSS — it needs raw font binary buffers passed via the `fonts` option, matched by the
// `fontFamily` name used in the JSX below. These are the same Source Serif/Sans/Code Pro
// weights used by the app's live type system (see layout.tsx), so shared OG cards visually
// match the page a viewer lands on after clicking through.
const FONTS_DIR = path.join(process.cwd(), 'src/lib/fonts');

type OgFont = { name: string; data: Buffer; weight: 400 | 600 | 700; style: 'normal' };

let cached: OgFont[] | null = null;

export async function loadOgFonts(): Promise<OgFont[]> {
  if (cached) return cached;
  const [serifBold, sansRegular, sansSemibold, monoSemibold] = await Promise.all([
    readFile(path.join(FONTS_DIR, 'SourceSerif4-Bold.otf')),
    readFile(path.join(FONTS_DIR, 'SourceSans3-Regular.otf')),
    readFile(path.join(FONTS_DIR, 'SourceSans3-Semibold.otf')),
    readFile(path.join(FONTS_DIR, 'SourceCodePro-Semibold.otf')),
  ]);
  cached = [
    { name: 'Source Serif', data: serifBold, weight: 700 as const, style: 'normal' as const },
    { name: 'Source Sans', data: sansRegular, weight: 400 as const, style: 'normal' as const },
    { name: 'Source Sans', data: sansSemibold, weight: 600 as const, style: 'normal' as const },
    { name: 'Source Code', data: monoSemibold, weight: 600 as const, style: 'normal' as const },
  ];
  return cached;
}
