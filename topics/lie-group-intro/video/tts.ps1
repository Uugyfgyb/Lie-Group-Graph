# Synthesize each SSML item in a UTF-8 JSON list to a WAV file with a Windows OneCore voice (offline).
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File tts.ps1 -List lines.json -Voice "Microsoft Huihui"
# Kept ASCII-only: Windows PowerShell 5.1 reads BOM-less scripts as ANSI. All Chinese text comes from the JSON file.
param([Parameter(Mandatory = $true)][string]$List, [string]$Voice = "Microsoft Huihui")
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[void][Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
[void][Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
function Await($op, [Type]$type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); [void]$t.Wait(-1); $t.Result }

$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$v = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.DisplayName -eq $Voice } | Select-Object -First 1
if (-not $v) { throw "voice not found: $Voice" }
$synth.Voice = $v
$items = [IO.File]::ReadAllText((Resolve-Path $List), [Text.Encoding]::UTF8) | ConvertFrom-Json
foreach ($it in $items) {
  $stream = Await ($synth.SynthesizeSsmlToStreamAsync($it.ssml)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
  $size = [uint32]$stream.Size
  $reader = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
  [void](Await ($reader.LoadAsync($size)) ([uint32]))
  $bytes = New-Object byte[] $size
  $reader.ReadBytes($bytes)
  [IO.File]::WriteAllBytes($it.file, $bytes)
  $reader.Dispose(); $stream.Dispose()
  Write-Output ("ok " + [IO.Path]::GetFileName($it.file) + " " + $size)
}
