import { spawnSync } from 'node:child_process';

export const APP_IDENTIFIER = 'com.phrasedock.desktop';
export const LOCAL_IDENTITY_NAME = 'PhraseDock Local Code Signing';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr?.trim() || result.stdout?.trim() || `${command} failed`;
    throw new Error(detail);
  }
  return result.stdout || '';
}

export function resolveSigningIdentity() {
  const name = process.env.PHRASEDOCK_SIGN_IDENTITY || LOCAL_IDENTITY_NAME;
  const result = spawnSync('security', ['find-certificate', '-c', name, '-Z'], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim() || '';
    if (detail.includes('could not be found')) {
      throw new Error(`没有找到“${name}”代码签名证书。请先运行 npm run setup:signing。`);
    }
    throw new Error(detail || '无法读取代码签名证书。');
  }
  const output = result.stdout || '';
  const match = output.match(/SHA-1 hash:\s*([0-9A-F]{40})/i);
  if (!match) {
    throw new Error(`没有找到“${name}”代码签名证书。请先运行 npm run setup:signing。`);
  }
  return { name, sha1: match[1].toUpperCase() };
}

export function signNativeFile(filePath) {
  const identity = resolveSigningIdentity();
  run('codesign', ['--force', '--sign', identity.sha1, filePath], { stdio: 'inherit' });
  return identity;
}

export function signApplication(appPath) {
  const identity = resolveSigningIdentity();
  // Sign every nested executable first, then give the root app a stable,
  // certificate-bound designated requirement for macOS privacy permissions.
  run('codesign', ['--force', '--deep', '--sign', identity.sha1, appPath], { stdio: 'inherit' });
  const requirement = `designated => identifier "${APP_IDENTIFIER}" and certificate leaf = H"${identity.sha1}"`;
  run('codesign', ['--force', '--sign', identity.sha1, `-r=${requirement}`, appPath], { stdio: 'inherit' });
  run('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'inherit' });
  return { ...identity, requirement };
}
