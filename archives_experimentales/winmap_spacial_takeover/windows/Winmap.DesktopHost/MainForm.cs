using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;

namespace Winmap.DesktopHost;

internal sealed class MainForm : Form
{
    private const string VirtualHost = "winmap-spacial.example";
    private const int MaxRegisteredApplications = 512;
    private const int GwlStyle = -16;
    private const long WsChild = 0x40000000L;
    private const long WsPopup = 0x80000000L;
    private const long WsCaption = 0x00C00000L;
    private const long WsThickFrame = 0x00040000L;
    private const long WsMinimizeBox = 0x00020000L;
    private const long WsMaximizeBox = 0x00010000L;
    private const long WsSystemMenu = 0x00080000L;
    private const long WsVisible = 0x10000000L;
    private const uint SwpFrameChanged = 0x0020;
    private const uint SwpShowWindow = 0x0040;
    private const int SwRestore = 9;
    private readonly WebView2 _webView = new() { Dock = DockStyle.Fill, AllowExternalDrop = true };
    private readonly System.Windows.Forms.Timer _desktopStartupWatchdog = new() { Interval = 30000 };
    private readonly Dictionary<IntPtr, uint> _knownWindows = new();
    private readonly Dictionary<string, string> _registeredApplicationPaths = new(StringComparer.Ordinal);
    private readonly bool _desktopSurfaceRequested;
    private bool _desktopDecisionMade;
    private bool _pageBridgeReady;
    private string _webViewUserDataDirectory = string.Empty;
    private bool _fatalProcessFailureHandled;
    private bool _rendererRecoveryAttempted;
    private string _registeredApplicationsPath = string.Empty;

    public MainForm(bool desktopSurfaceRequested)
    {
        _desktopSurfaceRequested = desktopSurfaceRequested;
        _desktopStartupWatchdog.Tick += (_, _) => ShowDesktopStartupFallback();
        Text = "winmap spacial takeover";
        MinimumSize = new Size(760, 540);
        AutoScaleMode = AutoScaleMode.Dpi;
        if (desktopSurfaceRequested)
        {
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            WindowState = FormWindowState.Normal;
            Bounds = Screen.PrimaryScreen?.WorkingArea ?? new Rectangle(0, 0, 1280, 720);
            Opacity = 0;
        }
        else
        {
            StartPosition = FormStartPosition.CenterScreen;
            WindowState = FormWindowState.Maximized;
        }
        Controls.Add(_webView);
    }

