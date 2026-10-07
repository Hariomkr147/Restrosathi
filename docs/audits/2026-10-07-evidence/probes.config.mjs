import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('../../../src', import.meta.url)) } },
  test: { include: ['docs/audits/2026-10-07-evidence/probes.test.js'], environment: 'node' },
});
