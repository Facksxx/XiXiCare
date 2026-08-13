import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, copyFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const noBump = process.argv.includes('--no-bump');
const packagePath = join(root, 'package.json');
const gradlePath = join(root, 'android/app/build.gradle');
const expectedSigningCertificate = 'c52f687a35e149777a7b23c0fb9c96aa0b33f2db74922fe55e28422c7a759193';

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false, ...options });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

if (!noBump) run('npm', ['version', 'patch', '--no-git-tag-version']);

const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
const version = packageJson.version;
const parts = version.split('.').map(Number);
if (parts.length !== 3 || parts.some(part => !Number.isInteger(part) || part < 0)) {
  throw new Error(`无效版本号：${version}`);
}
const [major, minor, patch] = parts;
const versionCode = major * 1_000_000 + minor * 1_000 + patch;
if (versionCode < 1 || versionCode > 2_100_000_000) throw new Error(`Android versionCode 超出范围：${versionCode}`);

let gradle = readFileSync(gradlePath, 'utf8');
gradle = gradle
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]+"/, `versionName "${version}"`);
writeFileSync(gradlePath, gradle);

run('npm', ['run', 'build']);
run('npx', ['cap', 'sync', 'android']);

const javaCandidates = [
  process.env.JAVA_HOME,
  '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
  '/opt/homebrew/Cellar/openjdk@21/21.0.12/libexec/openjdk.jdk/Contents/Home',
  '/Applications/Android Studio.app/Contents/jbr/Contents/Home'
].filter(Boolean);
const javaHome = javaCandidates.find(candidate => existsSync(join(candidate, 'bin/java')));
if (!javaHome) throw new Error('未找到 Java 21，请设置 JAVA_HOME');

run(join(root, 'android/gradlew'), ['clean', 'assembleDebug'], {
  cwd: join(root, 'android'),
  env: { ...process.env, JAVA_HOME: javaHome }
});

const sourceApk = join(root, 'android/app/build/outputs/apk/debug/app-debug.apk');
const targetApk = join(root, 'XIXI-CARE-Offline.apk');
copyFileSync(sourceApk, targetApk);

const localPropertiesPath = join(root, 'android/local.properties');
const localProperties = existsSync(localPropertiesPath) ? readFileSync(localPropertiesPath, 'utf8') : '';
const configuredSdk = localProperties.match(/^sdk\.dir=(.+)$/m)?.[1]?.replace(/\\:/g, ':').replace(/\\\\/g, '\\');
const sdkRoot = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || configuredSdk;
const buildToolsRoot = sdkRoot ? join(sdkRoot, 'build-tools') : '';
const buildToolVersions = buildToolsRoot && existsSync(buildToolsRoot)
  ? readdirSync(buildToolsRoot).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  : [];
const apksigner = buildToolVersions
  .map(version => join(buildToolsRoot, version, 'apksigner'))
  .find(candidate => existsSync(candidate));
if (!apksigner) throw new Error('未找到 Android apksigner，无法验证 APK 签名');

const signatureResult = spawnSync(apksigner, ['verify', '--print-certs', targetApk], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, JAVA_HOME: javaHome }
});
if (signatureResult.status !== 0) {
  throw new Error(`APK 签名验证失败：${signatureResult.stderr || signatureResult.stdout}`);
}
const signingCertificate = signatureResult.stdout
  .match(/Signer #1 certificate SHA-256 digest:\s*([0-9a-f]+)/i)?.[1]
  ?.toLowerCase();
if (signingCertificate !== expectedSigningCertificate) {
  throw new Error(`APK 签名不一致，已停止发布。期望 ${expectedSigningCertificate}，实际 ${signingCertificate || '无法识别'}`);
}

const hash = createHash('sha256').update(readFileSync(targetApk)).digest('hex');

console.log(`\nXiXiCare ${version} (${versionCode})`);
console.log(`APK: ${targetApk}`);
console.log(`Signing certificate: ${signingCertificate}`);
console.log(`SHA-256: ${hash}`);
