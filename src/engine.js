/* ============================================================
   SCRIPTSMITH ENGINE — rule-based intent matching + templates.
   Pure JavaScript (no React) so tests can import it directly.
   ============================================================ */

/* ---------- slot extractors ---------- */

const KNOWN_FOLDERS = {
  downloads: { label: "Downloads", ps: `"$env:USERPROFILE\\Downloads"`, py: `Path.home() / "Downloads"` },
  desktop: { label: "Desktop", ps: `"$env:USERPROFILE\\Desktop"`, py: `Path.home() / "Desktop"` },
  documents: { label: "Documents", ps: `"$env:USERPROFILE\\Documents"`, py: `Path.home() / "Documents"` },
  pictures: { label: "Pictures", ps: `"$env:USERPROFILE\\Pictures"`, py: `Path.home() / "Pictures"` },
  temp: { label: "Temp", ps: `"$env:TEMP"`, py: `Path(os.environ.get("TEMP", "/tmp"))` },
};

function extractFolder(text, fallback = "downloads") {
  const quoted = text.match(/["']([A-Za-z]:\\[^"']+|\/[^"']+)["']/);
  if (quoted) {
    const v = quoted[1];
    return { label: v, ps: `"${v}"`, py: `Path(r"${v}")`, literal: true };
  }
  const drive = text.match(/([A-Za-z]:\\[\w\\ .\-()]+?)(?=\s+(?:older|and|every|that|to|for)\b|[.,]|$)/);
  if (drive) {
    const v = drive[1].trim();
    return { label: v, ps: `"${v}"`, py: `Path(r"${v}")`, literal: true };
  }
  // A whole drive: "on C drive", "the D: drive", "on C:" (skips "a drive", which is an article).
  const whole =
    text.match(/\b(?:on|in|of|from|across)\s+(?:the\s+)?([b-z])\s*:?\s*drive\b/i) ||
    text.match(/\b([b-z]):\\?(?=[\s,.]|$)/i);
  if (whole) {
    const L = whole[1].toUpperCase();
    return { label: `${L}:\\`, ps: `"${L}:\\"`, py: `Path("${L}:/")`, literal: true };
  }
  for (const key of Object.keys(KNOWN_FOLDERS)) {
    if (new RegExp(`\\b${key}\\b`, "i").test(text)) return KNOWN_FOLDERS[key];
  }
  return { ...KNOWN_FOLDERS[fallback], defaulted: true };
}

function extractDays(text, def = 30) {
  const m = text.match(/(\d+)\s*day/i);
  if (m) return { value: parseInt(m[1]), defaulted: false };
  const w = text.match(/(\d+)\s*week/i);
  if (w) return { value: parseInt(w[1]) * 7, defaulted: false };
  const mo = text.match(/(\d+)\s*month/i);
  if (mo) return { value: parseInt(mo[1]) * 30, defaulted: false };
  return { value: def, defaulted: true };
}

function extractExt(text) {
  const dot = text.match(/\.([a-z0-9]{1,5})\b/i);
  if (dot) return { value: dot[1].toLowerCase(), defaulted: false };
  const named = text.match(/\b(pdf|log|txt|csv|jpg|jpeg|png|mp4|zip|docx|xlsx|iso|tmp|bak)s?\s+files?/i);
  if (named) return { value: named[1].toLowerCase(), defaulted: false };
  return { value: "*", defaulted: true };
}

function extractSizeMB(text, def = 100) {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(gb|gig)/i);
  if (m) return { value: Math.round(parseFloat(m[1]) * 1024), defaulted: false };
  const mb = text.match(/(\d+)\s*(mb|meg)/i);
  if (mb) return { value: parseInt(mb[1]), defaulted: false };
  return { value: def, defaulted: true };
}

function extractCount(text, def = 10) {
  const m = text.match(/\b(?:top|first|largest)\s+(\d+)/i);
  if (m) return { value: parseInt(m[1]), defaulted: false };
  return { value: def, defaulted: true };
}

