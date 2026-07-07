# Release Checklist

## Package Name

`learning-process-manager` was checked against the npm registry during setup and was not published at that time. Re-check before the first public release:

```bash
npm view learning-process-manager name version --json
```

An npm `E404` response means the name is currently unclaimed.

## Pre-Release Verification

```bash
npm ci
npm run verify
```

`npm run verify` runs lint, typecheck, unit tests, build, e2e tests, audit, and `npm pack --dry-run`.

## Manual Cross-Platform Testing

Create a tarball:

```bash
npm pack
```

Install it on Windows, macOS, or Linux:

```bash
npm install -g ./learning-process-manager-1.0.0.tgz
learn init
learn doctor
learn new "Smoke Test" --topics 1
learn list --json
```

For remote testers, attach the `.tgz` to a GitHub Release or any trusted file distribution channel. Once the package is stable, publish to npm:

```bash
npm publish
```

For beta testing:

```bash
npm publish --tag beta
npm install -g learning-process-manager@beta
```

## Source Maps

The published package currently includes source maps from `dist/*.map`. They make stack traces and debugger output easier to map back to TypeScript source. Because this is an open-source CLI and the package is small, keep them unless package size or source disclosure becomes a concrete problem.
