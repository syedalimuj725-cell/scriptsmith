# Security Policy

## Reporting a vulnerability

Please do not open a public issue for security problems.

Report it privately through GitHub instead: open the **Security** tab of this repository and click **Report a vulnerability**. Only the maintainer can see the report.

Please include the steps to reproduce the problem and what you expected to happen.

## Supported versions

Only the latest version on the `main` branch gets fixes.

## Design notes

- Scriptsmith runs fully in the browser. It has no backend, makes no network calls, and stores nothing.
- The published site sends a strict Content Security Policy: it can only load its own files.
- Paths you type are placed in single-quoted PowerShell strings, so `$(...)` or `$var` in a path stays plain text and never runs.
- Scripts that delete or rename files are generated in dry-run mode (`-WhatIf` / `DRY_RUN = True`). Always read a generated script before you run it.
