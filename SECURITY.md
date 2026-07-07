# Security Policy

## Supported Versions

Security fixes target the latest released version.

## Reporting a Vulnerability

This project does not have a dedicated private security contact yet. Until one is published, avoid posting secrets or private paths in public issues.

For local data issues, include:

- `learn --version`
- `node --version`
- operating system
- `learn doctor --json` output with private paths redacted

## Local Data Model

Learning Process Manager stores data on the local filesystem. It does not require a network service for normal CLI operations.

Do not include API keys, passwords, or private credentials in learning notes, flashcards, issue reports, or test fixtures.
