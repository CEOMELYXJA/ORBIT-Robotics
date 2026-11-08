param(
    [Parameter(Mandatory = $true)]
    [string]$ExecutablePath
)

$target = [IO.Path]::GetFullPath($ExecutablePath)
$running = @(Get-Process -Name 'Winmap.DesktopHost' -ErrorAction SilentlyContinue | Where-Object {
    try {
        -not [string]::IsNullOrWhiteSpace($_.Path) -and
            [IO.Path]::GetFullPath($_.Path).Equals($target, [StringComparison]::OrdinalIgnoreCase)
    }
    catch {
        $false
    }
})

if ($running.Count -gt 0) {
    foreach ($process in $running) {
        [Console]::Error.WriteLine(('Winmap.DesktopHost PID {0} is using the publish target (MainWindowHandle={1}).' -f $process.Id, $process.MainWindowHandle))
    }
    [Console]::Error.WriteLine('Close only that Winmap instance before rebuilding. If no window is visible, use Task Manager > Details and match the PID above.')
    exit 23
}

exit 0

