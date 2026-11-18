/**
 * Closest-match lookup against the roster. Pure functions: no database, no framework.
 *
 * Used for "Are you ___?" (a student typing their own name) and "Is this your kid?"
 * (a parent typing a child's name). It only ever ranks the candidates it is given, and
 * returns a few, so the API can show the best guesses without exposing the whole list.
 */

export interface RosterCandidate {
  id: string;
  firstName: string;
  lastName: string;
  grade: string | null;
  claimed: boolean;
}

export interface RosterMatch extends RosterCandidate {
  graduationYear: number | null;
  score: number;
}

const MIN_SCORE = 0.8;
const MAX_RESULTS = 3;

export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Jaro-Winkler similarity in [0, 1]. */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return a.length === 0 ? 0 : 1;
  if (a.length === 0 || b.length === 0) return 0;

  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatched = new Array<boolean>(a.length).fill(false);
  const bMatched = new Array<boolean>(b.length).fill(false);

  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - window);
    const end = Math.min(b.length - 1, i + window);
    for (let j = start; j <= end; j++) {
      if (bMatched[j] || a[i] !== b[j]) continue;
      aMatched[i] = true;
      bMatched[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }

  const m = matches;
  const jaro = (m / a.length + m / b.length + (m - transpositions / 2) / m) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Graduation year from a grade in a season that ends in `seasonEndYear`.
 * Grade 12 graduates at the end of the season; grade 11 a year later, and so on.
 */
export function graduationYearFor(grade: string | null, seasonEndYear: number): number | null {
  if (!grade) return null;
  const n = Number.parseInt(grade, 10);
  if (!Number.isFinite(n) || n < 1 || n > 12) return null;
  return seasonEndYear + (12 - n);
}

export function nameScore(typed: string, firstName: string, lastName: string): number {
  const input = normalizeName(typed);
  if (input.length < 2) return 0;
  const first = normalizeName(firstName);
  const last = normalizeName(lastName);
  const full = `${first} ${last}`.trim();
  const swapped = `${last} ${first}`.trim();

  let best = Math.max(jaroWinkler(input, full), jaroWinkler(input, swapped));

  // Token-wise: every typed word should find a close word in the entry. This covers a
  // middle name typed or omitted, and "Mike" against "Michael" better than the full string.
  const entryTokens = [...first.split(" "), ...last.split(" ")].filter(Boolean);
  const typedTokens = input.split(" ").filter(Boolean);
  if (typedTokens.length >= 2 && entryTokens.length > 0) {
    const sum = typedTokens.reduce(
      (acc, token) => acc + Math.max(...entryTokens.map((e) => jaroWinkler(token, e))),
      0,
    );
    best = Math.max(best, sum / typedTokens.length);
  }
  return best;
}

export interface MatchOptions {
  /** The year the typed person graduates. A hit nudges the ranking, a miss barely does. */
  graduationYear?: number | undefined;
  seasonEndYear: number;
}

export function matchRoster(
  typedName: string,
  candidates: readonly RosterCandidate[],
  options: MatchOptions,
): RosterMatch[] {
  const matches: RosterMatch[] = [];

  for (const candidate of candidates) {
    let score = nameScore(typedName, candidate.firstName, candidate.lastName);
    if (score === 0) continue;

    const graduationYear = graduationYearFor(candidate.grade, options.seasonEndYear);
    if (options.graduationYear !== undefined && graduationYear !== null) {
      score += graduationYear === options.graduationYear ? 0.06 : -0.04;
    }
    if (score < MIN_SCORE) continue;
    matches.push({ ...candidate, graduationYear, score: Math.min(1, score) });
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
}
