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
    catch { $false }
})

if ($running.Count -gt 0) {
    [Console]::Error.WriteLine('This Winmap native build is already running:')
    foreach ($process in $running) {
        $path = ''
        try { $path = $process.Path } catch { }
        [Console]::Error.WriteLine(('  PID {0}  MainWindowHandle={1}  {2}' -f $process.Id, $process.MainWindowHandle, $path))
    }
    [Console]::Error.WriteLine('Close that Winmap instance, then try again. This guard will not stop any process; other Winmap builds are left alone.')
    exit 23
}

exit 0

