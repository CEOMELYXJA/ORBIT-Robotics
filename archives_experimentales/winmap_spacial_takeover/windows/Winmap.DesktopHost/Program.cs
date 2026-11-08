namespace Winmap.DesktopHost;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        var desktopSurface = args.Any(argument => argument.Equals("--desktop", StringComparison.OrdinalIgnoreCase));
        Application.Run(new MainForm(desktopSurface));
    }
}

