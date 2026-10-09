import { readFileSync } from "node:fs";
import { evaluateCommerceEconomics } from "../src/lib/commerce/economics.ts";

const file = process.argv[2];
if (!file) {
  process.stderr.write("Usage: node scripts/commerce-scenario.mjs <scenario.json>\n");
  process.exitCode = 2;
} else {
  try {
    const input = JSON.parse(readFileSync(file, "utf8"));
    const result = evaluateCommerceEconomics(input);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "FINANCE_ERROR"}\n`);
    process.exitCode = 1;
  }
}