function extractNameAfter(text, nouns) {
  // "restart the spooler service" | "service called spooler" | "kill chrome process"
  for (const noun of nouns) {
    let m = text.match(new RegExp(`${noun}\\s+(?:called|named)?\\s*["']?([\\w.\\-]+)["']?`, "i"));
    if (m && !/^(on|at|every|and|the|a)$/i.test(m[1])) return { value: m[1], defaulted: false };
    m = text.match(new RegExp(`(?:the\\s+)?["']?([\\w.\\-]+)["']?\\s+${noun}`, "i"));
    if (m && !/^(the|a|an|my|every|any)$/i.test(m[1])) return { value: m[1], defaulted: false };
  }
  return { value: "NAME_HERE", defaulted: true };
}

function extractHost(text) {
  const ip = text.match(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/);
  if (ip) return { value: ip[1], defaulted: false };
  const host = text.match(/\b(?:ping|check|reach|host|server)\s+["']?([\w\-]+(?:\.[\w\-]+)+)["']?/i);
  if (host) return { value: host[1], defaulted: false };
  const bare = text.match(/\b(?:ping|check)\s+(?:if\s+)?(?:host\s+|server\s+)?["']?([\w\-]{2,})["']?\s*(?:is)?\s*(?:up|online|alive|reachable)?/i);
  if (bare && !/^(if|the|my|is)$/i.test(bare[1])) return { value: bare[1], defaulted: false };
  return { value: "HOSTNAME", defaulted: true };
}

function extractReplacePair(text) {
  const m = text.match(/replace\s+["']?([\w .\-]+?)["']?\s+with\s+["']?([\w .\-]+?)["']?(?:\s+in\b|[.,]|$)/i);
  if (m) return { find: m[1].trim(), repl: m[2].trim(), defaulted: false };
  return { find: "OLD_TEXT", repl: "NEW_TEXT", defaulted: true };
}

function extractTime(text) {
  const m = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (m) {
    let h = parseInt(m[1]) % 12;
    if (m[3].toLowerCase() === "pm") h += 12;
    return { value: `${String(h).padStart(2, "0")}:${m[2] || "00"}`, defaulted: false };
  }
  const t = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (t) return { value: `${String(t[1]).padStart(2, "0")}:${t[2]}`, defaulted: false };
  return { value: "09:00", defaulted: true };
}

/* ---------- template library ----------
   Each template: keyword GROUPS (every group must match one synonym),
   slot extraction, and two generators. Add your own at the bottom. */

export const TEMPLATES = [
  {
    id: "delete-old",
    name: "Delete old files",
    example: "delete files older than 30 days in downloads",
    groups: [["delete", "remove", "clean up", "clear", "purge"], ["older", "old", "days", "week", "month"]],
    veto: ["temp", "cache", "duplicate"],
    parse(t) {
      return { folder: extractFolder(t), days: extractDays(t), ext: extractExt(t) };
    },
    chips: (s) => [
      { k: "folder", v: s.folder.label, d: s.folder.defaulted },
      { k: "older than", v: s.days.value + " days", d: s.days.defaulted },
      { k: "type", v: s.ext.value === "*" ? "all files" : "." + s.ext.value, d: s.ext.defaulted },
    ],
    ps: (s) => `# Delete files older than ${s.days.value} days — ${s.folder.label}
# Dry run first: keep -WhatIf on the Remove-Item line, then delete it to run for real.
$Path   = ${s.folder.ps}
$Cutoff = (Get-Date).AddDays(-${s.days.value})

Get-ChildItem -Path $Path -Filter "*.${s.ext.value === "*" ? "*" : s.ext.value}" -File -Recurse |
  Where-Object { $_.LastWriteTime -lt $Cutoff } |
  ForEach-Object {
    Write-Host "Deleting: $($_.FullName)"
    Remove-Item $_.FullName -Force -WhatIf
  }`,
    py: (s) => `#!/usr/bin/env python3
r"""Delete files older than ${s.days.value} days — ${s.folder.label}. DRY_RUN=True prints only."""
import os, time
from pathlib import Path

DRY_RUN = True
target = ${s.folder.py}
cutoff = time.time() - ${s.days.value} * 86400

for f in target.rglob("*${s.ext.value === "*" ? "" : "." + s.ext.value}"):
    if f.is_file() and f.stat().st_mtime < cutoff:
        print(f"Deleting: {f}")
        if not DRY_RUN:
            f.unlink()`,
  },
  {
    id: "clean-temp",
    name: "Clear temp files",
    example: "clear temp files and cache",
    groups: [["clear", "clean", "delete", "purge", "wipe"], ["temp", "cache", "tmp"]],
    parse: () => ({}),
    chips: () => [{ k: "targets", v: "%TEMP%, Windows\\Temp", d: false }],
    ps: () => `# Clear user + system temp (run elevated for C:\\Windows\\Temp)
$targets = @("$env:TEMP", "C:\\Windows\\Temp")
foreach ($t in $targets) {
  Get-ChildItem $t -Recurse -Force -ErrorAction SilentlyContinue |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "Cleared: $t"
}`,
    py: () => `#!/usr/bin/env python3
import os, shutil, tempfile
from pathlib import Path

t = Path(tempfile.gettempdir())
for item in t.iterdir():
    try:
        shutil.rmtree(item) if item.is_dir() else item.unlink()
    except (PermissionError, OSError):
        pass  # in use — skip
print(f"Cleared {t} (skipped locked files)")`,
  },
  {
    id: "service",
    name: "Start / stop / restart a service",
    example: "restart the spooler service",
    groups: [["restart", "stop", "start", "bounce"], ["service"]],
    parse(t) {
      const action = /restart|bounce/i.test(t) ? "Restart" : /stop/i.test(t) ? "Stop" : "Start";
      return { action, svc: extractNameAfter(t, ["service"]) };
    },
    chips: (s) => [
      { k: "action", v: s.action, d: false },
      { k: "service", v: s.svc.value, d: s.svc.defaulted },
    ],
    ps: (s) => `# ${s.action} service: ${s.svc.value} (run as Administrator)
$svc = "${s.svc.value}"
${s.action}-Service -Name $svc -Force -ErrorAction Stop
Get-Service -Name $svc | Select-Object Name, Status, StartType`,
    py: (s) => `#!/usr/bin/env python3
"""${s.action} Windows service via sc.exe (run elevated)."""
import subprocess, sys

SVC = "${s.svc.value}"
cmds = {"Restart": ["stop", "start"], "Stop": ["stop"], "Start": ["start"]}
for verb in cmds["${s.action}"]:
    r = subprocess.run(["sc", verb, SVC], capture_output=True, text=True)
    print(r.stdout or r.stderr)
    if r.returncode not in (0, 1062):  # 1062 = already stopped
        sys.exit(r.returncode)`,
  },
  {
    id: "kill-proc",
    name: "Kill a process",
    example: "kill the chrome process",
    groups: [["kill", "end", "terminate", "force close"], ["process", "task", "app"]],
    parse: (t) => ({ proc: extractNameAfter(t, ["process", "task", "app"]) }),
    chips: (s) => [{ k: "process", v: s.proc.value, d: s.proc.defaulted }],
    ps: (s) => `# Kill all "${s.proc.value}" processes
Get-Process -Name "${s.proc.value}" -ErrorAction SilentlyContinue |
  ForEach-Object {
    Write-Host "Killing PID $($_.Id) — $($_.ProcessName)"
    Stop-Process -Id $_.Id -Force
  }`,
    py: (s) => `#!/usr/bin/env python3
import subprocess, platform

NAME = "${s.proc.value}"
if platform.system() == "Windows":
    subprocess.run(["taskkill", "/F", "/IM", f"{NAME}.exe"])
else:
    subprocess.run(["pkill", "-f", NAME])`,
  },
  {
    id: "large-files",
    name: "Find largest files",
    example: "find the top 10 largest files on C drive",
    groups: [["find", "list", "show", "what"], ["largest", "biggest", "large files", "taking up space", "big files"]],
    parse: (t) => ({ folder: extractFolder(t, "downloads"), n: extractCount(t), size: extractSizeMB(t, 100) }),
    chips: (s) => [
      { k: "folder", v: s.folder.label, d: s.folder.defaulted },
      { k: "top", v: s.n.value, d: s.n.defaulted },
      { k: "min size", v: s.size.value + " MB", d: s.size.defaulted },
    ],
    ps: (s) => `# Top ${s.n.value} largest files over ${s.size.value} MB — ${s.folder.label}
Get-ChildItem -Path ${s.folder.ps} -File -Recurse -ErrorAction SilentlyContinue |
  Where-Object { $_.Length -gt ${s.size.value}MB } |
  Sort-Object Length -Descending |
  Select-Object -First ${s.n.value} @{N="SizeMB";E={[math]::Round($_.Length/1MB,1)}}, FullName |
  Format-Table -AutoSize`,
    py: (s) => `#!/usr/bin/env python3
import os
from pathlib import Path

target = ${s.folder.py}
files = []
for f in target.rglob("*"):
    try:
        if f.is_file() and f.stat().st_size > ${s.size.value} * 1024**2:
            files.append((f.stat().st_size, f))
    except OSError:
        pass

for size, f in sorted(files, reverse=True)[:${s.n.value}]:
    print(f"{size/1024**2:>10.1f} MB  {f}")`,
  },
  {
    id: "backup",
    name: "Backup / zip a folder",
    example: "backup my documents folder to a zip",
    groups: [["backup", "back up", "zip", "archive", "compress"]],
    veto: ["unzip", "extract"],
    parse: (t) => ({ folder: extractFolder(t, "documents") }),
    chips: (s) => [{ k: "source", v: s.folder.label, d: s.folder.defaulted }],
    ps: (s) => `# Zip ${s.folder.label} to Desktop with a date stamp
$Source = ${s.folder.ps}
$Stamp  = Get-Date -Format "yyyy-MM-dd_HHmm"
$Dest   = "$env:USERPROFILE\\Desktop\\backup_$Stamp.zip"
Compress-Archive -Path "$Source\\*" -DestinationPath $Dest -CompressionLevel Optimal
Write-Host "Backup written to $Dest"`,
    py: (s) => `#!/usr/bin/env python3
import shutil
from datetime import datetime
from pathlib import Path
import os

source = ${s.folder.py}
stamp = datetime.now().strftime("%Y-%m-%d_%H%M")
dest = Path.home() / "Desktop" / f"backup_{stamp}"
shutil.make_archive(str(dest), "zip", root_dir=source)
print(f"Backup written to {dest}.zip")`,
  },
  {
    id: "rename",
    name: "Bulk rename files",
    example: `rename files in downloads, replace "IMG_" with "vacation_"`,
    groups: [["rename", "bulk rename"]],
    parse: (t) => ({ folder: extractFolder(t), pair: extractReplacePair(t) }),
    chips: (s) => [
      { k: "folder", v: s.folder.label, d: s.folder.defaulted },
      { k: "find", v: s.pair.find, d: s.pair.defaulted },
      { k: "replace", v: s.pair.repl, d: s.pair.defaulted },
    ],
    ps: (s) => `# Rename: "${s.pair.find}" → "${s.pair.repl}" in ${s.folder.label}
# Remove -WhatIf to apply.
Get-ChildItem -Path ${s.folder.ps} -File |
  Where-Object { $_.Name -like "*${s.pair.find}*" } |
  Rename-Item -NewName { $_.Name -replace [regex]::Escape("${s.pair.find}"), "${s.pair.repl}" } -WhatIf`,
    py: (s) => `#!/usr/bin/env python3
import os
from pathlib import Path

DRY_RUN = True
folder = ${s.folder.py}
for f in folder.iterdir():
    if f.is_file() and "${s.pair.find}" in f.name:
        new = f.with_name(f.name.replace("${s.pair.find}", "${s.pair.repl}"))
        print(f"{f.name}  →  {new.name}")
        if not DRY_RUN:
            f.rename(new)`,
  },
  {
    id: "organize",
    name: "Organize files by type",
    example: "organize my downloads folder by file type",
    groups: [["organize", "sort", "tidy", "group"], ["type", "extension", "folder", "files"]],
    parse: (t) => ({ folder: extractFolder(t) }),
    chips: (s) => [{ k: "folder", v: s.folder.label, d: s.folder.defaulted }],
    ps: (s) => `# Sort ${s.folder.label} into subfolders by extension
$Path = ${s.folder.ps}
Get-ChildItem -Path $Path -File | ForEach-Object {
  $ext = if ($_.Extension) { $_.Extension.TrimStart(".").ToUpper() } else { "NO_EXT" }
  $dest = Join-Path $Path $ext
  if (-not (Test-Path $dest)) { New-Item -ItemType Directory -Path $dest | Out-Null }
  Move-Item $_.FullName -Destination $dest
}
Write-Host "Organized $Path by extension."`,
    py: (s) => `#!/usr/bin/env python3
import os
from pathlib import Path

folder = ${s.folder.py}
for f in [p for p in folder.iterdir() if p.is_file()]:
    ext = f.suffix.lstrip(".").upper() or "NO_EXT"
    dest = folder / ext
    dest.mkdir(exist_ok=True)
    f.rename(dest / f.name)
print(f"Organized {folder} by extension.")`,
  },
  {
    id: "disk",
    name: "Disk space report",
    example: "show disk space on all drives",
    groups: [["disk", "drive", "storage"], ["space", "usage", "report", "free", "full"]],
    parse: () => ({}),
    chips: () => [{ k: "scope", v: "all fixed drives", d: false }],
    ps: () => `# Disk space on all fixed drives
Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" |
  Select-Object DeviceID,
    @{N="SizeGB";E={[math]::Round($_.Size/1GB,1)}},
    @{N="FreeGB";E={[math]::Round($_.FreeSpace/1GB,1)}},
    @{N="Free%";E={[math]::Round($_.FreeSpace/$_.Size*100,1)}} |
  Format-Table -AutoSize`,
    py: () => `#!/usr/bin/env python3
import shutil, string, platform
from pathlib import Path

drives = [f"{c}:\\\\" for c in string.ascii_uppercase if Path(f"{c}:\\\\").exists()] \\
         if platform.system() == "Windows" else ["/"]
for d in drives:
    total, used, free = shutil.disk_usage(d)
    print(f"{d:<6} {free/1024**3:>8.1f} GB free of {total/1024**3:.1f} GB ({free/total*100:.0f}%)")`,
  },
  {
    id: "ping",
    name: "Check host is up",
    example: "check if 10.0.0.5 is online",
    groups: [["ping", "check", "reach", "online", "up", "alive"]],
    veto: ["disk", "service", "process"],
    parse: (t) => ({ host: extractHost(t) }),
    chips: (s) => [{ k: "host", v: s.host.value, d: s.host.defaulted }],
    ps: (s) => `# Test connectivity to ${s.host.value}
$Target = "${s.host.value}"
if (Test-Connection -ComputerName $Target -Count 2 -Quiet) {
  Write-Host "$Target is UP" -ForegroundColor Green
} else {
  Write-Host "$Target is DOWN" -ForegroundColor Red
}
Test-NetConnection -ComputerName $Target | Select-Object ComputerName, RemoteAddress, PingSucceeded`,
    py: (s) => `#!/usr/bin/env python3
import subprocess, platform, sys

HOST = "${s.host.value}"
flag = "-n" if platform.system() == "Windows" else "-c"
up = subprocess.run(["ping", flag, "2", HOST], capture_output=True).returncode == 0
print(f"{HOST} is {'UP' if up else 'DOWN'}")
sys.exit(0 if up else 1)`,
  },
  {
    id: "installed",
    name: "Export installed programs",
    example: "export a list of installed programs to csv",
    groups: [["installed", "software", "programs", "apps"], ["list", "export", "inventory", "show"]],
    parse: () => ({}),
    chips: () => [{ k: "output", v: "Desktop CSV", d: false }],
    ps: () => `# Export installed software to a CSV on the Desktop
$Out = "$env:USERPROFILE\\Desktop\\installed_software.csv"
$keys = @(
  "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
  "HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*"
)
Get-ItemProperty $keys -ErrorAction SilentlyContinue |
  Where-Object DisplayName |
  Select-Object DisplayName, DisplayVersion, Publisher, InstallDate |
  Sort-Object DisplayName |
  Export-Csv -Path $Out -NoTypeInformation
Write-Host "Saved to $Out"`,
    py: () => `#!/usr/bin/env python3
"""Export installed programs (Windows registry) to CSV."""
import csv, winreg
from pathlib import Path

rows, hives = [], [r"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
                   r"SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall"]
for hive in hives:
    try:
        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, hive)
    except OSError:
        continue
    for i in range(winreg.QueryInfoKey(key)[0]):
        try:
            sub = winreg.OpenKey(key, winreg.EnumKey(key, i))
            name = winreg.QueryValueEx(sub, "DisplayName")[0]
            try:
                ver = winreg.QueryValueEx(sub, "DisplayVersion")[0]
            except OSError:
                ver = ""
            rows.append((name, ver))
        except OSError:
            pass

out = Path.home() / "Desktop" / "installed_software.csv"
with open(out, "w", newline="", encoding="utf-8") as f:
    csv.writer(f).writerows([("Name", "Version"), *sorted(set(rows))])
print(f"Saved {len(rows)} entries to {out}")`,
  },
  {
    id: "sysinfo",
    name: "System info snapshot",
    example: "get system info and specs",
    groups: [["system", "computer", "machine", "pc"], ["info", "specs", "details", "snapshot"]],
    parse: () => ({}),
    chips: () => [{ k: "scope", v: "OS, CPU, RAM, uptime", d: false }],
    ps: () => `# Quick system snapshot
$os  = Get-CimInstance Win32_OperatingSystem
$cpu = Get-CimInstance Win32_Processor
[PSCustomObject]@{
  Computer = $env:COMPUTERNAME
  OS       = $os.Caption
  Build    = $os.BuildNumber
  CPU      = $cpu.Name
  RAM_GB   = [math]::Round($os.TotalVisibleMemorySize/1MB,1)
  Uptime   = (Get-Date) - $os.LastBootUpTime
  User     = $env:USERNAME
} | Format-List`,
    py: () => `#!/usr/bin/env python3
import platform, socket, os

print(f"Host:     {socket.gethostname()}")
print(f"OS:       {platform.system()} {platform.release()} ({platform.version()})")
print(f"CPU:      {platform.processor() or platform.machine()}")
print(f"Cores:    {os.cpu_count()}")
print(f"Python:   {platform.python_version()}")
print(f"User:     {os.environ.get('USERNAME') or os.environ.get('USER')}")`,
  },
  {
    id: "duplicates",
    name: "Find duplicate files",
    example: "find duplicate files in my pictures folder",
    groups: [["duplicate", "dupes", "duplicated"]],
    parse: (t) => ({ folder: extractFolder(t, "downloads") }),
    chips: (s) => [{ k: "folder", v: s.folder.label, d: s.folder.defaulted }],
    ps: (s) => `# Find duplicates by hash — ${s.folder.label} (report only, deletes nothing)
Get-ChildItem -Path ${s.folder.ps} -File -Recurse |
  Get-FileHash -Algorithm MD5 |
  Group-Object Hash | Where-Object Count -gt 1 |
  ForEach-Object {
    Write-Host "--- duplicate group ---" -ForegroundColor Yellow
    $_.Group.Path
  }`,
    py: (s) => `#!/usr/bin/env python3
import hashlib
from pathlib import Path
from collections import defaultdict
import os

folder = ${s.folder.py}
seen = defaultdict(list)
for f in folder.rglob("*"):
    if f.is_file():
        h = hashlib.md5(f.read_bytes()).hexdigest()
        seen[h].append(f)

for h, files in seen.items():
    if len(files) > 1:
        print("--- duplicate group ---")
        for f in files: print(f"  {f}")`,
  },
  {
    id: "schedule",
    name: "Schedule a script daily",
    example: "schedule a script to run every day at 7am",
    groups: [["schedule", "every day", "daily", "cron", "recurring"]],
    parse: (t) => ({ time: extractTime(t) }),
    chips: (s) => [{ k: "runs at", v: s.time.value + " daily", d: s.time.defaulted }],
    ps: (s) => `# Register a daily scheduled task at ${s.time.value} (run as Administrator)
$Script  = "C:\\Scripts\\my_task.ps1"   # <- point at your script
$Action  = New-ScheduledTaskAction -Execute "powershell.exe" \`
             -Argument "-NoProfile -ExecutionPolicy Bypass -File \`"$Script\`""
$Trigger = New-ScheduledTaskTrigger -Daily -At "${s.time.value}"
Register-ScheduledTask -TaskName "MyDailyTask" -Action $Action -Trigger $Trigger \`
  -Description "Created by Scriptsmith" -RunLevel Highest
Write-Host "Task registered — runs daily at ${s.time.value}"`,
    py: (s) => `#!/usr/bin/env python3
"""Cross-platform: registers Task Scheduler job on Windows, prints crontab line elsewhere."""
import platform, subprocess

SCRIPT = r"C:\\Scripts\\my_task.py"   # <- point at your script
TIME = "${s.time.value}"

if platform.system() == "Windows":
    subprocess.run(["schtasks", "/Create", "/TN", "MyDailyTask", "/SC", "DAILY",
                    "/ST", TIME, "/TR", f'python "{SCRIPT}"', "/F"], check=True)
    print(f"Task registered — daily at {TIME}")
else:
    h, m = TIME.split(":")
    print(f"Add to crontab (crontab -e):\\n{m} {h} * * * python3 {SCRIPT}")`,
  },
];

/* ---------- intent engine ---------- */

// Whole-word match with simple plural/past endings, so "up" no longer fires
// inside "duplicate" or "update", and "end" no longer fires inside "backend".
const wordCache = new Map();
export function hasWord(text, syn) {
  let re = wordCache.get(syn);
  if (!re) {
    const esc = syn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    re = new RegExp(`\\b${esc}(?:s|es|d|ed)?\\b`, "i");
    wordCache.set(syn, re);
  }
  return re.test(text);
}

export function matchIntent(text) {
  const t = text.toLowerCase();
  let best = null;
  for (const tpl of TEMPLATES) {
    // Veto stays a loose substring check on purpose: over-vetoing is the safe direction.
    if (tpl.veto && tpl.veto.some((v) => t.includes(v))) continue;
    const hit = tpl.groups.every((g) => g.some((syn) => hasWord(t, syn)));
    if (!hit) continue;
    const score = tpl.groups.length + tpl.groups.flat().filter((syn) => hasWord(t, syn)).length * 0.1;
    if (!best || score > best.score) best = { tpl, score };
  }
  return best ? best.tpl : null;
}
