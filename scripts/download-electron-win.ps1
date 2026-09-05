param(
  [Parameter(Mandatory)][ValidatePattern('^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$')][string]$Version,
  [Parameter(Mandatory)][ValidateSet('x64','arm64')][string]$Architecture,
  [Parameter(Mandatory)][string]$Destination
)
$ErrorActionPreference = 'Stop'
$downloadRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../build/electron'))
$downloadPath = [IO.Path]::GetFullPath($Destination)
if (-not $downloadPath.StartsWith($downloadRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Electron download must stay inside the project build/electron directory.'
}
New-Item -ItemType Directory -Path $downloadRoot -Force | Out-Null
$downloadUri = "https://github.com/electron/electron/releases/download/v$Version/electron-v$Version-win32-$Architecture.zip"
Invoke-WebRequest -Uri $downloadUri -OutFile $downloadPath -TimeoutSec 180 -MaximumRetryCount 2 -RetryIntervalSec 2
