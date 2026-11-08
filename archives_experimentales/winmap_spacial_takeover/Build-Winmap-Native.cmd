@echo off
setlocal
set "ROOT=%~dp0"
set "DOTNET_EXE=dotnet"
set "DOTNET_ROOT="
set "DOTNET_CLI_HOME=%ROOT%.tooling\dotnet-home"
set "DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1"
set "DOTNET_CLI_TELEMETRY_OPTOUT=1"
set "APPDATA=%ROOT%.tooling\appdata"
set "NUGET_PACKAGES=%TEMP%\wmap-nuget\packages"
set "NUGET_HTTP_CACHE_PATH=%TEMP%\wmap-nuget\http"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%Check-NativeProcess.ps1" -ExecutablePath "%ROOT%dist\win-x64-recovery\Winmap.DesktopHost.exe"
if errorlevel 1 (
  echo Close the Winmap native application before rebuilding its published files.
  exit /b 1
)
if not exist "%APPDATA%" mkdir "%APPDATA%"
if exist "%ROOT%.tooling\dotnet\dotnet.exe" (
  set "DOTNET_ROOT=%ROOT%.tooling\dotnet"
  set "DOTNET_EXE=%ROOT%.tooling\dotnet\dotnet.exe"
)
pushd "%ROOT%windows\Winmap.DesktopHost"
set "LOCAL_FEED_READY=0"
where node >nul 2>nul
if not errorlevel 1 (
  node "%ROOT%Fetch-Local-NuGetPackages.mjs" "%ROOT%.tooling\nuget-feed" "%DOTNET_EXE%"
  if not errorlevel 1 set "LOCAL_FEED_READY=1"
)
if "%LOCAL_FEED_READY%"=="1" (
  "%DOTNET_EXE%" restore Winmap.DesktopHost.csproj --configfile "%ROOT%NuGet.Config" --source "%ROOT%.tooling\nuget-feed" -r win-x64 -p:NuGetAudit=false
) else (
  echo Direct NuGet package preparation unavailable; retrying with the configured online NuGet source.
  "%DOTNET_EXE%" restore Winmap.DesktopHost.csproj --configfile "%ROOT%NuGet.Config" -r win-x64 -p:NuGetAudit=false
)
set "BUILD_EXIT=%ERRORLEVEL%"
if not "%BUILD_EXIT%"=="0" (
  popd
  echo Native package restore failed. See the output above.
  exit /b %BUILD_EXIT%
)
"%DOTNET_EXE%" publish Winmap.DesktopHost.csproj -c Release -r win-x64 --self-contained true --no-restore -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -o "%ROOT%dist\win-x64-recovery"
set "BUILD_EXIT=%ERRORLEVEL%"
popd
if not "%BUILD_EXIT%"=="0" (
  echo Native build failed. See the output above.
  exit /b %BUILD_EXIT%
)
echo Published: %ROOT%dist\win-x64-recovery\Winmap.DesktopHost.exe and its wwwroot content folder.

