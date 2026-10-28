# Scriptsmith

[![Tests](https://github.com/syedalimuj725-cell/scriptsmith/actions/workflows/test.yml/badge.svg)](https://github.com/syedalimuj725-cell/scriptsmith/actions/workflows/test.yml)

**Try it live:** https://syedalimuj725-cell.github.io/scriptsmith/

Type or speak a plain-English request. Get a ready-to-review PowerShell script and a Python script.

Scriptsmith runs 100% offline. It uses no AI model. A rule-based engine reads your words, pulls out the details, and fills a hand-written script template.

**Example:** `delete log files older than 14 days in downloads`
→ the app finds the folder, the age, and the file type, then builds both scripts.

## Features

- **Type or speak.** Voice input uses the browser's speech engine (Chrome, Edge, Safari). It works on phones too.
- **Two languages.** Every request gives you PowerShell (`.ps1`) and Python (`.py`) with a copy button.
- **Safe by default.** Destructive scripts start in dry-run mode (`-WhatIf` / `DRY_RUN = True`).
- **Shows its work.** The app shows which intent matched and which values it found or set by default.
- **No backend.** It is a static web app. You can host it free and add it to your phone home screen.

## Built-in automations

| Automation | Example request |
|---|---|
| Delete old files | delete files older than 30 days in downloads |
| Clear temp files | clear temp files and cache |
| Start / stop / restart a service | restart the spooler service |
| Kill a process | kill the chrome process |
| Find largest files | find the top 10 largest files on C drive |
| Backup / zip a folder | backup my documents folder to a zip |
| Bulk rename files | rename files in downloads, replace "IMG_" with "vacation_" |
| Organize files by type | organize my downloads folder by file type |
| Disk space report | show disk space on all drives |
| Check host is up | check if 10.0.0.5 is online |
| Export installed programs | export a list of installed programs to csv |
| System info snapshot | get system info and specs |
| Find duplicate files | find duplicate files in my pictures folder |
| Schedule a script daily | schedule a script to run every day at 7am |

## How it works

1. **Intent match.** Each template has keyword groups. A request must hit one word from every group. Veto words stop false matches.
2. **Slot extraction.** Small parsers pull out folders, days, file types, sizes, hostnames, service names, and times.
3. **Generation.** The template turns those values into PowerShell and Python.

## Testing

Every push runs an automatic test suite on GitHub Actions:

- **Engine tests:** 40+ requests check that each one matches the right automation and pulls out the right values. Some requests must match nothing, so the app does not guess.
- **Python check:** every generated `.py` script must compile, with syntax warnings treated as errors.
- **PowerShell check:** on Windows, every generated `.ps1` script goes through the real PowerShell parser and PSScriptAnalyzer.

Run the engine tests yourself with `npm test`.

## Run it locally

```bash
npm install
npm run dev
```

## Deploy

A GitHub Actions workflow builds the app and publishes it to GitHub Pages on every push to `main`. In the repo, open **Settings → Pages** and set **Source** to **GitHub Actions**.

## Add a new automation

Add an entry to the `TEMPLATES` array in `src/engine.js`, then add a test request to `test/cases.mjs`. Each entry needs keyword groups, a `parse` function, `chips` for the readout, and `ps` and `py` generators.

## Tech

React 18 · Vite · Web Speech API

## License

MIT
