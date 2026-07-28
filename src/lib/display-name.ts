// Reformats a stored "Last, First (Nickname)" name into natural headline order — "Nickname
// Last" or "First Last" — for use ONLY in generated headline text. Every other part of the app
// (CandidateCard, leaderboard, search) keeps showing the stored "Last, First" form; this exists
// because "Marcos, Imee's support rose..." reads as a list entry, not a sentence.
//
// There's no structured first/last field in the source data, so this is a best-effort string
// parse — it will occasionally produce an odd result for unusual names (titles like "Mr.",
// military-rank-shaped entries), but the 267-candidate spot check this was built against showed
// no outright-wrong results, only occasional oddities. Isolated in its own module so it's easy
// to find and patch if a specific name looks wrong in production.
export function headlineName(storedName: string): string {
  const commaIndex = storedName.indexOf(',');
  if (commaIndex === -1) return storedName; // no comma — can't parse, return as-is

  const last = storedName.slice(0, commaIndex).trim();
  const rest = storedName.slice(commaIndex + 1).trim();

  const nicknameMatch = rest.match(/\(([^)]+)\)/);
  const nickname = nicknameMatch?.[1];

  const restNoNickname = rest.replace(/\s*\([^)]+\)/, '').trim();
  const suffixMatch = restNoNickname.match(/\b(Jr\.?|Sr\.?|III|II|IV)\.?$/);
  const suffix = suffixMatch?.[0];
  const firstName = restNoNickname.replace(/\s*\b(Jr\.?|Sr\.?|III|II|IV)\.?$/, '').trim();

  const displayFirst = nickname ?? firstName;
  let result = `${displayFirst} ${last}`;
  if (suffix && !nickname) result += ` ${suffix}`;
  return result;
}
