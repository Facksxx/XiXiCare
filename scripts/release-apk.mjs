import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const localEnv = readFileSync(join(root, '.env.local'), 'utf8');
const giteeToken = process.env.GITEE_ACCESS_TOKEN
  || localEnv.match(/^GITEE_ACCESS_TOKEN=(.+)$/m)?.[1]?.trim();
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

run('npm', ['run', 'apk:build']);
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const tag = `v${version}`;

run('git', ['add', 'package.json', 'package-lock.json', 'android/app/build.gradle', 'update-manifest.json']);
run('git', ['commit', '-m', `release: ${tag}`]);
run('git', ['tag', '-a', tag, '-m', `XiXiCare ${version}`]);
run('git', ['push', 'origin', 'main', '--follow-tags']);
run('gh', [
  'release', 'create', tag, 'XiXiCare.apk',
  '--repo', 'Facksxx/XiXiCare',
  '--title', `XiXiCare ${tag}`,
  '--generate-notes'
]);

if (!giteeToken) {
  console.error('缺少 GITEE_ACCESS_TOKEN，无法发布 Gitee 发行版。');
  process.exit(1);
}

const giteeUrl = `https://oauth2:${encodeURIComponent(giteeToken)}@gitee.com/Facksxx/xi-xi-care.git`;
run('git', ['push', giteeUrl, `main:main`, '--follow-tags']);

const apiHeaders = { Authorization: `token ${giteeToken}`, Accept: 'application/json' };
const releaseResponse = await fetch('https://gitee.com/api/v5/repos/Facksxx/xi-xi-care/releases', {
  method: 'POST',
  headers: { ...apiHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tag_name: tag,
    target_commitish: 'main',
    name: `XiXiCare ${tag}`,
    body: `XiXiCare ${tag} Android 安装包`,
    prerelease: false
  })
});
if (!releaseResponse.ok) {
  console.error(`创建 Gitee 发行版失败：HTTP ${releaseResponse.status} ${await releaseResponse.text()}`);
  process.exit(1);
}
const release = await releaseResponse.json();
const form = new FormData();
form.append('file', new Blob([readFileSync(join(root, 'XiXiCare.apk'))], {
  type: 'application/vnd.android.package-archive'
}), 'XiXiCare.apk');
const uploadResponse = await fetch(
  `https://gitee.com/api/v5/repos/Facksxx/xi-xi-care/releases/${release.id}/attach_files`,
  { method: 'POST', headers: apiHeaders, body: form }
);
if (!uploadResponse.ok) {
  console.error(`上传 Gitee APK 失败：HTTP ${uploadResponse.status} ${await uploadResponse.text()}`);
  process.exit(1);
}

console.log(`已发布 ${tag}，GitHub 与 Gitee 发行版均已上传 XiXiCare.apk。`);
