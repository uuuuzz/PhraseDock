param(
  [Parameter(Mandatory)][ValidatePattern('^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$')][string]$Version,
  [Parameter(Mandatory)][ValidateSet('x64','arm64')][string]$Architecture
)
$ErrorActionPreference = 'Stop'
$distRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../dist'))
$appDirectory = [IO.Path]::GetFullPath((Join-Path $distRoot "$Version/PhraseDock-win32-$Architecture"))
$archivePath = [IO.Path]::GetFullPath((Join-Path $distRoot "PhraseDock-$Version-win32-$Architecture.zip"))
foreach ($targetPath in @($appDirectory, $archivePath)) {
  if (-not $targetPath.StartsWith($distRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Package output must stay inside the project dist directory.'
  }
}
if (-not (Test-Path -LiteralPath (Join-Path $appDirectory 'PhraseDock.exe'))) { throw 'Build package:win first.' }
if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath }
[IO.Compression.ZipFile]::CreateFromDirectory($appDirectory, $archivePath, [IO.Compression.CompressionLevel]::Optimal, $true)
$archiveHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText("$archivePath.sha256", "$archiveHash  $([IO.Path]::GetFileName($archivePath))`n", [Text.UTF8Encoding]::new($false))
Write-Output $archivePath
Write-Output "SHA-256: $archiveHash"
