import { describe, expect, it } from "vitest";
import { deepmerge } from "deepmerge-ts";
import { defineConfig } from "@prisma/config";

// Prisma uses deepmerge's stable public function. Exercise that API rather than
// suppressing the advisory or migrating the team's ORM to a new major version.
describe("patched Prisma configuration dependency", () => {
  it("preserves nested configuration merging without mutating inputs", () => {
    const first = { migrations: { path: "prisma/migrations" }, nested: { a: 1 } };
    expect(deepmerge(first, { nested: { b: 2 } })).toEqual({ migrations: { path: "prisma/migrations" }, nested: { a: 1, b: 2 } });
    expect(first.nested).toEqual({ a: 1 });
  });
  it("supports Prisma's configuration entry point", () => {
    const config = defineConfig({ schema: "prisma/schema.prisma", migrations: { path: "prisma/migrations" } });
    expect(config.schema).toBe("prisma/schema.prisma");
    expect(config.migrations).toEqual({ path: "prisma/migrations" });
  });
  it("handles circular input without exhausting the stack", () => {
    const input: Record<string, unknown> = {}; input.self = input;
    expect(() => deepmerge(input, { other: true })).not.toThrow();
  });
});
