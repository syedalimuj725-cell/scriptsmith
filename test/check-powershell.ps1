# Parses every generated .ps1 with the real PowerShell parser, then runs
# PSScriptAnalyzer for Error-level issues. Exits 1 if anything fails.
$ErrorActionPreference = 'Stop'
$files = Get-ChildItem -Path "$PSScriptRoot/../generated" -Filter *.ps1
$failed = 0

foreach ($f in $files) {
    $tokens = $null; $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($f.FullName, [ref]$tokens, [ref]$errors) | Out-Null
    if ($errors.Count -gt 0) {
        $failed++
        Write-Host "PARSE FAIL: $($f.Name)" -ForegroundColor Red
        $errors | ForEach-Object { Write-Host "   line $($_.Extent.StartLineNumber): $($_.Message)" }
    }
}
Write-Host "Parser: $($files.Count - $failed)/$($files.Count) scripts OK"

if (Get-Command Invoke-ScriptAnalyzer -ErrorAction SilentlyContinue) {
    $issues = Invoke-ScriptAnalyzer -Path "$PSScriptRoot/../generated" -Severity Error
    if ($issues) {
        $failed += @($issues).Count
        $issues | Format-Table ScriptName, Line, RuleName, Message -AutoSize | Out-String | Write-Host
    }
    Write-Host "PSScriptAnalyzer: $(@($issues).Count) error-level issues"
}

if ($failed -gt 0) { exit 1 }
