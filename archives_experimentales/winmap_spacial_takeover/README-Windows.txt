winmap spacial takeover — prototype Windows x64

Extract the entire archive and keep the dist folder beside both launcher files.
Run Start-Winmap-Native.cmd for the normal application window. This launcher uses WebView2's software rendering mode to avoid the GPU access-denied failure recorded on this computer; Winmap uses its Canvas 2D perspective renderer if WebGL2 is unavailable. The recovery build keeps its WebView2 profile separate from older Winmap installs. If WebView2's renderer itself fails twice, Winmap opens a normal Edge window with a dedicated profile, waits for a visible window and brings it forward. If Edge does not expose a visible window, it tries the Windows default browser. The blocking native window then closes.
Microsoft Edge WebView2 Evergreen Runtime is required.
Close Winmap with the spherical command menu → Fermer Winmap, or use Alt+F4.
The native launchers check only for another copy of the same build, so a legacy Winmap instance can remain open while the recovery build starts. They never stop an existing process automatically.

In the native app, select an application atom and choose a Windows .exe in its inspector to link it. The path stays in the local WebView2 profile. Click Open later to launch it; Winmap passes no arguments and does not auto-launch apps. The web-only Edge mode keeps app atoms as spatial representations.

Start-Winmap-Desktop.cmd attempts an experimental Explorer desktop attachment. It does not replace the Windows shell and falls back to a normal window if attachment fails. Close Winmap to remove the surface.

Long-term direction: add a startup choice between the normal Windows desktop and a Winmap session, then map local folders into Winmap. This is not implemented yet: Windows starts normally, Winmap is launched manually, and only folders selected by the user are read. A reliable return to Windows at startup must be in place before offering Winmap as a replacement desktop.

A verification in this environment failed to launch the WebView2 renderer (RenderProcessExited, LaunchFailed code 49) and reported GPU access denied (0xC0000022). The cause is not established and visual testing is outstanding. The host records WebView2 initialization phases, page bridge readiness, and desktop attachment results in webview-startup.log; if the profile cannot be written, it falls back to %TEMP%\Winmap Spacial Takeover. Desktop mode now waits for the page's native bridge and reveals a normal window after 30 seconds if it never becomes ready. The host writes renderer failures to webview-process-failures.log and closes after one renderer retry. If you encounter the same failure, use Start-Winmap.cmd from the full source archive to run the web client in Edge.

Before rebuilding over an open native instance, the build guard reports its PID and MainWindowHandle and refuses to overwrite its files. If it has no visible window, locate that PID in Task Manager > Details and close only Winmap.DesktopHost.exe; the build script never terminates it automatically.

