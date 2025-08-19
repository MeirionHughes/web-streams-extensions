debug files should be in ./.debug
debug files should be ts files and run with tsx ./.debug/{filename}.ts
when focusing on a specific spec file that needs testing, isolate it by running:
  npx mocha ./.debug/parse-marbles.spec.ts