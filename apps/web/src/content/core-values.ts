export interface CoreValue {
  /** Short name, as the team writes it. */
  title: string;
  /** One line on what it means, in the team's own words. */
  meaning: string;
  /** Optional: a real example from the team (never invented). */
  example?: string;
}

/**
 * The team's core values, in order.
 *
 * TODO(core values): this list is intentionally EMPTY. The core values assignment document
 * was not found in the shared Drive folder ("Graphic Assets" holds only logo images), so
 * nothing here is invented. To fill it in, paste each value from the team's assignment as
 * one object below, keeping the team's own wording:
 *
 *   { title: "<value name>", meaning: "<one line, from the assignment>" },
 *   { title: "<value name>", meaning: "<...>", example: "<optional real example>" },
 *
 * The /core-values page renders them as numbered cards automatically. An empty list shows a
 * friendly placeholder instead.
 */
export const CORE_VALUES: readonly CoreValue[] = [];

/** From the team's own artwork (the Year 0 badge). */
export const CORE_VALUES_TAGLINE = "Year 0: A Legacy of Excellence";