    protected override async void OnShown(EventArgs e)
    {
        base.OnShown(e);
        if (_desktopSurfaceRequested) _desktopStartupWatchdog.Start();

        try
        {
            var userDataOverride = Environment.GetEnvironmentVariable("WINMAP_WEBVIEW2_USER_DATA");
            var userData = string.IsNullOrWhiteSpace(userDataOverride)
                ? Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "Winmap Spacial Takeover",
                    "WebView2")
                : Path.GetFullPath(userDataOverride);
            _webViewUserDataDirectory = userData;
            LogStartupEvent("form-shown", _desktopSurfaceRequested ? "desktop-mode" : "windowed-mode");

            var contentRoot = Path.Combine(AppContext.BaseDirectory, "wwwroot");
            var indexPath = Path.Combine(contentRoot, "index.html");
            if (!File.Exists(indexPath))
                throw new FileNotFoundException("Les fichiers de Winmap sont absents du paquet.", indexPath);
            LogStartupEvent("content-root-ready", "wwwroot/index.html exists");

            Directory.CreateDirectory(userData);
            _registeredApplicationsPath = Path.Combine(userData, "registered-applications.json");
            LoadRegisteredApplications();
            LogStartupEvent("profile-ready", string.IsNullOrWhiteSpace(userDataOverride) ? "default-profile" : "custom-profile");

            var browserArguments = string.Equals(
                Environment.GetEnvironmentVariable("WINMAP_WEBVIEW2_SOFTWARE_RENDERING"),
                "1",
                StringComparison.Ordinal);
            var environmentOptions = new CoreWebView2EnvironmentOptions
            {
                AdditionalBrowserArguments = browserArguments ? "--disable-gpu" : string.Empty
            };
            LogStartupEvent("webview-rendering-mode", browserArguments ? "software-fallback" : "hardware-default");
            LogStartupEvent("webview-environment-started", "CreateAsync");
            var environment = await CoreWebView2Environment.CreateAsync(
                browserExecutableFolder: null,
                userDataFolder: userData,
                options: environmentOptions);
            LogStartupEvent("webview-environment-ready", "CreateAsync completed");
            await _webView.EnsureCoreWebView2Async(environment);
            LogStartupEvent("webview-control-ready", "EnsureCoreWebView2Async completed");

            var core = _webView.CoreWebView2;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.IsZoomControlEnabled = false;
            core.Settings.IsWebMessageEnabled = true;
            core.SetVirtualHostNameToFolderMapping(
                VirtualHost,
                contentRoot,
                CoreWebView2HostResourceAccessKind.DenyCors);

            core.NavigationStarting += (_, args) =>
            {
                LogStartupEvent("navigation-starting", args.Uri);
                if (!Uri.TryCreate(args.Uri, UriKind.Absolute, out var target) ||
                    target.Scheme != Uri.UriSchemeHttps ||
                    !target.Host.Equals(VirtualHost, StringComparison.OrdinalIgnoreCase))
                {
                    args.Cancel = true;
                }
            };
            core.NewWindowRequested += (_, args) => args.Handled = true;
            core.WebMessageReceived += (_, args) =>
            {
                if (!Uri.TryCreate(args.Source, UriKind.Absolute, out var source) ||
                    source.Scheme != Uri.UriSchemeHttps ||
                    !source.Host.Equals(VirtualHost, StringComparison.OrdinalIgnoreCase)) return;
                HandleWebMessage(core, args);
            };
            core.NavigationCompleted += (_, args) =>
            {
                LogStartupEvent(args.IsSuccess ? "navigation-completed" : "navigation-failed", core.Source);
                if (!args.IsSuccess)
                {
                    _desktopStartupWatchdog.Stop();
                    ResolveDesktopSurface(false);
                }
                else if (_desktopSurfaceRequested && !_pageBridgeReady)
                {
                    LogStartupEvent("awaiting-page-bridge", "Waiting for the spatial interface and native bridge to initialize.");
                }
                else
                {
                    _desktopStartupWatchdog.Stop();
                }
            };
            core.ProcessFailed += (_, args) => HandleProcessFailure(core, args);

            LogStartupEvent("navigation-requested", "Local Winmap origin");
            core.Navigate($"https://{VirtualHost}/index.html");
        }
        catch (Exception error)
        {
            _desktopStartupWatchdog.Stop();
            LogStartupEvent("startup-exception", $"{error.GetType().Name} 0x{error.HResult:X8}");
            Opacity = 1;
            var fallbackStarted = TryLaunchBrowserFallback();
            if (!fallbackStarted) ShowStartupError(DescribeStartupError(error));
            Close();
        }
    }

    private bool TryLaunchBrowserFallback()
    {
        try
        {
            var indexPath = Path.Combine(AppContext.BaseDirectory, "wwwroot", "index.html");
            if (!File.Exists(indexPath)) return false;

            var edgePath = FindEdgeExecutable();
            if (edgePath is not null)
            {
                var edgeProfile = Path.Combine(_webViewUserDataDirectory, "edge-fallback-profile");
                Directory.CreateDirectory(edgeProfile);
                var edgeStart = new ProcessStartInfo
                {
                    FileName = edgePath,
                    UseShellExecute = false,
                    WindowStyle = ProcessWindowStyle.Maximized
                };
                edgeStart.ArgumentList.Add("--new-window");
                edgeStart.ArgumentList.Add("--start-maximized");
                edgeStart.ArgumentList.Add("--no-first-run");
                edgeStart.ArgumentList.Add($"--user-data-dir={edgeProfile}");
                edgeStart.ArgumentList.Add(new Uri(indexPath).AbsoluteUri);
                using var edgeProcess = Process.Start(edgeStart);
                if (edgeProcess is not null && TryBringProcessWindowToFront(edgeProcess.Id, 10000))
                {
                    LogStartupEvent("browser-fallback-started", "Opened the packaged Winmap page in a dedicated, maximized Microsoft Edge window.");
                    return true;
                }
                LogStartupEvent("edge-window-missing", "Edge did not expose a visible window for the dedicated profile within 10 seconds; trying the default browser.");
            }

            Process.Start(new ProcessStartInfo(indexPath) { UseShellExecute = true });
            LogStartupEvent("browser-fallback-started", "Opened the packaged Winmap page with the Windows default browser after native startup failed.");
            return true;
        }
        catch (Exception fallbackError)
        {
            LogStartupEvent("browser-fallback-failed", $"{fallbackError.GetType().Name} 0x{fallbackError.HResult:X8}");
            return false;
        }
    }

    private static string? FindEdgeExecutable()
    {
        var candidates = new[]
        {
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData)
        };

        foreach (var root in candidates)
        {
            if (string.IsNullOrWhiteSpace(root)) continue;
            var candidate = Path.Combine(root, "Microsoft", "Edge", "Application", "msedge.exe");
            if (File.Exists(candidate)) return candidate;
        }

        return null;
    }

    private static bool TryBringProcessWindowToFront(int processId, int timeoutMilliseconds)
    {
        var stopwatch = Stopwatch.StartNew();
        while (stopwatch.ElapsedMilliseconds < timeoutMilliseconds)
        {
            var visibleWindow = IntPtr.Zero;
            EnumWindows((window, _) =>
            {
                if (!IsWindowVisible(window)) return true;
                GetWindowThreadProcessId(window, out var ownerProcessId);
                if (ownerProcessId != (uint)processId) return true;
                visibleWindow = window;
                return false;
            }, IntPtr.Zero);

            if (visibleWindow != IntPtr.Zero)
            {
                ShowWindow(visibleWindow, SwRestore);
                SetForegroundWindow(visibleWindow);
                return true;
            }

            Thread.Sleep(200);
        }

        return false;
    }

    private void ShowDesktopStartupFallback()
    {
        _desktopStartupWatchdog.Stop();
        if (!_desktopSurfaceRequested || _desktopDecisionMade || IsDisposed || Disposing) return;

        _desktopDecisionMade = true;
        LogStartupEvent("startup-timeout", "No ready message from the spatial interface within 30 seconds.");
        RestoreWindowedPresentation();
        Opacity = 1;
        ShowStartupError("Winmap n’a pas terminé son démarrage en 30 secondes. L’application est affichée dans une fenêtre normale; le bureau Windows reste intact.");
    }

    private static string DescribeStartupError(Exception error)
    {
        if (error.GetType().Name.Contains("WebView2RuntimeNotFound", StringComparison.OrdinalIgnoreCase))
        {
            return "Le runtime Microsoft Edge WebView2 est absent. Installe le runtime Evergreen de Microsoft, puis relance Winmap.";
        }

        return $"Winmap n’a pas pu démarrer : {error.Message}";
    }

    private void HandleProcessFailure(CoreWebView2 core, CoreWebView2ProcessFailedEventArgs args)
    {
        LogProcessFailure(args);

        if (args.ProcessFailedKind is CoreWebView2ProcessFailedKind.GpuProcessExited
            or CoreWebView2ProcessFailedKind.UtilityProcessExited
            or CoreWebView2ProcessFailedKind.SandboxHelperProcessExited
            or CoreWebView2ProcessFailedKind.FrameRenderProcessExited
            or CoreWebView2ProcessFailedKind.RenderProcessUnresponsive)
        {
            return;
        }

        if (args.ProcessFailedKind == CoreWebView2ProcessFailedKind.RenderProcessExited && !_rendererRecoveryAttempted)
        {
            _rendererRecoveryAttempted = true;
            try
            {
                core.Reload();
                return;
            }
            catch (COMException) { }
            catch (InvalidOperationException) { }
        }

        if (args.ProcessFailedKind == CoreWebView2ProcessFailedKind.RenderProcessExited && _rendererRecoveryAttempted)
        {
            if (_fatalProcessFailureHandled) return;
            _fatalProcessFailureHandled = true;
            BeginInvoke(new Action(() =>
            {
                if (IsDisposed || Disposing) return;
                if (TryLaunchBrowserFallback())
                {
                    Close();
                    return;
                }
                ShowStartupError("WebView2 n’a pas pu démarrer le moteur de rendu et le navigateur par défaut n’a pas pu ouvrir Winmap. Consulte le journal webview-process-failures.log.");
                Close();
            }));
            return;
        }

        if (_fatalProcessFailureHandled) return;
        _fatalProcessFailureHandled = true;
        try
        {
            BeginInvoke(new Action(() =>
            {
                if (IsDisposed || Disposing) return;

                Opacity = 1;
                var details = $"{args.ProcessFailedKind} — {args.Reason} (code {args.ExitCode})";
                MessageBox.Show(
                    this,
                    $"Le moteur WebView2 a subi une erreur. Ferme puis relance Winmap.\n\nDétail technique : {details}",
                    Text,
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
                Close();
            }));
        }
        catch (InvalidOperationException) { }
    }

    private void LogProcessFailure(CoreWebView2ProcessFailedEventArgs args)
    {
        if (string.IsNullOrWhiteSpace(_webViewUserDataDirectory)) return;

        try
        {
            var logPath = Path.Combine(_webViewUserDataDirectory, "webview-process-failures.log");
            if (File.Exists(logPath) && new FileInfo(logPath).Length > 32 * 1024)
                File.WriteAllText(logPath, string.Empty);

            var line = $"{DateTimeOffset.Now:O}\t{args.ProcessFailedKind}\t{args.Reason}\t{args.ExitCode}\t{args.ProcessDescription}\t{args.FailureSourceModulePath}{Environment.NewLine}";
            File.AppendAllText(logPath, line, Encoding.UTF8);
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }

    private void LogStartupEvent(string eventName, string detail)
    {
        var safeDetail = detail.Replace('\t', ' ').Replace('\r', ' ').Replace('\n', ' ');
        var line = $"{DateTimeOffset.Now:O}\t{eventName}\t{safeDetail}{Environment.NewLine}";
        try
        {
            if (!string.IsNullOrWhiteSpace(_webViewUserDataDirectory))
            {
                AppendStartupLog(_webViewUserDataDirectory, line);
                return;
            }
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }

        try { AppendStartupLog(Path.Combine(Path.GetTempPath(), "Winmap Spacial Takeover"), line); }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }

    private static void AppendStartupLog(string root, string line)
    {
        var logPath = Path.Combine(root, "webview-startup.log");
        Directory.CreateDirectory(root);
        if (File.Exists(logPath) && new FileInfo(logPath).Length > 32 * 1024)
            File.WriteAllText(logPath, string.Empty);
        File.AppendAllText(logPath, line, Encoding.UTF8);
    }

    private void ShowStartupError(string message)
    {
        MessageBox.Show(this, message, "winmap spacial takeover", MessageBoxButtons.OK, MessageBoxIcon.Information);
    }

    private void HandleWebMessage(CoreWebView2 core, CoreWebView2WebMessageReceivedEventArgs args)
    {
        try
        {
            using var message = JsonDocument.Parse(args.WebMessageAsJson);
            var payload = message.RootElement;
            if (payload.ValueKind == JsonValueKind.String)
            {
                if (payload.GetString() == "close") Close();
                return;
            }
            if (payload.ValueKind != JsonValueKind.Object || !payload.TryGetProperty("type", out var typeValue) || typeValue.ValueKind != JsonValueKind.String) return;
            var type = typeValue.GetString();
            if (type == "list-registered-apps")
            {
                if (!_pageBridgeReady)
                {
                    _pageBridgeReady = true;
                    _desktopStartupWatchdog.Stop();
                    LogStartupEvent("page-bridge-ready", "The spatial interface initialized and contacted its local host.");
                    ResolveDesktopSurface(true);
                }
                PostRegisteredApplications(core);
                return;
            }
            if (type is "choose-app" or "launch-app")
            {
                if (!payload.TryGetProperty("nodeId", out var appIdValue) || appIdValue.ValueKind != JsonValueKind.String) return;
                var appId = appIdValue.GetString();
                if (type == "choose-app") ChooseApplication(core, appId);
                else LaunchRegisteredApplication(core, appId);
                return;
            }
            if (type == "list-windows")
            {
                if (!payload.TryGetProperty("requestId", out var requestValue) || requestValue.ValueKind != JsonValueKind.String) return;
                var windows = ReadVisibleApplicationWindows(out var handles);
                _knownWindows.Clear();
                foreach (var entry in handles) _knownWindows.Add(entry.Key, entry.Value);
                core.PostWebMessageAsJson(JsonSerializer.Serialize(new { type = "windows", requestId = requestValue.GetString(), windows }, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
                return;
            }
            if (type == "focus-window" && payload.TryGetProperty("windowHandle", out var handleValue) &&
                handleValue.ValueKind == JsonValueKind.String && long.TryParse(handleValue.GetString(), out var handleNumber))
            {
                var handle = new IntPtr(handleNumber);
                var success = _knownWindows.TryGetValue(handle, out var expectedProcessId) && IsWindow(handle);
                if (success)
                {
                    GetWindowThreadProcessId(handle, out var currentProcessId);
                    success = currentProcessId == expectedProcessId;
                    if (success)
                    {
                        ShowWindow(handle, SwRestore);
                        success = SetForegroundWindow(handle);
                    }
                }
                core.PostWebMessageAsJson(JsonSerializer.Serialize(new { type = "focus-result", success }, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
            }
        }
        catch (JsonException) { }
        catch (COMException) { }
    }

    private void LoadRegisteredApplications()
    {
        if (!File.Exists(_registeredApplicationsPath)) return;
        try
        {
            var saved = JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(_registeredApplicationsPath));
            if (saved is null) return;
            foreach (var entry in saved.Take(MaxRegisteredApplications))
            {
                if (!IsSafeAppNodeId(entry.Key)) continue;
                var path = ValidateExecutablePath(entry.Value);
                if (path is not null) _registeredApplicationPaths[entry.Key] = path;
            }
        }
        catch (JsonException) { }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }

    private void SaveRegisteredApplications()
    {
        var temporary = _registeredApplicationsPath + ".tmp";
        try
        {
            File.WriteAllText(temporary, JsonSerializer.Serialize(_registeredApplicationPaths), Encoding.UTF8);
            File.Move(temporary, _registeredApplicationsPath, true);
        }
        finally
        {
            if (File.Exists(temporary)) File.Delete(temporary);
        }
    }

    private void PostRegisteredApplications(CoreWebView2 core)
    {
        var apps = _registeredApplicationPaths
            .Where(entry => ValidateExecutablePath(entry.Value) is not null)
            .Select(entry => new { nodeId = entry.Key, name = Path.GetFileNameWithoutExtension(entry.Value) })
            .ToArray();
        core.PostWebMessageAsJson(JsonSerializer.Serialize(new { type = "registered-apps", apps }, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
    }

    private void ChooseApplication(CoreWebView2 core, string? nodeId)
    {
        if (!IsSafeAppNodeId(nodeId)) return;
        if (!_registeredApplicationPaths.ContainsKey(nodeId!) && _registeredApplicationPaths.Count >= MaxRegisteredApplications)
        {
            PostAppChoiceResult(core, nodeId!, false, false, string.Empty);
            return;
        }

        try
        {
            using var dialog = new OpenFileDialog
            {
                Title = "Choisir l’application Windows à lier à cet atome",
                Filter = "Applications Windows (*.exe)|*.exe",
                CheckFileExists = true,
                CheckPathExists = true,
                Multiselect = false,
                ValidateNames = true
            };
            if (dialog.ShowDialog(this) != DialogResult.OK)
            {
                PostAppChoiceResult(core, nodeId!, false, true, string.Empty);
                return;
            }

            var executable = ValidateExecutablePath(dialog.FileName);
            if (executable is null)
            {
                PostAppChoiceResult(core, nodeId!, false, false, string.Empty);
                return;
            }

            _registeredApplicationPaths[nodeId!] = executable;
            SaveRegisteredApplications();
            PostAppChoiceResult(core, nodeId!, true, false, Path.GetFileNameWithoutExtension(executable));
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or InvalidOperationException)
        {
            PostAppChoiceResult(core, nodeId!, false, false, string.Empty);
        }
    }

    private void LaunchRegisteredApplication(CoreWebView2 core, string? nodeId)
    {
        if (!IsSafeAppNodeId(nodeId) || !_registeredApplicationPaths.TryGetValue(nodeId!, out var storedPath)) return;
        var executable = ValidateExecutablePath(storedPath);
        if (executable is null)
        {
            _registeredApplicationPaths.Remove(nodeId!);
            try { SaveRegisteredApplications(); }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
            PostAppLaunchResult(core, nodeId!, false, false, string.Empty);
            return;
        }

        try
        {
            var startInfo = new ProcessStartInfo
            {
                FileName = executable,
                WorkingDirectory = Path.GetDirectoryName(executable) ?? AppContext.BaseDirectory,
                UseShellExecute = true
            };
            using var process = Process.Start(startInfo);
            PostAppLaunchResult(core, nodeId!, process is not null, false, Path.GetFileNameWithoutExtension(executable));
        }
        catch (Exception error) when (error is System.ComponentModel.Win32Exception or InvalidOperationException or IOException or UnauthorizedAccessException or NotSupportedException)
        {
            PostAppLaunchResult(core, nodeId!, false, false, string.Empty);
        }
    }

    private static string? ValidateExecutablePath(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        try
        {
            var fullPath = Path.GetFullPath(value);
            return Path.GetExtension(fullPath).Equals(".exe", StringComparison.OrdinalIgnoreCase) && File.Exists(fullPath) && !Directory.Exists(fullPath)
                ? fullPath
                : null;
        }
        catch (Exception error) when (error is ArgumentException or NotSupportedException or PathTooLongException)
        {
            return null;
        }
    }

    private static bool IsSafeAppNodeId(string? value) =>
        !string.IsNullOrEmpty(value) && value.Length <= 96 && value.All(character =>
            character is >= 'a' and <= 'z' or >= '0' and <= '9' or '-');

    private static void PostAppChoiceResult(CoreWebView2 core, string nodeId, bool success, bool cancelled, string name) =>
        core.PostWebMessageAsJson(JsonSerializer.Serialize(new { type = "app-choice-result", nodeId, success, cancelled, name }, new JsonSerializerOptions(JsonSerializerDefaults.Web)));

    private static void PostAppLaunchResult(CoreWebView2 core, string nodeId, bool success, bool cancelled, string name) =>
        core.PostWebMessageAsJson(JsonSerializer.Serialize(new { type = "app-launch-result", nodeId, success, cancelled, name }, new JsonSerializerOptions(JsonSerializerDefaults.Web)));

    private List<NativeWindowInfo> ReadVisibleApplicationWindows(out Dictionary<IntPtr, uint> handles)
    {
        var windows = new List<NativeWindowInfo>();
        var windowHandles = new Dictionary<IntPtr, uint>();
        handles = windowHandles;
        var ownProcessId = Environment.ProcessId;
        EnumWindows((window, _) =>
        {
            if (!IsWindowVisible(window)) return true;
            var classBuffer = new StringBuilder(128);
            if (GetClassName(window, classBuffer, classBuffer.Capacity) > 0 &&
                (classBuffer.ToString() is "Progman" or "WorkerW" or "Shell_TrayWnd" or "Shell_SecondaryTrayWnd")) return true;
            var titleLength = GetWindowTextLength(window);
            if (titleLength <= 0) return true;
            var titleBuffer = new StringBuilder(Math.Min(titleLength + 1, 4096));
            if (GetWindowText(window, titleBuffer, titleBuffer.Capacity) <= 0) return true;
            GetWindowThreadProcessId(window, out var processId);
            if (processId == 0 || processId == ownProcessId) return true;

            string application;
            try
            {
                using var process = Process.GetProcessById((int)processId);
                application = process.ProcessName;
            }
            catch (ArgumentException) { return true; }
            catch (InvalidOperationException) { return true; }
            catch (System.ComponentModel.Win32Exception) { return true; }
            if (string.IsNullOrWhiteSpace(application)) return true;

            var title = new string(titleBuffer.ToString().Where(character => !char.IsControl(character)).Take(96).ToArray()).Trim();
            if (string.IsNullOrWhiteSpace(title)) return true;
            windows.Add(new NativeWindowInfo(window.ToInt64().ToString(), (int)processId, application, title));
            windowHandles[window] = processId;
            return windows.Count < 32;
        }, IntPtr.Zero);
        return windows;
    }

    private sealed record NativeWindowInfo(string WindowHandle, int ProcessId, string Application, string Title);

    private void ResolveDesktopSurface(bool navigationSucceeded)
    {
        _desktopStartupWatchdog.Stop();
        if (!_desktopSurfaceRequested || _desktopDecisionMade) return;
        _desktopDecisionMade = true;
        LogStartupEvent("desktop-attach-started", navigationSucceeded ? "Page bridge is ready." : "Navigation did not succeed.");
        if (navigationSucceeded && TryAttachToDesktopView())
        {
            LogStartupEvent("desktop-attached", "Winmap is a visible child of the Explorer desktop view.");
            Opacity = 1;
            return;
        }

        LogStartupEvent("windowed-fallback", navigationSucceeded ? "Explorer desktop attachment was unavailable." : "WebView2 navigation failed.");
        RestoreWindowedPresentation();
        Opacity = 1;
        MessageBox.Show(
            this,
            navigationSucceeded
                ? "Windows n’a pas exposé sa vue de bureau pour l’attachement. Winmap s’ouvre dans une fenêtre native; le bureau et ses icônes restent intacts."
                : "La scène n’a pas terminé son chargement. Winmap reste dans une fenêtre native pour ne pas masquer le bureau.",
            Text,
            MessageBoxButtons.OK,
            MessageBoxIcon.Information);
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) _desktopStartupWatchdog.Dispose();
        base.Dispose(disposing);
    }

    private bool TryAttachToDesktopView()
    {
        var desktopView = FindDesktopView();
        if (desktopView == IntPtr.Zero)
        {
            LogStartupEvent("desktop-view-not-found", "SHELLDLL_DefView was unavailable.");
            return false;
        }
        if (!GetWindowRect(desktopView, out var bounds))
        {
            LogStartupEvent("desktop-view-bounds-failed", $"Win32 0x{Marshal.GetLastPInvokeError():X8}");
            return false;
        }

        var oldStyle = GetWindowLongPtr(Handle, GwlStyle).ToInt64();
        var borderMask = WsPopup | WsCaption | WsThickFrame | WsMinimizeBox | WsMaximizeBox | WsSystemMenu;
        var childStyle = (oldStyle & ~borderMask) | WsChild | WsVisible;

        Marshal.SetLastPInvokeError(0);
        var previousStyle = SetWindowLongPtr(Handle, GwlStyle, new IntPtr(childStyle));
        if (previousStyle == IntPtr.Zero && Marshal.GetLastPInvokeError() != 0)
        {
            LogStartupEvent("desktop-style-failed", $"Win32 0x{Marshal.GetLastPInvokeError():X8}");
            return false;
        }

        Marshal.SetLastPInvokeError(0);
        var previousParent = SetParent(Handle, desktopView);
        if (previousParent == IntPtr.Zero && Marshal.GetLastPInvokeError() != 0)
        {
            var error = Marshal.GetLastPInvokeError();
            SetWindowLongPtr(Handle, GwlStyle, new IntPtr(oldStyle));
            LogStartupEvent("desktop-parent-failed", $"Win32 0x{error:X8}");
            return false;
        }

        if (SetWindowPos(Handle, IntPtr.Zero, 0, 0, bounds.Right - bounds.Left, bounds.Bottom - bounds.Top, SwpFrameChanged | SwpShowWindow))
            return true;

        var positionError = Marshal.GetLastPInvokeError();
        LogStartupEvent("desktop-position-failed", $"Win32 0x{positionError:X8}");
        SetParent(Handle, previousParent);
        SetWindowLongPtr(Handle, GwlStyle, new IntPtr(oldStyle));
        return false;
    }

    private void RestoreWindowedPresentation()
    {
        FormBorderStyle = FormBorderStyle.Sizable;
        ShowInTaskbar = true;
        StartPosition = FormStartPosition.CenterScreen;
        WindowState = FormWindowState.Maximized;
    }

    private static IntPtr FindDesktopView()
    {
        var first = IntPtr.Zero;
        var primary = IntPtr.Zero;
        var screen = Screen.PrimaryScreen?.Bounds;
        var center = screen.HasValue ? new Point(screen.Value.Left + screen.Value.Width / 2, screen.Value.Top + screen.Value.Height / 2) : Point.Empty;
        EnumWindows((topLevel, _) =>
        {
            var view = FindWindowEx(topLevel, IntPtr.Zero, "SHELLDLL_DefView", null);
            if (view == IntPtr.Zero) return true;
            if (first == IntPtr.Zero) first = view;
            if (!screen.HasValue || !GetWindowRect(view, out var bounds)) return true;
            if (center.X < bounds.Left || center.X >= bounds.Right || center.Y < bounds.Top || center.Y >= bounds.Bottom) return true;
            primary = view;
            return false;
        }, IntPtr.Zero);
        return primary != IntPtr.Zero ? primary : first;
    }

    private delegate bool EnumWindowsProc(IntPtr window, IntPtr parameter);

    [StructLayout(LayoutKind.Sequential)]
    private struct NativeRect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr parameter);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindow(IntPtr window);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindowVisible(IntPtr window);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern int GetWindowTextLength(IntPtr window);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern int GetWindowText(IntPtr window, StringBuilder text, int maxCount);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern int GetClassName(IntPtr window, StringBuilder className, int maxCount);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetForegroundWindow(IntPtr window);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool ShowWindow(IntPtr window, int command);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr FindWindowEx(IntPtr parent, IntPtr childAfter, string className, string? windowName);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetWindowRect(IntPtr window, out NativeRect rectangle);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW", SetLastError = true)]
    private static extern IntPtr GetWindowLongPtr(IntPtr window, int index);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW", SetLastError = true)]
    private static extern IntPtr SetWindowLongPtr(IntPtr window, int index, IntPtr value);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetParent(IntPtr child, IntPtr newParent);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetWindowPos(IntPtr window, IntPtr insertAfter, int x, int y, int width, int height, uint flags);
}

