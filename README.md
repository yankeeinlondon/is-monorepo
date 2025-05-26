# `is-monorepo`

A simple ESM & CJS module for testing whether a given directory is a monorepo, what type, and what modules it has.

## Install

```sh
pnpm install @yankeeinlondon/is-monorepo
```

## Usage

```ts
import { isMonorepo, monorepoModules } from "@yankeeinlondon/is-monorepo"''

const mono = isMonorepo("path/to/repo");

if(mono) {
    const packages = monoRepoModules("path/to/repo");
}
```
