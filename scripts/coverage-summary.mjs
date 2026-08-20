/**
 * Renders coverage/coverage-summary.json as markdown, for the CI job summary and
 * the pull request comment. Produced by `npm run test:coverage`.
 */
import { readFileSync } from "node:fs";

import { coveragePipelineStatus } from "./coverage-pipeline-status.mjs";

const MARKER = "<!-- lightning-bowl-coverage -->";
const SUMMARY = "coverage/coverage-summary.json";

let total;
try {
  ({ total } = JSON.parse(readFileSync(SUMMARY, "utf8")));
} catch {
  process.stdout.write(`${MARKER}\n### Coverage\n\nNo coverage report was produced — the test run failed before writing \`${SUMMARY}\`.\n`);
  process.exit(0);
}

const bar = (pct) => {
  const filled = Math.round(pct / 5);
  return `\`${"█".repeat(filled)}${"░".repeat(20 - filled)}\``;
};

const rows = [
  ["Lines", total.lines],
  ["Statements", total.statements],
  ["Functions", total.functions],
  ["Branches", total.branches],
]
  .map(([label, m]) => `| ${label} | **${m.pct}%** | ${m.covered} / ${m.total} | ${bar(m.pct)} |`)
  .join("\n");

const status = coveragePipelineStatus();
const banner = status.obsolete ? `> [!NOTE]\n> ${status.headline} See \`scripts/coverage-pipeline-status.mjs\` for the cleanup steps.\n\n` : "";

process.stdout.write(
  `${MARKER}
${banner}
### Coverage — ${total.lines.pct}% of lines

| Metric | % | Covered | |
| --- | --- | --- | --- |
${rows}

<sub>From \`npm run test:coverage\`. Line coverage must stay above the threshold in \`vitest.coverage.config.ts\`.</sub>
`,
);
