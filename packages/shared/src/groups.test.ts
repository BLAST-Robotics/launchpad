import { describe, expect, test } from "bun:test";
import { describeGroup, expectedGroupKeys, GROUP_STATES } from "./groups";

describe("expectedGroupKeys", () => {
  test("students go in the students group", () => {
    expect(expectedGroupKeys(["student"], "active")).toEqual(["students"]);
  });
  test("parents go in the parents group", () => {
    expect(expectedGroupKeys(["parent"], "active")).toEqual(["parents"]);
  });
  test("someone who is both gets both", () => {
    expect(expectedGroupKeys(["student", "parent"], "active")).toEqual(["students", "parents"]);
  });
  test("pending, mentors and admins are not checked", () => {
    expect(expectedGroupKeys(["pending"], "active")).toEqual([]);
    expect(expectedGroupKeys(["mentor"], "active")).toEqual([]);
    expect(expectedGroupKeys(["admin"], "active")).toEqual([]);
  });
  test("alumni move to parents, archived to none", () => {
    expect(expectedGroupKeys(["student"], "alumni")).toEqual(["parents"]);
    expect(expectedGroupKeys(["student"], "archived")).toEqual([]);
  });
});

describe("describeGroup", () => {
  test("every state has plain words and none promises a reply", () => {
    for (const state of GROUP_STATES) {
      const text = describeGroup("students", state);
      expect(text.label.length).toBeGreaterThan(0);
      expect(text.detail.toLowerCase()).not.toContain("we will reply");
    }
  });
  test("not_member names the help contact", () => {
    expect(describeGroup("parents", "not_member").detail).toContain("admin@team10989.org");
  });
});
