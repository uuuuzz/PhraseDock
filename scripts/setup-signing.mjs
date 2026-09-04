import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { LOCAL_IDENTITY_NAME, resolveSigningIdentity, signNativeFile } from './signing.mjs';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr?.trim() || result.stdout?.trim() || `${command} failed`;
    throw new Error(detail);
  }
  return result.stdout || '';
}

if (process.platform !== 'darwin') throw new Error('本地签名身份只能在 macOS 上创建。');
try {
  const existing = resolveSigningIdentity();
  console.log(`Signing certificate already exists: ${existing.name} (${existing.sha1})`);
  process.exit(0);
} catch (error) {
  if (!String(error.message).includes('没有找到')) throw error;
}

const temp = mkdtempSync(path.join(os.tmpdir(), 'phrasedock-signing-'));
chmodSync(temp, 0o700);
try {
  const configPath = path.join(temp, 'openssl.cnf');
  const keyPath = path.join(temp, 'private-key.pem');
  const certPath = path.join(temp, 'certificate.pem');
  const bundlePath = path.join(temp, 'identity.p12');
  const importPassword = randomBytes(24).toString('hex');
  writeFileSync(configPath, `[req]\nprompt = no\ndistinguished_name = dn\nx509_extensions = ext\n\n[dn]\nCN = ${LOCAL_IDENTITY_NAME}\nO = PhraseDock Local Development\n\n[ext]\nbasicConstraints = critical,CA:FALSE\nkeyUsage = critical,digitalSignature\nextendedKeyUsage = critical,codeSigning\nsubjectKeyIdentifier = hash\nauthorityKeyIdentifier = keyid,issuer\n`, { mode: 0o600 });
  run('openssl', ['req', '-new', '-x509', '-newkey', 'rsa:3072', '-sha256', '-days', '3650', '-nodes',
    '-config', configPath, '-keyout', keyPath, '-out', certPath]);
  chmodSync(keyPath, 0o600);
  run('openssl', ['pkcs12', '-export', '-name', LOCAL_IDENTITY_NAME, '-inkey', keyPath,
    '-in', certPath, '-out', bundlePath, '-passout', `pass:${importPassword}`]);
  const keychain = run('security', ['default-keychain', '-d', 'user']).trim().replace(/^"|"$/g, '');
  run('security', ['import', bundlePath, '-k', keychain, '-P', importPassword, '-T', '/usr/bin/codesign']);
  const identity = resolveSigningIdentity();
  const probe = path.join(temp, 'signing-probe');
  writeFileSync(probe, readFileSync('/usr/bin/true'), { mode: 0o700 });
  signNativeFile(probe);
  run('codesign', ['--verify', '--strict', probe]);
  console.log(`Created PhraseDock signing certificate: ${identity.sha1}`);
  console.log('The private key is stored in the login keychain; no trust-root setting was added.');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
