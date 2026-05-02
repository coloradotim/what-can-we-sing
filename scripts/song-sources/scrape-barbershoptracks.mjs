#!/usr/bin/env node

import { main } from "../scrape-barbershoptracks-suggestions.mjs";

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
