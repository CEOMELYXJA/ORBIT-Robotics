import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, readFileSync } from 'node:fs';
import { mkdir, rename, stat, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const projectFile = path.join(projectRoot, 'windows', 'Winmap.DesktopHost', 'Winmap.DesktopHost.csproj');
const project = readFileSync(projectFile, 'utf8');
const webViewVersion = project.match(/PackageReference Include="Microsoft\.Web\.WebView2" Version="([^"]+)"/)?.[1];
const feedPath = process.argv[2];
const dotnet = process.argv[3];
if (!webViewVersion || !feedPath || !dotnet) throw new Error('Pass the local feed path and the dotnet executable.');

const sdkList = execFileSync(dotnet, ['--list-sdks'], { encoding: 'utf8' });
const sdkEntries = [...sdkList.matchAll(/^(10\.\d+\.\d+) \[(.+)\]$/gm)].map(match => ({ version: match[1], sdkRoot: match[2] }));
if (!sdkEntries.length) throw new Error('.NET 10 SDK was not found; install it before preparing the local NuGet feed.');
sdkEntries.sort((left, right) => left.version.localeCompare(right.version, undefined, { numeric: true }));
const sdk = sdkEntries.at(-1);
const sdkProps = readFileSync(path.join(sdk.sdkRoot, sdk.version, 'Microsoft.NETCoreSdk.BundledVersions.props'), 'utf8');
const runtimeVersion = sdkProps.match(/<BundledNETCoreAppPackageVersion>([^<]+)<\/BundledNETCoreAppPackageVersion>/)?.[1];
if (!runtimeVersion) throw new Error(`Unable to read the .NET runtime pack version from SDK ${sdk.version}.`);

const packages = [
  { id: 'microsoft.web.webview2', version: webViewVersion },
  { id: 'microsoft.netcore.app.runtime.win-x64', version: runtimeVersion },
  { id: 'microsoft.windowsdesktop.app.runtime.win-x64', version: runtimeVersion },
  { id: 'microsoft.aspnetcore.app.runtime.win-x64', version: runtimeVersion }
];

async function fileHash(file) {
  const hash = createHash('sha512');
  let size = 0;
  for await (const chunk of createReadStream(file)) {
    size += chunk.length;
    hash.update(chunk);
  }
  return { size, hash: hash.digest('base64') };
}

async function packageMetadata(id, version) {
  const registrationUrl = `https://api.nuget.org/v3/registration5-gz-semver2/${id}/${version}.json`;
  const registrationResponse = await fetch(registrationUrl);
  if (!registrationResponse.ok) throw new Error(`${id} registration returned HTTP ${registrationResponse.status}.`);
  const registration = await registrationResponse.json();
  if (new URL(registration.catalogEntry).hostname !== 'api.nuget.org' || new URL(registration.packageContent).hostname !== 'api.nuget.org') {
    throw new Error(`${id} metadata points outside api.nuget.org.`);
  }
  const catalogResponse = await fetch(registration.catalogEntry);
  if (!catalogResponse.ok) throw new Error(`${id} catalog returned HTTP ${catalogResponse.status}.`);
  const catalog = await catalogResponse.json();
  if (catalog.packageHashAlgorithm !== 'SHA512' || !catalog.packageHash || !Number.isSafeInteger(catalog.packageSize)) {
    throw new Error(`${id} package metadata is missing its SHA-512 or size.`);
  }
  return { registration, catalog };
}

async function ensurePackage({ id, version }) {
  const { registration, catalog } = await packageMetadata(id, version);
  const target = path.join(feedPath, `${id}.${version}.nupkg`);
  try {
    await stat(target);
    const existing = await fileHash(target);
    if (existing.size !== catalog.packageSize || existing.hash !== catalog.packageHash) {
      throw new Error(`${id} exists in the local feed but does not match official NuGet metadata.`);
    }
    process.stdout.write(`Verified cached ${id} ${version}\n`);
    return;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const response = await fetch(registration.packageContent);
  if (!response.ok || !response.body) throw new Error(`${id} package download returned HTTP ${response.status}.`);
  const temporaryPath = `${target}.partial-${process.pid}`;
  const digest = createHash('sha512');
  let bytes = 0;
  const monitor = new Transform({
    transform(chunk, encoding, callback) {
      bytes += chunk.length;
      digest.update(chunk);
      callback(null, chunk);
    }
  });
  try {
    await pipeline(Readable.fromWeb(response.body), monitor, createWriteStream(temporaryPath, { flags: 'wx' }));
    const actualHash = digest.digest('base64');
    if (bytes !== catalog.packageSize || actualHash !== catalog.packageHash) {
      throw new Error(`${id} size or SHA-512 differs from official NuGet metadata.`);
    }
    await rename(temporaryPath, target);
    process.stdout.write(`Downloaded and verified ${id} ${version}: ${bytes} bytes\n`);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

try {
  await mkdir(feedPath, { recursive: true });
  for (const item of packages) await ensurePackage(item);
  process.stdout.write(`Verified local NuGet feed for .NET SDK ${sdk.version}, runtime packs ${runtimeVersion}, and WebView2 ${webViewVersion}.\n`);
} catch (error) {
  const cause = error?.cause?.code ? ` (${error.cause.code})` : '';
  process.stderr.write(`Local NuGet feed preparation failed: ${error instanceof Error ? error.message : String(error)}${cause}\n`);
  process.exitCode = 1;
}

