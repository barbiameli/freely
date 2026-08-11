import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The Prisma schema, checked for the mistakes TypeScript cannot see.
 *
 * schema.prisma is not TypeScript, so nothing in the normal toolchain reads it:
 * tsc ignores it, eslint ignores it, and the tests never touched it. The first
 * thing that parses it is `prisma db push`, which runs on Barbara's machine,
 * which means a syntax error here reaches her as a wall of validation output
 * rather than as a failing check here.
 *
 * That is exactly what happened: the schema was given a `/** ... *\/` comment,
 * which every other file in this project uses and which Prisma does not
 * support. Twelve validation errors, and the only way to find out was to try
 * to migrate.
 */
const schema = readFileSync("prisma/schema.prisma", "utf8");

describe("prisma schema syntax", () => {
  it("uses no block comments", () => {
    // Prisma supports // and /// only. A block comment is valid-looking and
    // fatal, and it is the natural thing to write coming from any other file
    // in this repo.
    const lines = schema.split("\n");
    const offenders = lines
      .map((line, i) => ({ line: line.trim(), number: i + 1 }))
      .filter(({ line }) => line.startsWith("/*") || line.startsWith("*/") || /^\*\s/.test(line));

    expect(
      offenders.map((o) => `${o.number}: ${o.line}`),
      "Prisma only understands // and ///. Rewrite these as // comments."
    ).toEqual([]);
  });

  it("has balanced braces", () => {
    const open = (schema.match(/\{/g) ?? []).length;
    const close = (schema.match(/\}/g) ?? []).length;
    expect(open, "unbalanced braces in schema.prisma").toBe(close);
  });

  it("declares every enum that a field refers to", () => {
    // A field typed against an enum that was never declared is another error
    // only db push finds.
    const declared = new Set(
      Array.from(schema.matchAll(/^enum\s+(\w+)\s*\{/gm)).map((m) => m[1])
    );
    const models = Array.from(schema.matchAll(/^model\s+\w+\s*\{([\s\S]*?)^\}/gm));

    const known = new Set([
      "String",
      "Int",
      "Float",
      "Boolean",
      "DateTime",
      "Json",
      "Bytes",
      "Decimal",
      "BigInt",
    ]);
    const modelNames = new Set(
      Array.from(schema.matchAll(/^model\s+(\w+)\s*\{/gm)).map((m) => m[1])
    );

    const unknown: string[] = [];
    for (const [, body] of models) {
      for (const raw of body.split("\n")) {
        const line = raw.trim();
        if (!line || line.startsWith("//") || line.startsWith("@@")) continue;
        const match = line.match(/^\w+\s+(\w+)/);
        if (!match) continue;
        const type = match[1];
        if (known.has(type) || modelNames.has(type) || declared.has(type)) continue;
        unknown.push(line);
      }
    }

    expect(unknown, "these fields use a type that is not declared anywhere").toEqual([]);
  });
});
