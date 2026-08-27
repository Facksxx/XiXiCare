#!/bin/zsh
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
VERSION=$(node -p "require('$ROOT/package.json').version")
TAG="v$VERSION"
APK="$ROOT/XiXiCare.apk"
NOTES=${RELEASE_NOTES:-体验优化与问题修复}

credentials=$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill)
github_user=$(printf '%s\n' "$credentials" | sed -n 's/^username=//p')
github_token=$(printf '%s\n' "$credentials" | sed -n 's/^password=//p')
if [[ -z "$github_user" || -z "$github_token" ]]; then
  echo '缺少可用的 GitHub Git 凭据，无法创建发行版'
  exit 1
fi

github_api=https://api.github.com/repos/Facksxx/XiXiCare
github_release=$(curl -fsS -u "$github_user:$github_token" -H 'Accept: application/vnd.github+json' "$github_api/releases/tags/$TAG" 2>/dev/null || true)
github_release_id=$(printf '%s' "$github_release" | jq -r '.id // empty')
if [[ -z "$github_release_id" ]]; then
  payload=$(jq -n --arg tag "$TAG" --arg name "XiXiCare $TAG" --arg body "$NOTES" '{tag_name:$tag,target_commitish:"main",name:$name,body:$body,draft:false,prerelease:false}')
  github_release=$(curl -fsS -u "$github_user:$github_token" -X POST -H 'Accept: application/vnd.github+json' -H 'Content-Type: application/json' -d "$payload" "$github_api/releases")
  github_release_id=$(printf '%s' "$github_release" | jq -r '.id')
fi
github_assets=$(curl -fsS -u "$github_user:$github_token" -H 'Accept: application/vnd.github+json' "$github_api/releases/$github_release_id/assets")
if ! printf '%s' "$github_assets" | jq -e '.[] | select(.name == "XiXiCare.apk")' >/dev/null; then
  curl -fsS -u "$github_user:$github_token" -X POST -H 'Accept: application/vnd.github+json' -H 'Content-Type: application/vnd.android.package-archive' --data-binary "@$APK" "https://uploads.github.com/repos/Facksxx/XiXiCare/releases/$github_release_id/assets?name=XiXiCare.apk" >/dev/null
fi

gitee_token=${GITEE_ACCESS_TOKEN:-$(sed -n 's/^GITEE_ACCESS_TOKEN=//p' "$ROOT/.env.local")}
if [[ -z "$gitee_token" ]]; then
  echo '缺少 GITEE_ACCESS_TOKEN，无法创建 Gitee 发行版'
  exit 1
fi
gitee_api=https://gitee.com/api/v5/repos/Facksxx/xi-xi-care
git -C "$ROOT" push "https://oauth2:${gitee_token}@gitee.com/Facksxx/xi-xi-care.git" main:main --follow-tags
gitee_release=$(curl -fsS -H "Authorization: token $gitee_token" "$gitee_api/releases/tags/$TAG" 2>/dev/null || true)
gitee_release_id=$(printf '%s' "$gitee_release" | jq -r '.id // empty')
if [[ -z "$gitee_release_id" ]]; then
  payload=$(jq -n --arg tag "$TAG" --arg name "XiXiCare $TAG" --arg body "$NOTES" '{tag_name:$tag,target_commitish:"main",name:$name,body:$body,prerelease:false}')
  gitee_release=$(curl -fsS -X POST -H "Authorization: token $gitee_token" -H 'Content-Type: application/json' -d "$payload" "$gitee_api/releases")
  gitee_release_id=$(printf '%s' "$gitee_release" | jq -r '.id')
fi
gitee_assets=$(curl -fsS -H "Authorization: token $gitee_token" "$gitee_api/releases/$gitee_release_id/attach_files")
if ! printf '%s' "$gitee_assets" | jq -e '.[] | select(.name == "XiXiCare.apk")' >/dev/null; then
  curl -fsS -X POST -H "Authorization: token $gitee_token" -F "file=@$APK;type=application/vnd.android.package-archive" "$gitee_api/releases/$gitee_release_id/attach_files" >/dev/null
fi

echo "已发布 $TAG，GitHub 与 Gitee 发行版均已上传 XiXiCare.apk。"
