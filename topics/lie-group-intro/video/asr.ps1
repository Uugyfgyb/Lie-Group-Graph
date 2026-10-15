# Transcribe each WAV in a JSON list with the offline Windows desktop recognizer (zh-CN dictation).
# Used only to check that every cut segment of a voice recording matches its script line.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File asr.ps1 -List list.json -Out asr.json
# ASCII-only on purpose (Windows PowerShell 5.1 reads BOM-less scripts as ANSI); output JSON is written as UTF-8.
param([Parameter(Mandatory = $true)][string]$List, [Parameter(Mandatory = $true)][string]$Out)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Speech
$info = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers() | Where-Object { $_.Culture.Name -eq "zh-CN" } | Select-Object -First 1
if (-not $info) { throw "no zh-CN recognizer" }
$files = [IO.File]::ReadAllText((Resolve-Path $List), [Text.Encoding]::UTF8) | ConvertFrom-Json
$results = @()
foreach ($f in $files) {
  $eng = New-Object System.Speech.Recognition.SpeechRecognitionEngine($info)
  $eng.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
  $eng.InitialSilenceTimeout = [TimeSpan]::FromSeconds(5)
  $eng.BabbleTimeout = [TimeSpan]::FromSeconds(0)
  $eng.EndSilenceTimeout = [TimeSpan]::FromSeconds(0.6)
  $eng.SetInputToWaveFile($f)
  $text = ""
  while ($true) {
    try { $r = $eng.Recognize() } catch { break }
    if ($null -eq $r) { break }
    $text += $r.Text
  }
  $eng.Dispose()
  $results += [pscustomobject]@{ file = [IO.Path]::GetFileName($f); text = $text }
}
[IO.File]::WriteAllText($Out, ($results | ConvertTo-Json -Depth 3), (New-Object Text.UTF8Encoding($false)))
Write-Output ("transcribed " + $results.Count)
