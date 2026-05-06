# TypeScript: `vitest/browser` exports missing in npm workspace monorepo

## Summary

In an npm workspaces monorepo, when `vitest` is hoisted to the root `node_modules` but `@vitest/browser-playwright` (or `@vitest/browser-webdriverio`) is installed only in a workspace's local `node_modules`, TypeScript cannot resolve the `page`, `userEvent`, and `server` exports from `vitest/browser`.

## Steps to reproduce

```sh
git clone https://github.com/julienw/vitest-types-issue
npm ci
cd packages/frontend
npx tsc
```

## Actual output

```
../../node_modules/vitest/dist/browser.d.ts(34,13): error TS2304: Cannot find name 'BufferEncoding'.
../../node_modules/vitest/dist/browser.d.ts(38,37): error TS2304: Cannot find name 'BufferEncoding'.
../../node_modules/vitest/dist/browser.d.ts(39,55): error TS2304: Cannot find name 'BufferEncoding'.
test/example.test.ts(2,10): error TS2305: Module '"vitest/browser"' has no exported member 'page'.
test/example.test.ts(2,16): error TS2305: Module '"vitest/browser"' has no exported member 'userEvent'.
test/example.test.ts(2,27): error TS2305: Module '"vitest/browser"' has no exported member 'server'.
```

(`BufferEncoding` errors are a separate issue, already suppressed by `skipLibCheck: true` in most projects.)

## Expected output

`tsc` exits with no errors (or only the unrelated `BufferEncoding` ones).

## Root cause

`vitest/browser` resolves to `node_modules/vitest/browser/context.d.ts`, which contains:

```ts
// @ts-ignore -- @vitest/browser-playwright might not be installed
export * from '@vitest/browser-playwright/context'
```

When TypeScript resolves that re-export, it looks for `@vitest/browser-playwright` by walking **up from `vitest`'s install location** (`node_modules/vitest/`). In a monorepo where vitest is hoisted to the root but `@vitest/browser-playwright` is only in a workspace's `node_modules/`, that walk never reaches the workspace — so the re-export silently resolves to nothing (suppressed by `// @ts-ignore`), and `page`, `userEvent`, `server` are not exported.

The actual package layout that triggers the bug (captured in `package-lock.json`):

```
node_modules/
  vitest/                          ← hoisted to root
  @vitest/browser/                 ← hoisted to root
packages/
  frontend/
    node_modules/
      @vitest/
        browser-playwright/        ← only here, not at root
```

## Notes on reproducibility

The bug only triggers when npm produces the split layout shown above. If npm happens to co-locate `vitest` and `@vitest/browser-playwright` in the same `node_modules/` directory (for example because a version mismatch forces a local copy of vitest into the workspace), TypeScript can resolve the chain and the error disappears. This makes the bug sensitive to npm hoisting decisions, which can change across installs as dependency versions are bumped.

## Environment

- vitest: 4.1.5
- @vitest/browser-playwright: 4.1.5
- typescript: 6.0.3
- npm: 11.x (workspaces)

## Workarounds

**Option A** — Add `@vitest/browser-playwright` to the **root** `package.json` `devDependencies`. npm will hoist it alongside `vitest`, and TypeScript can resolve the re-export:

```json
{
  "devDependencies": {
    "@vitest/browser-playwright": "^4.1.5"
  }
}
```

**Option B** — Add `paths` to the workspace's `tsconfig.json`, pointing TypeScript at the workspace-local copy. TypeScript applies `paths` globally during compilation, including when resolving imports inside `node_modules` declaration files:

```json
{
  "compilerOptions": {
    "paths": {
      "@vitest/browser-playwright": ["./node_modules/@vitest/browser-playwright"],
      "@vitest/browser-playwright/*": ["./node_modules/@vitest/browser-playwright/*"]
    }
  }
}
```
