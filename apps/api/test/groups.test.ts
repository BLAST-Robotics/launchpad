import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app";
import {
  computeGroupStatuses,
  createGoogleGroupsClient,
  type GroupsClient,
} from "../src/lib/groups";

const student = {
  email: "kid@example.test",
  roles: ["student"] as const,
  status: "active" as const,
};
const lookup = async (key: string) => (key === "students" ? "students-group@example.test" : null);
const fresh = () => new Map<string, { state: never; expiresAt: number }>() as never;

function fake(isMember: boolean | Error): GroupsClient & { calls: number } {
  const client = {
    calls: 0,
    async isMember() {
      client.calls++;
      if (isMember instanceof Error) throw isMember;
      return isMember;
    },
  };
  return client;
}

describe("computeGroupStatuses", () => {
  test("member", async () => {
    const out = await computeGroupStatuses(
      { client: fake(true), lookupGroupEmail: lookup, cache: fresh() },
      student,
    );
    expect(out).toEqual([{ key: "students", state: "member" }]);
  });

  test("not_member", async () => {
    const out = await computeGroupStatuses(
      { client: fake(false), lookupGroupEmail: lookup, cache: fresh() },
      student,
    );
    expect(out[0]?.state).toBe("not_member");
  });

  test("not_connected when there is no Google client", async () => {
    const out = await computeGroupStatuses(
      { client: null, lookupGroupEmail: lookup, cache: fresh() },
      student,
    );
    expect(out[0]?.state).toBe("not_connected");
  });

  test("not_configured when google_objects has no row for the group", async () => {
    const out = await computeGroupStatuses(
      { client: fake(true), lookupGroupEmail: async () => null, cache: fresh() },
      student,
    );
    expect(out[0]?.state).toBe("not_configured");
  });

  test("unknown when Google errors, never throws", async () => {
    const out = await computeGroupStatuses(
      { client: fake(new Error("boom")), lookupGroupEmail: lookup, cache: fresh() },
      student,
    );
    expect(out[0]?.state).toBe("unknown");
  });

  test("unknown when the lookup itself fails", async () => {
    const out = await computeGroupStatuses(
      {
        client: fake(true),
        lookupGroupEmail: async () => {
          throw new Error("db down");
        },
        cache: fresh(),
      },
      student,
    );
    expect(out[0]?.state).toBe("unknown");
  });

  test("caches for five minutes, then asks again", async () => {
    const client = fake(true);
    let t = 1_000;
    const deps = { client, lookupGroupEmail: lookup, cache: fresh(), now: () => t };
    await computeGroupStatuses(deps, student);
    await computeGroupStatuses(deps, student);
    expect(client.calls).toBe(1);
    t += 5 * 60 * 1000 + 1;
    await computeGroupStatuses(deps, student);
    expect(client.calls).toBe(2);
  });

  test("people who are not students or parents get no checks", async () => {
    const out = await computeGroupStatuses(
      { client: fake(true), lookupGroupEmail: lookup, cache: fresh() },
      { email: "m@example.test", roles: ["mentor"], status: "active" },
    );
    expect(out).toEqual([]);
  });
});

describe("createGoogleGroupsClient", () => {
  test("is null without credentials or with an unreadable key", () => {
    expect(createGoogleGroupsClient(undefined, "admin@example.test")).toBeNull();
    expect(createGoogleGroupsClient("{}", undefined)).toBeNull();
    expect(createGoogleGroupsClient("not json", "admin@example.test")).toBeNull();
    expect(createGoogleGroupsClient('{"a":1}', "admin@example.test")).toBeNull();
  });
});

describe("GET /api/groups/status", () => {
  test("is 401 without a session", async () => {
    const app = createApp();
    const response = await app.handle(new Request("http://localhost/api/groups/status"));
    expect(response.status).toBe(401);
  });
});
