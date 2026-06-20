// Data prep pipeline — run with: npm run prepare-data
// Input:  data/slim/votes_wide/votes_wide_{year}.csv  (wide: one row per municipality)
//         data/slim/senators.csv                      (senator_id → senator_name)
//         data/raw/ph_municipalities.json             (topojson)
// Output: public/data/votes_{year}.json (per year)
//         public/data/candidate_index.json
//         public/data/ph_municipalities.json (topojson, with adm3_psgc stamped as string for join)

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

// ── PSGC province code → province name ───────────────────────────────────────
// Keys are adm2_psgc values from the CSV (numeric string, no leading zeros needed)
const PROVINCE_NAMES: Record<string, string> = {
  '102800000': 'Ilocos Norte',
  '102900000': 'Ilocos Sur',
  '103300000': 'La Union',
  '105500000': 'Pangasinan',
  '200900000': 'Batanes',
  '201500000': 'Cagayan',
  '203100000': 'Isabela',
  '205000000': 'Nueva Vizcaya',
  '205700000': 'Quirino',
  '300800000': 'Bataan',
  '301400000': 'Bulacan',
  '304900000': 'Nueva Ecija',
  '305400000': 'Pampanga',
  '306900000': 'Tarlac',
  '307100000': 'Zambales',
  '307700000': 'Aurora',
  '330100000': 'Angeles City',
  '331400000': 'Olongapo City',
  '401000000': 'Batangas',
  '402100000': 'Cavite',
  '403400000': 'Laguna',
  '405600000': 'Quezon',
  '405800000': 'Rizal',
  '431200000': 'Lucena City',
  '500500000': 'Albay',
  '501600000': 'Camarines Norte',
  '501700000': 'Camarines Sur',
  '502000000': 'Catanduanes',
  '504100000': 'Masbate',
  '506200000': 'Sorsogon',
  '600400000': 'Aklan',
  '600600000': 'Antique',
  '601900000': 'Capiz',
  '603000000': 'Iloilo',
  '604500000': 'Negros Occidental',
  '607900000': 'Guimaras',
  '630200000': 'Bacolod City',
  '631000000': 'Iloilo City',
  '701200000': 'Bohol',
  '702200000': 'Cebu',
  '704600000': 'Negros Oriental',
  '706100000': 'Siquijor',
  '730600000': 'Cebu City',
  '731100000': 'Lapu-Lapu City',
  '731300000': 'Mandaue City',
  '802600000': 'Eastern Samar',
  '803700000': 'Leyte',
  '804800000': 'Northern Samar',
  '806000000': 'Samar',
  '806400000': 'Southern Leyte',
  '807800000': 'Biliran',
  '831600000': 'Tacloban City',
  '907200000': 'Zamboanga del Norte',
  '907300000': 'Zamboanga del Sur',
  '908300000': 'Zamboanga Sibugay',
  '931700000': 'Zamboanga City',
  '990100000': 'Isabela City',
  '1001300000': 'Bukidnon',
  '1001800000': 'Camiguin',
  '1003500000': 'Lanao del Norte',
  '1004200000': 'Misamis Occidental',
  '1004300000': 'Misamis Oriental',
  '1030500000': 'Cagayan de Oro City',
  '1030900000': 'Iligan City',
  '1102300000': 'Davao del Norte',
  '1102400000': 'Davao del Sur',
  '1102500000': 'Davao Oriental',
  '1108200000': 'Compostela Valley',
  '1108600000': 'Davao Occidental',
  '1130700000': 'Davao City',
  '1204700000': 'Cotabato',
  '1206300000': 'South Cotabato',
  '1206500000': 'Sultan Kudarat',
  '1208000000': 'Sarangani',
  '1230800000': 'General Santos City',
  '1380100000': 'Caloocan City',
  '1380200000': 'Las Piñas City',
  '1380300000': 'Makati City',
  '1380400000': 'Malabon City',
  '1380500000': 'Mandaluyong City',
  '1380600000': 'Manila',
  '1380700000': 'Marikina City',
  '1380800000': 'Muntinlupa City',
  '1380900000': 'Navotas City',
  '1381000000': 'Parañaque City',
  '1381100000': 'Pasay City',
  '1381200000': 'Pasig City',
  '1381300000': 'Quezon City',
  '1381400000': 'San Juan City',
  '1381500000': 'Taguig City',
  '1381600000': 'Valenzuela City',
  '1381700000': 'Pateros',
  '1400100000': 'Abra',
  '1401100000': 'Benguet',
  '1402700000': 'Ifugao',
  '1403200000': 'Kalinga',
  '1404400000': 'Mountain Province',
  '1408100000': 'Apayao',
  '1430300000': 'Baguio City',
  '1600200000': 'Agusan del Norte',
  '1600300000': 'Agusan del Sur',
  '1606700000': 'Surigao del Norte',
  '1606800000': 'Surigao del Sur',
  '1608500000': 'Dinagat Islands',
  '1630400000': 'Butuan City',
  '1704000000': 'Marinduque',
  '1705100000': 'Occidental Mindoro',
  '1705200000': 'Oriental Mindoro',
  '1705300000': 'Palawan',
  '1705900000': 'Romblon',
  '1731500000': 'Puerto Princesa City',
  '1900700000': 'Basilan',
  '1903600000': 'Lanao del Sur',
  '1906600000': 'Sulu',
  '1907000000': 'Tawi-Tawi',
  '1908700000': 'Maguindanao',
  '1908800000': 'Maguindanao del Sur',
  '1999900000': 'Cotabato City',
};

