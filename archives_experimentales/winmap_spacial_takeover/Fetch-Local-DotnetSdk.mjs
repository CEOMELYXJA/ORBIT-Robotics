import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { unlink, rename } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

async function latestSdkArchive() {
  const metadataUrl = 'https://builds.dotnet.microsoft.com/dotnet/release-metadata/10.0/releases.json';
  const response = await fetch(metadataUrl);
  if (!response.ok) throw new Error(`.NET release metadata returned HTTP ${response.status}.`);
  const metadata = await response.json();
  const version = metadata['latest-sdk'];
  const release = metadata.releases.find(item => item.sdk?.version === version);
  const artifact = release?.sdk?.files?.find(file => file.rid === 'win-x64' && file.name.endsWith('.zip'));
  if (!artifact || !/^[a-f0-9]{128}$/i.test(artifact.hash)) throw new Error('Official Windows x64 SDK archive metadata is incomplete.');
  if (new URL(artifact.url).hostname !== 'builds.dotnet.microsoft.com') throw new Error('The SDK archive host is not the official Microsoft build host.');
  return { version, artifact };
}

async function hashFile(path) {
  const digest = createHash('sha512');
  let bytes = 0;
  for await (const chunk of createReadStream(path)) {
    bytes += chunk.length;
    digest.update(chunk);
  }
  return { bytes, hash: digest.digest('hex') };
}

const args = process.argv.slice(2);
const verifyOnly = args[0] === '--verify';
const destination = verifyOnly ? args[1] : args[0];
if (!destination) throw new Error('Pass an SDK archive output path, or --verify followed by an existing archive.');

const { version, artifact } = await latestSdkArchive();
if (verifyOnly) {
  const result = await hashFile(destination);
  if (result.hash.toLowerCase() !== artifact.hash.toLowerCase()) throw new Error(`SDK SHA-512 mismatch for ${destination}.`);
  process.stdout.write(`Verified official .NET SDK ${version}: ${result.bytes} bytes; SHA-512 ${result.hash}\n`);
} else {
  const temporaryPath = `${destination}.partial-${process.pid}`;
  const response = await fetch(artifact.url);
  if (!response.ok || !response.body) throw new Error(`Official SDK download returned HTTP ${response.status}.`);
  const digest = createHash('sha512');
  let bytes = 0;
  let nextReport = 32 * 1024 * 1024;
  const monitor = new Transform({
    transform(chunk, encoding, callback) {
      bytes += chunk.length;
      digest.update(chunk);
      if (bytes >= nextReport) {
        process.stdout.write(`Downloaded ${(bytes / 1024 / 1024).toFixed(0)} MiB of .NET SDK ${version}\n`);
        nextReport += 32 * 1024 * 1024;
      }
      callback(null, chunk);
    }
  });
  try {
    await pipeline(Readable.fromWeb(response.body), monitor, createWriteStream(temporaryPath, { flags: 'wx' }));
    const actualHash = digest.digest('hex');
    if (actualHash.toLowerCase() !== artifact.hash.toLowerCase()) throw new Error('Downloaded SDK SHA-512 does not match official release metadata.');
    await rename(temporaryPath, destination);
    process.stdout.write(`Verified official .NET SDK ${version}: ${bytes} bytes; SHA-512 ${actualHash}\n`);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

