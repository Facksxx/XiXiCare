import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const run = (command, args, capture = false) => {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout?.trim() ?? '';
};

const dirty = run('git', ['status', '--porcelain'], true);
if (dirty) {
  console.error('发布前工作区必须保持干净，请先提交代码变更。');
  process.exit(1);
}

run('npm', ['run', 'apk']);
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const tag = `v${version}`;

run('git', ['add', 'package.json', 'package-lock.json', 'android/app/build.gradle', 'XiXiCare.apk']);
run('git', ['commit', '-m', `release: ${tag}`]);
run('git', ['tag', '-a', tag, '-m', `XiXiCare ${version}`]);
run('git', ['push', 'origin', 'main', '--follow-tags']);

console.log(`已发布 ${tag}，GitHub Actions 将上传 XiXiCare.apk。`);
