// 应用版本与更新检查工具
// 版本号通过 Vite `define` 从 package.json 注入（见 vite.config.ts）
export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

// GitHub 仓库发布地址
export const RELEASE_REPO = 'Facksxx/XiXiCare';
export const RELEASE_API_URL = `https://api.github.com/repos/${RELEASE_REPO}/releases/latest`;
// 始终指向最新发布版本 APK 的稳定直链
export const LATEST_APK_URL = `https://github.com/${RELEASE_REPO}/releases/latest/download/XiXiCare.apk`;
export const RELEASES_PAGE_URL = `https://github.com/${RELEASE_REPO}/releases`;

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

interface GitHubReleaseResponse {
  tag_name: string;
  html_url: string;
  published_at: string;
  body?: string;
  assets?: Array<{ name: string; browser_download_url: string }>;
}

/**
 * 拉取 GitHub 最新 release 信息
 * @throws 网络或解析异常时抛出 Error
 */
export const fetchLatestRelease = async (): Promise<RemoteRelease> => {
  const response = await fetch(RELEASE_API_URL, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store'
  });
  if (!response.ok) {
    throw new Error(`获取更新信息失败（HTTP ${response.status}）`);
  }
  const data = (await response.json()) as GitHubReleaseResponse;
  const tag = data.tag_name ?? '';
  const version = tag.replace(/^v/i, '');
  const apkAsset = data.assets?.find(asset => asset.name.toLowerCase().endsWith('.apk'));
  return {
    version,
    tag,
    htmlUrl: data.html_url || RELEASES_PAGE_URL,
    apkUrl: apkAsset?.browser_download_url || LATEST_APK_URL,
    publishedAt: data.published_at ?? '',
    notes: (data.body ?? '').trim()
  };
};
