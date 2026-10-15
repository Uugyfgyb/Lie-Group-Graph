# Synthesize each SSML item in a UTF-8 JSON list to a WAV file with an offline Windows voice.
# OneCore voices (e.g. "Microsoft Huihui") go through WinRT; desktop SAPI voices (e.g. "Microsoft Zira Desktop") go through System.Speech.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File tts.ps1 -List lines.json -Voice "Microsoft Huihui" [-Rate -1]
# -Rate (-10..10) is used only for SAPI voices: System.Speech misreads SSML prosody percentages, so the SSML for them carries no prosody.
# Kept ASCII-only: Windows PowerShell 5.1 reads BOM-less scripts as ANSI. All spoken text comes from the JSON file.
param([Parameter(Mandatory = $true)][string]$List, [string]$Voice = "Microsoft Huihui", [int]$Rate = 0)
$ErrorActionPreference = "Stop"
$items = [IO.File]::ReadAllText((Resolve-Path $List), [Text.Encoding]::UTF8) | ConvertFrom-Json

Add-Type -AssemblyName System.Runtime.WindowsRuntime
[void][Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
$v = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.DisplayName -eq $Voice } | Select-Object -First 1

if ($v) {
  [void][Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]
  $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
  function Await($op, [Type]$type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); [void]$t.Wait(-1); $t.Result }
  $synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
  $synth.Voice = $v
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
} else {
  Add-Type -AssemblyName System.Speech
  $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $s.SelectVoice($Voice)  # throws if the voice is not installed
  $s.Rate = $Rate
  $fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(22050, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
  foreach ($it in $items) {
    $s.SetOutputToWaveFile($it.file, $fmt)
    $s.SpeakSsml($it.ssml)
    $s.SetOutputToNull()
    Write-Output ("ok " + [IO.Path]::GetFileName($it.file) + " " + (Get-Item $it.file).Length)
  }
  $s.Dispose()
}