// ── Paths ────────────────────────────────────────────────────────────────────

const ROOT           = process.cwd();
const SLIM_DIR       = path.join(ROOT, 'data/slim');
const SENATORS_CSV   = path.join(SLIM_DIR, 'senators.csv');
const VOTES_WIDE_DIR = path.join(SLIM_DIR, 'votes_wide');
const RAW_GEO        = path.join(ROOT, 'data/raw/ph_municipalities.json');
const OUT_DIR        = path.join(ROOT, 'public/data');

fs.mkdirSync(OUT_DIR, { recursive: true });

// ── 1. Load reference tables ─────────────────────────────────────────────────

console.log('Reading senators.csv…');
type SenatorRow = { senator_id: string; senator_name: string };
const senatorRows: SenatorRow[] = parse(fs.readFileSync(SENATORS_CSV), {
  columns: true,
  skip_empty_lines: true,
});
const senatorNames = new Map<string, string>(
  senatorRows.map(r => [r.senator_id, r.senator_name])
);
console.log(`  ${senatorNames.size} senators`);

// Warn on unmapped province codes (checked once from all wide files below)
const seenAdm2 = new Set<string>();

// ── 2. Discover years from votes_wide/ ──────────────────────────────────────

const YEARS = fs.readdirSync(VOTES_WIDE_DIR)
  .filter(f => f.endsWith('.csv'))
  .map(f => f.match(/votes_wide_(\d{4})\.csv/)![1])
  .sort();
console.log(`  Years: ${YEARS.join(', ')}`);

// ── Output types (unchanged from prior version) ──────────────────────────────

type CandidateRow = {
  senator_id: string;
  votes: number;
  vote_share: number;
  rank: number;
};

type MunEntry = {
  adm3_en: string;
  adm2_en: string;
  candidates: CandidateRow[];
};

type YearOutput = {
  year: number;
  municipalities: Record<string, MunEntry>;
  national: Record<string, { national_votes: number; national_rank: number }>;
};

// ── 3. Build per-year output structures ──────────────────────────────────────

const GEO_COLS = new Set(['adm3_psgc', 'adm2_psgc', 'adm1_psgc', 'adm3_en', 'geo_level']);

// Accumulated across years for topojson validation
const csvPsgc = new Set<string>();
// psgc → adm3_en for topojson miss reporting
const psgcName = new Map<string, string>();

for (const year of YEARS) {
  console.log(`\nProcessing ${year}…`);

  const widePath = path.join(VOTES_WIDE_DIR, `votes_wide_${year}.csv`);
  const wideRows: Record<string, string>[] = parse(fs.readFileSync(widePath), {
    columns: true,
    skip_empty_lines: true,
  });

  const senatorCols = Object.keys(wideRows[0] ?? {}).filter(k => !GEO_COLS.has(k));

  const unknownSenators = senatorCols.filter(sid => !senatorNames.has(sid));
  if (unknownSenators.length) {
    console.warn(`  ⚠ ${year}: senator columns not in senators.csv: ${unknownSenators.join(', ')}`);
  }

  const municipalities: Record<string, MunEntry> = {};
  const natVotes: Record<string, number> = {};

  for (const row of wideRows) {
    const psgc = row.adm3_psgc;
    csvPsgc.add(psgc);
    psgcName.set(psgc, row.adm3_en);
    seenAdm2.add(row.adm2_psgc);

    const adm2_en = PROVINCE_NAMES[row.adm2_psgc] ?? '';

    const votesMap: Record<string, number> = {};
    let munTotal = 0;
    for (const sid of senatorCols) {
      const v = parseInt(row[sid] ?? '0', 10) || 0;
      votesMap[sid] = v;
      munTotal += v;
      natVotes[sid] = (natVotes[sid] ?? 0) + v;
    }

    const sorted = senatorCols.slice().sort((a, b) => votesMap[b] - votesMap[a]);
    municipalities[psgc] = {
      adm3_en: row.adm3_en,
      adm2_en,
      candidates: sorted.map((sid, i) => ({
        senator_id: sid,
        votes: votesMap[sid],
        vote_share: parseFloat((votesMap[sid] / (munTotal || 1)).toFixed(6)),
        rank: i + 1,
      })),
    };
  }

  const natSorted = Object.entries(natVotes).sort((a, b) => b[1] - a[1]);
  const national: YearOutput['national'] = {};
  for (const [i, [sid, votes]] of natSorted.entries()) {
    national[sid] = { national_votes: votes, national_rank: i + 1 };
  }

  const output: YearOutput = { year: parseInt(year), municipalities, national };
  const outPath = path.join(OUT_DIR, `votes_${year}.json`);
  fs.writeFileSync(outPath, JSON.stringify(output));
  console.log(`  ✓ votes_${year}.json — ${Object.keys(municipalities).length} municipalities, ${natSorted.length} candidates`);
}

