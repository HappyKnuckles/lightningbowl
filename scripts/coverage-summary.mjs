/**
 * Renders coverage/app/coverage-summary.json as markdown, for the CI job summary and
 * the pull request comment. Produced by `npm run test:coverage`.
 */
import { readFileSync } from "node:fs";

const MARKER = "<!-- lightning-bowl-coverage -->";
const SUMMARY = "coverage/app/coverage-summary.json";

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

process.stdout.write(
  `${MARKER}

### Coverage — ${total.lines.pct}% of lines

| Metric | % | Covered | |
| --- | --- | --- | --- |
${rows}

<sub>From \`npm run test:coverage\`. Line coverage must stay above the \`coverageThresholds\` floor on the \`test\` target in \`angular.json\`.</sub>
`,
);
