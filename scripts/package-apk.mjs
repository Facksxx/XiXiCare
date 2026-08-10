import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const noBump = process.argv.includes('--no-bump');
const packagePath = join(root, 'package.json');
const lockPath = join(root, 'package-lock.json');
const gradlePath = join(root, 'android/app/build.gradle');

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
const targetApk = join(root, 'XiXiCare.apk');
copyFileSync(sourceApk, targetApk);
const hash = createHash('sha256').update(readFileSync(targetApk)).digest('hex');

console.log(`\nXiXiCare ${version} (${versionCode})`);
console.log(`APK: ${targetApk}`);
console.log(`SHA-256: ${hash}`);
