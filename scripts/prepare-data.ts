// Data prep pipeline — run with: npm run prepare-data
// Input:  data/raw/senate_votes.csv
//         data/raw/ph_municipalities.json (topojson)
// Output: public/data/votes_{year}.json (per year)
//         public/data/candidate_index.json
//         public/data/ph_municipalities.json (topojson, with psgc_code stamped as string for join)

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

// ── Types ────────────────────────────────────────────────────────────────────

type RawRow = {
  adm1_psgc: string;
  adm2_psgc: string;
  adm3_psgc: string;
  adm3_en: string;
  geo_level: string;
  raw_candidate_name: string;
  votes: string;
  election_year: string;
  senator_id: string;
  senator_name: string;
};

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

const ROOT    = process.cwd();
const RAW_CSV = path.join(ROOT, 'data/raw/senate_votes.csv');
const RAW_GEO = path.join(ROOT, 'data/raw/ph_municipalities.json');
const OUT_DIR = path.join(ROOT, 'public/data');

fs.mkdirSync(OUT_DIR, { recursive: true });

// ── 1. Parse CSV ─────────────────────────────────────────────────────────────

console.log('Reading CSV…');
const raw: RawRow[] = parse(fs.readFileSync(RAW_CSV), {
  columns: true,
  skip_empty_lines: true,
});
console.log(`  ${raw.length.toLocaleString()} rows`);

// ── 1b. Build adm3_psgc → province name lookup ───────────────────────────────

const munProvince: Record<string, string> = {};
for (const row of raw) {
  if (!munProvince[row.adm3_psgc]) {
    munProvince[row.adm3_psgc] = PROVINCE_NAMES[row.adm2_psgc] ?? '';
  }
}
const unmapped = [...new Set(raw.map(r => r.adm2_psgc))].filter(c => !PROVINCE_NAMES[c]);
if (unmapped.length) console.warn(`  ⚠ Unmapped province codes: ${unmapped.join(', ')}`);

// ── 2. Aggregate vote totals per municipality per year ───────────────────────

// voteTotal[year][adm3_psgc] = sum of all candidate votes in that municipality that year
const voteTotal: Record<string, Record<string, number>> = {};

for (const row of raw) {
  const year  = row.election_year;
  const psgc  = row.adm3_psgc;
  const votes = parseInt(row.votes, 10) || 0;
  if (!voteTotal[year]) voteTotal[year] = {};
  voteTotal[year][psgc] = (voteTotal[year][psgc] ?? 0) + votes;
}

// ── 3. Build per-year output structures ──────────────────────────────────────

const YEARS = [...new Set(raw.map(r => r.election_year))].sort();
console.log(`  Years: ${YEARS.join(', ')}`);

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

for (const year of YEARS) {
  console.log(`\nProcessing ${year}…`);
  const yearRows = raw.filter(r => r.election_year === year);

  // Build per-municipality candidate list
  const munMap: Record<string, { adm3_en: string; candidates: Record<string, number> }> = {};
  for (const row of yearRows) {
    const psgc  = row.adm3_psgc;
    const votes = parseInt(row.votes, 10) || 0;
    if (!munMap[psgc]) munMap[psgc] = { adm3_en: row.adm3_en, candidates: {} };
    munMap[psgc].candidates[row.senator_id] = (munMap[psgc].candidates[row.senator_id] ?? 0) + votes;
  }

  // Compute vote_share and rank per municipality
  const municipalities: Record<string, MunEntry> = {};
  for (const [psgc, mun] of Object.entries(munMap)) {
    const total = voteTotal[year][psgc] ?? 1;
    const sorted = Object.entries(mun.candidates).sort((a, b) => b[1] - a[1]);
    const candidates: CandidateRow[] = sorted.map(([senator_id, votes], i) => ({
      senator_id,
      votes,
      vote_share: parseFloat((votes / total).toFixed(6)),
      rank: i + 1,
    }));
    municipalities[psgc] = { adm3_en: mun.adm3_en, adm2_en: munProvince[psgc] ?? '', candidates };
  }

  // National totals
  const natVotes: Record<string, number> = {};
  for (const row of yearRows) {
    const votes = parseInt(row.votes, 10) || 0;
    natVotes[row.senator_id] = (natVotes[row.senator_id] ?? 0) + votes;
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

// ── 4. Candidate index ────────────────────────────────────────────────────────

const senatorMap = new Map<string, { senator_id: string; senator_name: string; years: Set<string> }>();
for (const row of raw) {
  if (!senatorMap.has(row.senator_id)) {
    senatorMap.set(row.senator_id, { senator_id: row.senator_id, senator_name: row.senator_name, years: new Set() });
  }
  senatorMap.get(row.senator_id)!.years.add(row.election_year);
}

const candidateIndex = Array.from(senatorMap.values())
  .map(s => ({ senator_id: s.senator_id, senator_name: s.senator_name, years: [...s.years].sort() }))
  .sort((a, b) => a.senator_name.localeCompare(b.senator_name));

fs.writeFileSync(path.join(OUT_DIR, 'candidate_index.json'), JSON.stringify(candidateIndex));
console.log(`\n✓ candidate_index.json — ${candidateIndex.length} unique candidates`);

// ── 5. Topojson: validate join and copy ──────────────────────────────────────

console.log('\nValidating topojson join…');
const topo = JSON.parse(fs.readFileSync(RAW_GEO, 'utf-8'));
const geoms: { properties: Record<string, unknown> }[] = topo.objects.municities.geometries;

// Build set of all CSV psgc codes across all years
const csvPsgc = new Set(raw.map(r => r.adm3_psgc));
const topoPsgc = new Set(geoms.map(g => String(parseInt(String(g.properties.psgc_code), 10))));

const missingFromTopo = [...csvPsgc].filter(p => !topoPsgc.has(p));
const missingFromCsv  = [...topoPsgc].filter(p => !csvPsgc.has(p));

if (missingFromTopo.length) {
  console.warn(`  ⚠ ${missingFromTopo.length} CSV municipalities missing from topojson:`);
  missingFromTopo.forEach(p => console.warn(`    ${p}  ${raw.find(r => r.adm3_psgc === p)?.adm3_en}`));
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

// Stamp psgc_code as string on each geometry so the frontend can do a direct string match
for (const g of geoms) {
  g.properties.adm3_psgc = String(parseInt(String(g.properties.psgc_code), 10));
}

fs.writeFileSync(path.join(OUT_DIR, 'ph_municipalities.json'), JSON.stringify(topo));
console.log('  ✓ ph_municipalities.json written to public/data/');

console.log('\nDone.');