// Warn on any adm2_psgc values not in PROVINCE_NAMES
const unmapped = [...seenAdm2].filter(c => !PROVINCE_NAMES[c]);
if (unmapped.length) console.warn(`  ⚠ Unmapped province codes: ${unmapped.join(', ')}`);

// ── 4. Candidate index ────────────────────────────────────────────────────────

const senatorYears = new Map<string, Set<string>>();
for (const year of YEARS) {
  const header = fs.readFileSync(
    path.join(VOTES_WIDE_DIR, `votes_wide_${year}.csv`), 'utf-8'
  ).split('\n')[0];
  for (const col of header.trim().split(',')) {
    if (!GEO_COLS.has(col)) {
      if (!senatorYears.has(col)) senatorYears.set(col, new Set());
      senatorYears.get(col)!.add(year);
    }
  }
}

const candidateIndex = Array.from(senatorNames.entries())
  .map(([senator_id, senator_name]) => ({
    senator_id,
    senator_name,
    years: [...(senatorYears.get(senator_id) ?? new Set())].sort(),
  }))
  .sort((a, b) => a.senator_name.localeCompare(b.senator_name));

const noYears = candidateIndex.filter(e => e.years.length === 0);
if (noYears.length) {
  console.warn(`⚠ ${noYears.length} senators in senators.csv appear in no votes_wide year: ${noYears.map(e => e.senator_id).join(', ')}`);
}

fs.writeFileSync(path.join(OUT_DIR, 'candidate_index.json'), JSON.stringify(candidateIndex));
console.log(`\n✓ candidate_index.json — ${candidateIndex.length} unique candidates`);

// ── 5. Topojson: validate join and copy ──────────────────────────────────────

console.log('\nValidating topojson join…');
const topo = JSON.parse(fs.readFileSync(RAW_GEO, 'utf-8'));
const geoms: { properties: Record<string, unknown> }[] = topo.objects.municities.geometries;

const topoPsgc = new Set(geoms.map(g => String(parseInt(String(g.properties.psgc_code), 10))));

const missingFromTopo = [...csvPsgc].filter(p => !topoPsgc.has(p));
const missingFromCsv  = [...topoPsgc].filter(p => !csvPsgc.has(p));

if (missingFromTopo.length) {
  console.warn(`  ⚠ ${missingFromTopo.length} CSV municipalities missing from topojson:`);
  missingFromTopo.forEach(p => console.warn(`    ${p}  ${psgcName.get(p)}`));
} else {
  console.log('  ✓ All CSV municipalities found in topojson');
}
if (missingFromCsv.length) {
  console.warn(`  ⚠ ${missingFromCsv.length} topojson features missing from CSV (expected — boundary-only geometries):`);
  missingFromCsv.slice(0, 5).forEach(p => {
    const name = geoms.find(g => String(parseInt(String(g.properties.psgc_code), 10)) === p)?.properties.adm3_en;
    console.warn(`    ${p}  ${name}`);
  });
}

// Stamp adm3_psgc as string on each geometry so the frontend can do a direct string match
for (const g of geoms) {
  g.properties.adm3_psgc = String(parseInt(String(g.properties.psgc_code), 10));
}

fs.writeFileSync(path.join(OUT_DIR, 'ph_municipalities.json'), JSON.stringify(topo));
console.log('  ✓ ph_municipalities.json written to public/data/');

console.log('\nDone.');
