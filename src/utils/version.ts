// 应用版本与更新检查工具
// 版本号通过 Vite `define` 从 package.json 注入（见 vite.config.ts）
import { Capacitor, CapacitorHttp } from '@capacitor/core';

export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

export const RELEASE_REPO = 'Facksxx/xi-xi-care';
export const RELEASES_PAGE_URL = `https://gitee.com/${RELEASE_REPO}/releases`;
export const UPDATE_MANIFEST_URLS = [
  `https://gitee.com/${RELEASE_REPO}/raw/main/update-manifest.json`,
  'https://raw.githubusercontent.com/Facksxx/XiXiCare/main/update-manifest.json',
  'https://xixicare-cloud-sync.xixicare-facksxx.workers.dev/public/update-manifest.json'
];

const FETCH_TIMEOUT_MS = 12_000;

const describeUpdateError = (error: unknown) => {
  if (error instanceof DOMException && error.name === 'AbortError') return '检查更新超时，请确认网络连接后重试';
  if (error instanceof Error && /abort|timeout/i.test(error.message)) return '检查更新超时，请确认网络连接后重试';
  if (error instanceof TypeError || (error instanceof Error && /failed to fetch|network/i.test(error.message))) {
    return '无法连接更新服务器，请检查网络后重试';
  }
  return '更新服务器暂时不可用，请稍后重试';
};

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

const requestUpdateManifest = async (url: string): Promise<RemoteRelease> => {
  const separator = url.includes('?') ? '&' : '?';
  const requestUrl = `${url}${separator}t=${Date.now()}`;
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({
      url: requestUrl,
      headers: { Accept: 'application/json' },
      connectTimeout: FETCH_TIMEOUT_MS,
      readTimeout: FETCH_TIMEOUT_MS,
      responseType: 'json'
    });
    if (response.status < 200 || response.status >= 300) throw new Error(`HTTP ${response.status}`);
    return (typeof response.data === 'string' ? JSON.parse(response.data) : response.data) as RemoteRelease;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(requestUrl, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json() as RemoteRelease;
  } finally {
    window.clearTimeout(timeout);
  }
};

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

/**
 * 从仓库静态清单动态读取最新版本，避免 Gitee 匿名 API 的频率限制。
 * @throws 网络或解析异常时抛出 Error
 */
export const fetchLatestRelease = async (): Promise<RemoteRelease> => {
  let lastError: unknown;
  for (const url of UPDATE_MANIFEST_URLS) {
    try {
      const release = await requestUpdateManifest(url);
      if (!release.version || !release.tag || !release.apkUrl) throw new Error('更新清单内容不完整');
      const fullHistory = Array.isArray(release.history) ? release.history : [];
      return {
        ...release,
        htmlUrl: release.htmlUrl || RELEASES_PAGE_URL,
        history: fullHistory
          .filter(item => compareVersions(item.version, APP_VERSION) > 0 && compareVersions(item.version, release.version) <= 0)
          .sort((a, b) => compareVersions(a.version, b.version))
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(describeUpdateError(lastError));
};
