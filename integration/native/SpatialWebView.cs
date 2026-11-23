using System;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;

// The only native window we create is a child of the ORBIT frame.
internal sealed class SpatialWindow : NativeWindow, IDisposable {
    private const string Site = "winmap.orbit.invalid";
    private const int RefreshSize = 0x8001;
    private const int ShowEarth = 0x8002;
    private const int CloseView = 0x0010;
    [StructLayout(LayoutKind.Sequential)] private struct Rect { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")] private static extern bool GetClientRect(IntPtr hwnd, out Rect rect);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll")] private static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll")] private static extern bool PostMessage(IntPtr hwnd, int message, IntPtr w, IntPtr l);

    private readonly IntPtr parent;
    private readonly uint parentPid;
    private readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
    private readonly string assets, profile;
    private CoreWebView2Controller controller;
    private Size size;
    private bool started, closed;
    private bool earth;

    public SpatialWindow(IntPtr parent, string assets, string profile, bool earth) {
        this.parent = parent;
        this.assets = assets;
        this.profile = profile;
        this.earth = earth;
        if (GetWindowThreadProcessId(parent, out parentPid) == 0) throw new ArgumentException();
        CreateHandle(new CreateParams { Parent = parent, Caption = "ORBIT Winmap",
            Style = 0x40000000 | 0x10000000 | 0x02000000 | 0x04000000, Width = 1, Height = 1 });
        Console.WriteLine("HWND " + Handle.ToInt64());
        var ownHandle = Handle;
        new Thread(delegate() {
            string line;
            try {
                while ((line = Console.ReadLine()) != null && line != "close") {
                    if (line == "resize") PostMessage(ownHandle, RefreshSize, IntPtr.Zero, IntPtr.Zero);
                    if (line == "earth") PostMessage(ownHandle, ShowEarth, IntPtr.Zero, IntPtr.Zero);
                }
            } catch (IOException) { }
            PostMessage(ownHandle, CloseView, IntPtr.Zero, IntPtr.Zero);
        }) { IsBackground = true }.Start();
        timer.Interval = 150;
        timer.Tick += (s, e) => {
            ResizeView();
            if (!started && !closed) { started = true; Initialize(); }
        };
        timer.Start();
    }

    private void ResizeView() {
        if (closed) return;
        Rect rect;
        uint currentPid;
        if (!GetClientRect(parent, out rect) || GetWindowThreadProcessId(parent, out currentPid) == 0 || currentPid != parentPid) {
            Dispose(); return;
        }
        var next = new Size(Math.Max(1, rect.Right), Math.Max(1, rect.Bottom));
        if (size != next) {
            size = next;
            SetWindowPos(Handle, IntPtr.Zero, 0, 0, size.Width, size.Height, 0x0014);
            if (controller != null) controller.Bounds = new Rectangle(Point.Empty, size);
        }
        if (controller != null && controller.IsVisible != IsWindowVisible(parent))
            controller.IsVisible = IsWindowVisible(parent);
    }

    private static bool IsLocal(string address, bool documentOnly) {
        Uri uri;
        return Uri.TryCreate(address, UriKind.Absolute, out uri) && uri.Scheme == "https" &&
            uri.Host == Site && uri.IsDefaultPort && uri.UserInfo.Length == 0 &&
            (!documentOnly || uri.AbsolutePath == "/index.html");
    }

    private async void Initialize() {
        try {
            var env = await CoreWebView2Environment.CreateAsync(null, profile, null);
            if (closed) return;
            var created = await env.CreateCoreWebView2ControllerAsync(Handle);
            if (closed) { created.Close(); return; }
            controller = created;
            controller.Bounds = new Rectangle(Point.Empty, size);
            var view = controller.CoreWebView2;
            view.Settings.AreDevToolsEnabled = false;
            view.Settings.AreDefaultContextMenusEnabled = false;
            view.Settings.IsWebMessageEnabled = false;
            view.Settings.AreHostObjectsAllowed = false;
            view.Settings.AreBrowserAcceleratorKeysEnabled = false;
            view.Settings.IsPasswordAutosaveEnabled = false;
            view.Settings.IsGeneralAutofillEnabled = false;
            view.Settings.IsStatusBarEnabled = false;
            view.SetVirtualHostNameToFolderMapping(Site, assets, CoreWebView2HostResourceAccessKind.Deny);
            view.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
            view.WebResourceRequested += (s, e) => {
                if (!IsLocal(e.Request.Uri, false))
                    e.Response = env.CreateWebResourceResponse(null, 403, "Local content only", "");
            };
            view.NavigationStarting += (s, e) => { if (!IsLocal(e.Uri, true)) e.Cancel = true; };
            view.FrameNavigationStarting += (s, e) => e.Cancel = true;
            view.NewWindowRequested += (s, e) => e.Handled = true;
            view.LaunchingExternalUriScheme += (s, e) => e.Cancel = true;
            view.PermissionRequested += (s, e) => e.State = CoreWebView2PermissionState.Deny;
            view.DownloadStarting += (s, e) => e.Cancel = true;
            view.ProcessFailed += (s, e) => {
                if (e.ProcessFailedKind == CoreWebView2ProcessFailedKind.BrowserProcessExited ||
                    e.ProcessFailedKind == CoreWebView2ProcessFailedKind.RenderProcessExited) Fail();
            };
            await view.AddScriptToExecuteOnDocumentCreatedAsync(
                "Object.defineProperty(window, '__orbitEmbeddedReadOnly', {value:true})");
            if (closed) return;
            view.NavigationCompleted += async (s, e) => {
                if (closed) return;
                try {
                    if (!e.IsSuccess) { Fail(); return; }
                    var ready = await view.ExecuteScriptAsync(
                        "!!(document.querySelector('#space') && window.MolecularSpace && document.querySelector('#earthButton'))");
                    if (closed) return;
                    if (ready != "true") { Fail(); return; }
                    Console.WriteLine("READY");
                } catch { Fail(); }
            };
            view.Navigate("https://" + Site + "/index.html" + (earth ? "#terre" : ""));
        } catch { Fail(); }
    }

    private void Fail() {
        if (closed) return;
        Console.WriteLine("ERROR");
        Environment.ExitCode = 1;
        Dispose();
    }
    protected override void WndProc(ref Message m) {
        if (m.Msg == RefreshSize) { ResizeView(); return; }
        if (m.Msg == ShowEarth) {
            earth = true;
            if (controller != null) controller.CoreWebView2.ExecuteScriptAsync("document.querySelector('#earthButton')?.click()");
            return;
        }
        if (m.Msg == CloseView) { Dispose(); return; }
        base.WndProc(ref m);
    }
    public void Dispose() {
        if (closed) return;
        closed = true;
        timer.Dispose();
        if (controller != null) controller.Close();
        if (Handle != IntPtr.Zero) DestroyHandle();
        Application.ExitThread();
    }
    [STAThread] public static int Main(string[] args) {
        try {
            if (args.Length != 4 || !File.Exists(Path.Combine(args[1], "index.html"))) return 2;
            SynchronizationContext.SetSynchronizationContext(new WindowsFormsSynchronizationContext());
            using (var host = new SpatialWindow(new IntPtr(long.Parse(args[0])), args[1], args[2], args[3] == "earth")) Application.Run();
            return Environment.ExitCode;
        } catch { Console.WriteLine("ERROR"); return 1; }
    }
}
