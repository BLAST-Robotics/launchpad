import { describe, expect, test } from "bun:test";
import {
  graduationYearFor,
  matchRoster,
  normalizeName,
  type RosterCandidate,
} from "./roster-match";

const roster: RosterCandidate[] = [
  { id: "1", firstName: "Maya", lastName: "Patel", grade: "11", claimed: false },
  { id: "2", firstName: "Mayank", lastName: "Patil", grade: "9", claimed: false },
  { id: "3", firstName: "José", lastName: "Álvarez", grade: "12", claimed: false },
  { id: "4", firstName: "Michael", lastName: "Chen", grade: "10", claimed: true },
];

const opts = { seasonEndYear: 2027 };

describe("graduationYearFor", () => {
  test("grade 12 graduates in the season's end year", () => {
    expect(graduationYearFor("12", 2027)).toBe(2027);
    expect(graduationYearFor("11", 2027)).toBe(2028);
    expect(graduationYearFor("6", 2027)).toBe(2033);
  });
  test("rejects missing or nonsense grades", () => {
    expect(graduationYearFor(null, 2027)).toBeNull();
    expect(graduationYearFor("college", 2027)).toBeNull();
    expect(graduationYearFor("13", 2027)).toBeNull();
  });
});

describe("normalizeName", () => {
  test("strips accents, case and punctuation", () => {
    expect(normalizeName("  José   Álvarez-Jr. ")).toBe("jose alvarez jr");
  });
});

describe("matchRoster", () => {
  test("exact name ranks first", () => {
    const [top] = matchRoster("Maya Patel", roster, opts);
    expect(top?.id).toBe("1");
  });

  test("tolerates a typo and a swapped order", () => {
    expect(matchRoster("Maya Patal", roster, opts)[0]?.id).toBe("1");
    expect(matchRoster("Patel Maya", roster, opts)[0]?.id).toBe("1");
  });

  test("ignores accents the person did not type", () => {
    expect(matchRoster("jose alvarez", roster, opts)[0]?.id).toBe("3");
  });

  test("graduation year breaks a near tie", () => {
    const hit = matchRoster("Maya Patel", roster, { ...opts, graduationYear: 2028 })[0];
    expect(hit?.graduationYear).toBe(2028);
  });

  test("returns nothing for a stranger and never more than three", () => {
    expect(matchRoster("Zzyzx Qwerty", roster, opts)).toEqual([]);
    expect(matchRoster("Maya Patel", roster, opts).length).toBeLessThanOrEqual(3);
  });

  test("too-short input matches nothing", () => {
    expect(matchRoster("m", roster, opts)).toEqual([]);
  });

  test("carries the claimed flag through", () => {
    expect(matchRoster("Michael Chen", roster, opts)[0]?.claimed).toBe(true);
  });
});
