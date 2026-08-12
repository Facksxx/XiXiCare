// 应用版本与更新检查工具
// 版本号通过 Vite `define` 从 package.json 注入（见 vite.config.ts）
export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

export const RELEASE_REPO = 'Facksxx/xi-xi-care';
export const RELEASE_API_URL = `https://gitee.com/api/v5/repos/${RELEASE_REPO}/releases/latest`;
export const RELEASES_API_URL = `https://gitee.com/api/v5/repos/${RELEASE_REPO}/releases?per_page=100`;
export const RELEASES_PAGE_URL = `https://gitee.com/${RELEASE_REPO}/releases`;

export interface RemoteRelease {
  /** 不带前缀 v 的版本号，例如 "1.0.3" */
  version: string;
  /** 带 v 前缀的标签，例如 "v1.0.3" */
  tag: string;
  /** 发布页面地址 */
  htmlUrl: string;
  /** APK 下载直链 */
  apkUrl: string;
  /** 发布时间（ISO 字符串） */
  publishedAt: string;
  /** 发布说明（可能为空） */
  notes: string;
  /** 从当前版本到最新版之间的逐版本更新说明 */
  history: Array<{ version: string; publishedAt: string; notes: string }>;
}

/** 解析形如 "1.2.3" 或 "v1.2.3" 的版本号为数字数组 */
const parseVersion = (raw: string): number[] => {
  const cleaned = raw.trim().replace(/^v/i, '');
  const parts = cleaned.split('.').map(part => Number.parseInt(part, 10));
  if (parts.some(part => Number.isNaN(part))) return [];
  return parts;
};

/**
 * 比较两个语义化版本号
 * @returns 正数表示 a 更新，负数表示 b 更新，0 表示相同
 */
export const compareVersions = (a: string, b: string): number => {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
};

/** 判断 remote 是否比当前版本更新 */
export const isNewer = (remote: string, current: string = APP_VERSION): boolean => compareVersions(remote, current) > 0;

interface GiteeReleaseResponse {
  id: number;
  tag_name: string;
  html_url?: string | null;
  created_at?: string;
  published_at?: string | null;
  body?: string;
}

interface GiteeAttachment {
  id: number;
  name: string;
}

/**
 * 拉取 Gitee 最新 release 及 APK 附件信息。
 * @throws 网络或解析异常时抛出 Error
 */
export const fetchLatestRelease = async (): Promise<RemoteRelease> => {
  const headers = { Accept: 'application/json' };
  const response = await fetch(RELEASE_API_URL, {
    headers,
    cache: 'no-store'
  });
  if (!response.ok) {
    throw new Error(`获取更新信息失败（HTTP ${response.status}）`);
  }
  const data = (await response.json()) as GiteeReleaseResponse;
  const tag = data.tag_name ?? '';
  const version = tag.replace(/^v/i, '');
  const attachmentsResponse = await fetch(
    `https://gitee.com/api/v5/repos/${RELEASE_REPO}/releases/${data.id}/attach_files?per_page=100`,
    { headers, cache: 'no-store' }
  );
  if (!attachmentsResponse.ok) {
    throw new Error(`获取安装包信息失败（HTTP ${attachmentsResponse.status}）`);
  }
  const attachments = (await attachmentsResponse.json()) as GiteeAttachment[];
  const apkAsset = attachments.find(asset => asset.name.toLowerCase() === 'xixicare.apk')
    ?? attachments.find(asset => asset.name.toLowerCase().endsWith('.apk'));
  if (!apkAsset) throw new Error('当前发行版未包含 XiXiCare.apk');
  let history: RemoteRelease['history'] = [];
  try {
    const releasesResponse = await fetch(RELEASES_API_URL, { headers, cache: 'no-store' });
    if (releasesResponse.ok) {
      const releases = (await releasesResponse.json()) as GiteeReleaseResponse[];
      history = releases
        .map(release => ({
          version: (release.tag_name ?? '').replace(/^v/i, ''),
          publishedAt: release.published_at ?? release.created_at ?? '',
          notes: (release.body ?? '').trim()
        }))
        .filter(release => release.version && compareVersions(release.version, APP_VERSION) > 0 && compareVersions(release.version, version) <= 0)
        .sort((a, b) => compareVersions(a.version, b.version));
    }
  } catch {
    // Latest release information is still usable when release history is unavailable.
  }
  if (history.length === 0) history = [{ version, publishedAt: data.published_at ?? data.created_at ?? '', notes: (data.body ?? '').trim() }];
  return {
    version,
    tag,
    htmlUrl: data.html_url || RELEASES_PAGE_URL,
    apkUrl: `https://gitee.com/api/v5/repos/${RELEASE_REPO}/releases/${data.id}/attach_files/${apkAsset.id}/download`,
    publishedAt: data.published_at ?? data.created_at ?? '',
    notes: (data.body ?? '').trim(),
    history
  };
};
