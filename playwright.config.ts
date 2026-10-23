import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e', workers:1, timeout:45000, retries:0,
  reporter:[['list'],['html',{open:'never'}]],
  webServer:{ command:'node tests/e2e/server.mjs',port:4174,reuseExistingServer:false },
});
