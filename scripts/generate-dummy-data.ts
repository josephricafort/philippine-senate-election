// Generates dummy data in the exact pipeline output schema.
// Run with: npx tsx scripts/generate-dummy-data.ts
// Output: public/data/candidate_index.json + public/data/votes_{year}.json

import fs from 'fs';
import path from 'path';

const YEARS = [2007, 2010, 2013, 2019, 2022, 2025];

const SENATORS = [
  { senator_id: 'aquino_noynoy',     senator_name: 'Aquino, Benigno III (Noynoy)' },
  { senator_id: 'angara_edgardo',    senator_name: 'Angara, Edgardo' },
  { senator_id: 'cayetano_alan',     senator_name: 'Cayetano, Alan Peter' },
  { senator_id: 'cayetano_pia',      senator_name: 'Cayetano, Pia' },
  { senator_id: 'drilon_franklin',   senator_name: 'Drilon, Franklin' },
  { senator_id: 'estrada_jinggoy',   senator_name: 'Estrada, Jinggoy' },
  { senator_id: 'gordon_richard',    senator_name: 'Gordon, Richard' },
  { senator_id: 'lacson_ping',       senator_name: 'Lacson, Panfilo (Ping)' },
  { senator_id: 'pimentel_koko',     senator_name: 'Pimentel, Aquilino III (Koko)' },
  { senator_id: 'recto_ralph',       senator_name: 'Recto, Ralph' },
  { senator_id: 'roxas_mar',         senator_name: 'Roxas, Manuel II (Mar)' },
  { senator_id: 'villar_manny',      senator_name: 'Villar, Manuel (Manny)' },
];

// Which senators ran in which years (not all run every year)
const YEAR_SENATORS: Record<number, string[]> = {
  2007: ['aquino_noynoy', 'angara_edgardo', 'cayetano_alan', 'drilon_franklin', 'estrada_jinggoy', 'gordon_richard', 'lacson_ping', 'pimentel_koko', 'recto_ralph', 'roxas_mar', 'villar_manny', 'cayetano_pia'],
  2010: ['angara_edgardo', 'cayetano_alan', 'cayetano_pia', 'drilon_franklin', 'gordon_richard', 'lacson_ping', 'pimentel_koko', 'recto_ralph', 'roxas_mar', 'villar_manny'],
  2013: ['aquino_noynoy', 'angara_edgardo', 'cayetano_pia', 'estrada_jinggoy', 'gordon_richard', 'lacson_ping', 'pimentel_koko', 'roxas_mar', 'villar_manny'],
  2019: ['cayetano_alan', 'drilon_franklin', 'estrada_jinggoy', 'gordon_richard', 'lacson_ping', 'pimentel_koko', 'recto_ralph'],
  2022: ['angara_edgardo', 'cayetano_pia', 'drilon_franklin', 'estrada_jinggoy', 'lacson_ping', 'recto_ralph', 'roxas_mar', 'villar_manny'],
  2025: ['aquino_noynoy', 'cayetano_alan', 'cayetano_pia', 'gordon_richard', 'lacson_ping', 'pimentel_koko', 'recto_ralph', 'villar_manny'],
};

