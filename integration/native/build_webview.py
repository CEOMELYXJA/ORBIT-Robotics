"""Installe le SDK WebView2 approuvé et compile l'hôte local, sans privilèges."""
import hashlib
from pathlib import Path
import os
import subprocess
import urllib.request
import zipfile

HERE = Path(__file__).resolve().parent
INSTALL = HERE.parent / '.venv' / 'orbit-webview'
VERSION = '1.0.3537.50'
DIGEST = '5ea526bbd728adda0da4d31219267e96460494a427e4894c4e09d9f320f4b9aa'
URL = f'https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/{VERSION}/microsoft.web.webview2.{VERSION}.nupkg'


def build():
    compiler = Path(os.environ['WINDIR']) / 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
    if not compiler.is_file():
        raise RuntimeError('Le compilateur .NET Framework x64 est introuvable.')
    INSTALL.mkdir(parents=True, exist_ok=True)
    archive = INSTALL / 'webview2.nupkg'
    if not archive.is_file():
        with urllib.request.urlopen(URL, timeout=45) as response:
            package = response.read()
        if hashlib.sha256(package).hexdigest() != DIGEST:
            raise RuntimeError('Empreinte du SDK Microsoft inattendue.')
        archive.write_bytes(package)
    if hashlib.sha256(archive.read_bytes()).hexdigest() != DIGEST:
        raise RuntimeError('Empreinte du cache SDK invalide.')
    with zipfile.ZipFile(archive) as package:
        for name in ('lib/net462/Microsoft.Web.WebView2.Core.dll',
                     'runtimes/win-x64/native/WebView2Loader.dll', 'LICENSE.txt'):
            target = INSTALL / Path(name).name
            content = package.read(name)
            if not target.exists() or target.read_bytes() != content:
                target.write_bytes(content)
    subprocess.run([str(compiler), '/nologo', '/platform:x64', '/target:exe',
                    '/r:System.Windows.Forms.dll', '/r:System.Drawing.dll',
                    '/r:Microsoft.Web.WebView2.Core.dll', '/out:OrbitSpatialHost.exe',
                    str(HERE / 'SpatialWebView.cs')], cwd=INSTALL, check=True)
    print('Hôte spatial ORBIT prêt.')


if __name__ == '__main__':
    build()
