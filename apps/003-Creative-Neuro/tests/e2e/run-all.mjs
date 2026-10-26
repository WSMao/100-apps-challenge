/**
 * Creative-Neuro E2E Test Suite Runner
 * Runs all 4 tiers of tests and outputs TAP/summary reports
 */

import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const files = [
  path.join(__dirname, 'tier1_feature.test.ts'),
  path.join(__dirname, 'tier2_boundary.test.ts'),
  path.join(__dirname, 'tier3_combinations.test.ts'),
  path.join(__dirname, 'tier4_realworld.test.ts'),
];

console.log('=================================================================');
console.log('🚀 Running Creative-Neuro 4-Tier E2E Test Suite');
console.log('=================================================================');

const testStream = run({
  files,
  concurrency: true,
});

testStream.compose(new spec()).pipe(process.stdout);

testStream.on('error', (err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
