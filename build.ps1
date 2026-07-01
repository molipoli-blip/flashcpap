[CmdletBinding()]
param(
  [ValidateSet('firefox', 'chromium', 'edge', 'all')]
  [string]$Target = 'all'
)

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ManifestPath = Join-Path $Root 'manifest.json'
$DistDir = Join-Path $Root 'dist'
$Targets = if ($Target -eq 'all') { @('firefox', 'chromium', 'edge') } else { @($Target) }
$Encoding = New-Object System.Text.UTF8Encoding($false)

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-SourceVersion {
  return (Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json).version
}

function New-ManifestForTarget {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Browser
  )

  $manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json

  switch ($Browser) {
    'firefox' {
      $manifest.background = [pscustomobject]@{
        scripts = @('background.js')
      }

      $manifest.browser_specific_settings = [pscustomobject]@{
        gecko = [pscustomobject]@{
          id = 'flashcpap@molipoli-blip'
          data_collection_permissions = [pscustomobject]@{
            required = @('none')
            optional = @()
          }
        }
      }
    }

    'chromium' {
      $manifest.background = [pscustomobject]@{
        service_worker = 'background.js'
      }
      $manifest.PSObject.Properties.Remove('browser_specific_settings') | Out-Null
    }

    'edge' {
      $manifest.background = [pscustomobject]@{
        service_worker = 'background.js'
      }
      $manifest.PSObject.Properties.Remove('browser_specific_settings') | Out-Null
    }
  }

  return $manifest
}

function Copy-SourceTree {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Destination
  )

  $itemsToCopy = @(
    'background.js',
    'manifest.json',
    'popup.html',
    '_locales',
    'icons',
    'lib',
    'src',
    'styles',
    'notes'
  )

  foreach ($item in $itemsToCopy) {
    $sourcePath = Join-Path $Root $item
    if (Test-Path -LiteralPath $sourcePath) {
      Copy-Item -LiteralPath $sourcePath -Destination $Destination -Recurse -Force
    }
  }
}

New-Item -ItemType Directory -Path $DistDir -Force | Out-Null
$Version = Get-SourceVersion

foreach ($browser in $Targets) {
  $stageDir = Join-Path $DistDir "__stage-$browser"
  $packageDir = Join-Path $DistDir $browser
  $zipPath = Join-Path $DistDir ("{0}-{1}.zip" -f $browser, $Version)

  Remove-Item -LiteralPath $stageDir -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $packageDir -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue

  New-Item -ItemType Directory -Path $stageDir -Force | Out-Null
  Copy-SourceTree -Destination $stageDir

  $manifest = New-ManifestForTarget -Browser $browser
  $manifestJson = $manifest | ConvertTo-Json -Depth 32
  [System.IO.File]::WriteAllText((Join-Path $stageDir 'manifest.json'), $manifestJson, $Encoding)

  New-Item -ItemType Directory -Path $packageDir -Force | Out-Null
  Copy-Item -Path (Join-Path $stageDir '*') -Destination $packageDir -Recurse -Force

  if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
  }

  [System.IO.Compression.ZipFile]::CreateFromDirectory(
    $packageDir,
    $zipPath,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false
  )

  Remove-Item -LiteralPath $stageDir -Recurse -Force
  Remove-Item -LiteralPath $packageDir -Recurse -Force
  Write-Host "Created $zipPath"
}