const MUNICIPALITIES: { adm3_psgc: string; adm3_en: string; region: string }[] = [
  { adm3_psgc: '1400101000', adm3_en: 'Bangued',           region: 'CAR' },
  { adm3_psgc: '1300101000', adm3_en: 'Manila',             region: 'NCR' },
  { adm3_psgc: '1300108000', adm3_en: 'Quezon City',        region: 'NCR' },
  { adm3_psgc: '1300110000', adm3_en: 'Makati',             region: 'NCR' },
  { adm3_psgc: '1300105000', adm3_en: 'Marikina',           region: 'NCR' },
  { adm3_psgc: '4001701000', adm3_en: 'Batangas City',      region: 'Region IV-A' },
  { adm3_psgc: '4001702000', adm3_en: 'Lipa City',          region: 'Region IV-A' },
  { adm3_psgc: '5001801000', adm3_en: 'Legaspi City',       region: 'Region V' },
  { adm3_psgc: '6001901000', adm3_en: 'Iloilo City',        region: 'Region VI' },
  { adm3_psgc: '7002001000', adm3_en: 'Cebu City',          region: 'Region VII' },
  { adm3_psgc: '7002002000', adm3_en: 'Mandaue City',       region: 'Region VII' },
  { adm3_psgc: '8002101000', adm3_en: 'Tacloban City',      region: 'Region VIII' },
  { adm3_psgc: '9002201000', adm3_en: 'Zamboanga City',     region: 'Region IX' },
  { adm3_psgc: '1002301000', adm3_en: 'Cagayan de Oro',     region: 'Region X' },
  { adm3_psgc: '1102401000', adm3_en: 'Davao City',         region: 'Region XI' },
  { adm3_psgc: '1202501000', adm3_en: 'General Santos City',region: 'Region XII' },
  { adm3_psgc: '1602601000', adm3_en: 'Butuan City',        region: 'Region XIII' },
  { adm3_psgc: '1900101000', adm3_en: 'Cotabato City',      region: 'BARMM' },
  { adm3_psgc: '3002801000', adm3_en: 'San Fernando City',  region: 'Region III' },
  { adm3_psgc: '2002901000', adm3_en: 'Tuguegarao City',    region: 'Region II' },
];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function generateYearData(year: number) {
  const senatorIds = YEAR_SENATORS[year];
  const rand = seededRandom(year * 31337);

  const municipalities: Record<string, {
    adm3_en: string;
    candidates: { senator_id: string; votes: number; vote_share: number; rank: number }[];
  }> = {};

  const nationalVotes: Record<string, number> = {};

  for (const mun of MUNICIPALITIES) {
    const totalVoters = Math.floor(50000 + rand() * 200000);
    // Each voter casts up to 12 votes; simulate total votes cast per candidate
    const rawVotes: Record<string, number> = {};
    for (const sid of senatorIds) {
      // Bias some senators strongly in certain regions for visual interest
      let bias = 1.0;
      if (sid === 'lacson_ping'    && mun.region === 'NCR')          bias = 2.5;
      if (sid === 'cayetano_alan'  && mun.region === 'NCR')          bias = 2.0;
      if (sid === 'villar_manny'   && mun.region === 'Region IV-A')  bias = 2.8;
      if (sid === 'angara_edgardo' && mun.region === 'Region IV-A')  bias = 2.2;
      if (sid === 'estrada_jinggoy'&& mun.region === 'Region III')   bias = 2.4;
      if (sid === 'roxas_mar'      && mun.region === 'Region VI')    bias = 2.6;
      if (sid === 'gordon_richard' && mun.region === 'Region III')   bias = 2.0;
      if (sid === 'pimentel_koko'  && mun.region === 'Region X')     bias = 2.3;
      if (sid === 'drilon_franklin'&& mun.region === 'Region VI')    bias = 2.1;
      rawVotes[sid] = Math.floor((0.3 + rand() * 0.7) * bias * totalVoters * 0.6);
    }

    const voteTotal = Object.values(rawVotes).reduce((a, b) => a + b, 0);
    const sorted = [...senatorIds].sort((a, b) => rawVotes[b] - rawVotes[a]);

    const candidates = senatorIds.map(sid => {
      const votes = rawVotes[sid];
      const rank = sorted.indexOf(sid) + 1;
      return {
        senator_id: sid,
        votes,
        vote_share: parseFloat((votes / voteTotal).toFixed(4)),
        rank,
      };
    });

    municipalities[mun.adm3_psgc] = { adm3_en: mun.adm3_en, candidates };

    for (const sid of senatorIds) {
      nationalVotes[sid] = (nationalVotes[sid] ?? 0) + rawVotes[sid];
    }
  }

  const sortedNational = [...senatorIds].sort((a, b) => nationalVotes[b] - nationalVotes[a]);
  const national: Record<string, { national_votes: number; national_rank: number }> = {};
  for (const sid of senatorIds) {
    national[sid] = {
      national_votes: nationalVotes[sid],
      national_rank: sortedNational.indexOf(sid) + 1,
    };
  }

  return { year, municipalities, national };
}

const outDir = path.join(process.cwd(), 'public/data');
fs.mkdirSync(outDir, { recursive: true });

// Per-year vote data
for (const year of YEARS) {
  const data = generateYearData(year);
  fs.writeFileSync(path.join(outDir, `votes_${year}.json`), JSON.stringify(data, null, 2));
  console.log(`✓ votes_${year}.json`);
}

// Candidate index — all senators across all years
const candidateIndex = YEARS.flatMap(year =>
  YEAR_SENATORS[year].map(sid => {
    const s = SENATORS.find(s => s.senator_id === sid)!;
    return { senator_id: s.senator_id, senator_name: s.senator_name, election_year: year };
  })
).sort((a, b) => a.senator_name.localeCompare(b.senator_name) || a.election_year - b.election_year);

fs.writeFileSync(path.join(outDir, 'candidate_index.json'), JSON.stringify(candidateIndex, null, 2));
console.log('✓ candidate_index.json');
console.log('\nDone. All dummy data written to public/data/');
