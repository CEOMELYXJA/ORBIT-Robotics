$ErrorActionPreference = 'Stop'

$toolRoot = Join-Path $PSScriptRoot '.tooling'
$installRoot = Join-Path $toolRoot 'dotnet'
$installer = Join-Path $toolRoot 'dotnet-install.ps1'
$sdkArchive = Join-Path $toolRoot 'dotnet-sdk-win-x64.zip'
$sdkFetcher = Join-Path $PSScriptRoot 'Fetch-Local-DotnetSdk.mjs'

New-Item -ItemType Directory -Path $toolRoot -Force | Out-Null

if (Test-Path -LiteralPath (Join-Path $installRoot 'dotnet.exe')) {
    Write-Output "Project-local .NET SDK already exists at $installRoot. No global PATH or registry settings were changed."
    exit 0
}

$installed = $false
$node = Get-Command node.exe -ErrorAction SilentlyContinue
if ($node) {
    $nodeVersion = & $node.Source --version
    if ($nodeVersion -match '^v(?<Major>\d+)\.' -and [int]$Matches.Major -ge 18) {
        try {
            & $node.Source $sdkFetcher $sdkArchive
            if ($LASTEXITCODE -ne 0) { throw 'The Node SDK downloader failed.' }
            New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
            Expand-Archive -LiteralPath $sdkArchive -DestinationPath $installRoot -Force
            $installed = Test-Path -LiteralPath (Join-Path $installRoot 'dotnet.exe')
            if (-not $installed) { throw 'The verified SDK archive did not produce dotnet.exe.' }
        }
        catch {
            Write-Warning "Node-based SDK installation failed; trying the official dotnet-install script next. $($_.Exception.Message)"
        }
        finally {
            Remove-Item -LiteralPath $sdkArchive -Force -ErrorAction SilentlyContinue
        }
    }
}

if (-not $installed) {
    if ($PSVersionTable.PSVersion.Major -lt 6) {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    }

    try {
        try {
            Invoke-WebRequest -Uri 'https://dot.net/v1/dotnet-install.ps1' -OutFile $installer
        }
        catch {
            throw "Could not download the official .NET installer. Check Internet/TLS access and retry. $($_.Exception.Message)"
        }

        & $installer -Channel '10.0' -InstallDir $installRoot -NoPath
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath (Join-Path $installRoot 'dotnet.exe'))) {
            throw 'The local .NET SDK installation did not complete successfully.'
        }
    }
    finally {
        Remove-Item -LiteralPath $installer -Force -ErrorAction SilentlyContinue
    }
}

Write-Output "Project-local .NET SDK installed at $installRoot. No global PATH or registry settings were changed."

