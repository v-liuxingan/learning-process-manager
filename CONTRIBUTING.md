# Contributing

Thanks for helping improve Learning Process Manager.

## Development Setup

```bash
npm ci
npm run verify
```

Use Node.js 20 or newer for development. The package supports Node.js 18+, but CI validates the current LTS runtime.

## Local Workflow

1. Create a focused branch.
2. Make the smallest change that solves the issue.
3. Add or update tests when behavior changes.
4. Run `npm run verify`.
5. Open a pull request with the problem, solution, and verification steps.

## CLI Data During Tests

Do not write tests against a fixed local user path. Use temporary directories and one of these overrides:

```bash
LEARN_HOME=/tmp/learning-process-manager
LEARN_INDEX_PATH=/tmp/learning-projects.json
LEARN_PROJECTS_DIR=/tmp/learning-projects
```

`indexPath` and `defaultProjectsDir` are separate concepts. Keep them separate in implementation and documentation.

## Release Checks

Before publishing or attaching a package tarball to a release:

```bash
npm run verify
npm pack --dry-run
```

For manual cross-platform testing, create a tarball with `npm pack` and install it on another machine:

```bash
npm install -g ./learning-process-manager-1.0.0.tgz
learn init
learn doctor
```
