import type { CoreValueKey } from "@launchpad/shared";

export interface CoreValue {
  /** Stable key, shared with the API and the database. */
  key: CoreValueKey;
  /** Short name. */
  title: string;
  /** One line on what it means. */
  meaning: string;
  /** Optional: a real example from the team (never invented). */
  example?: string;
}

/**
 * The six FIRST core values, with FIRST's own one-line wording. Students pick ONE and record a
 * video about it (docs/SETUP.md, "Core values videos").
 *
 * TODO(confirm): the team's assignment document could not be read (it is mostly images), so
 * these are FIRST's public core values, not text taken from that document. If the assignment
 * words them differently, change `title` / `meaning` here; the `key` must not change.
 */
export const CORE_VALUES: readonly CoreValue[] = [
  { key: "discovery", title: "Discovery", meaning: "We explore new skills and ideas." },
  {
    key: "innovation",
    title: "Innovation",
    meaning: "We use creativity and persistence to solve problems.",
  },
  { key: "impact", title: "Impact", meaning: "We apply what we learn to improve our world." },
  {
    key: "inclusion",
    title: "Inclusion",
    meaning: "We respect each other and embrace our differences.",
  },
  { key: "teamwork", title: "Teamwork", meaning: "We are stronger when we work together." },
  { key: "fun", title: "Fun", meaning: "We enjoy and celebrate what we do!" },
];

export const CORE_VALUE_TITLES: Record<CoreValueKey, string> = Object.fromEntries(
  CORE_VALUES.map((value) => [value.key, value.title]),
) as Record<CoreValueKey, string>;

/** From the team's own artwork (the Year 0 badge). */
export const CORE_VALUES_TAGLINE = "Year 0: A Legacy of Excellence";

/** The assignment's backup: use this if uploading here does not work. */
export const CORE_VALUES_FALLBACK_FORM = "https://forms.gle/K4HXuNn25voa6sid6";

/** The video must run at least this long. */
export const MIN_VIDEO_SECONDS_HINT = 60;
