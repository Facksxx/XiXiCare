import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { FileTransfer } from '@capacitor/file-transfer';
import { AlertTriangle, Check, Download, Pause, RefreshCw } from 'lucide-react';
import { APP_VERSION, fetchLatestRelease, isNewer, type RemoteRelease } from '../utils/version';
import { AppUpdate } from '../plugins/appUpdate';
import { ConfirmModal } from './ConfirmModal';

type CheckState = 'idle' | 'checking';
type UpdatePhase = 'prompt' | 'downloading' | 'paused' | 'ready';

interface DownloadProgress {
  percent: number;
  bytes: number;
  total: number;
}

const formatDate = (iso: string): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const formatBytes = (bytes: number): string => {
  if (!bytes) return '0 MB';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const getErrorCode = (error: unknown): string => {
  if (typeof error !== 'object' || error === null || !('code' in error)) return '';
  return String(error.code);
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) return String(error.message);
  return fallback;
};

const clearUpdateCache = async () => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Filesystem.rmdir({ path: 'updates', directory: Directory.Cache, recursive: true });
  } catch {
    // A missing cache directory is already clean.
  }
};

const DOWNLOAD_STATE_KEY = 'xixicare_update_download';

interface CachedDownload {
  version: string;
  url: string;
  path: string;
}

const readCachedDownload = (): CachedDownload | null => {
  try {
    const value = localStorage.getItem(DOWNLOAD_STATE_KEY);
    return value ? JSON.parse(value) as CachedDownload : null;
  } catch {
    return null;
  }
};

const forgetCachedDownload = () => localStorage.removeItem(DOWNLOAD_STATE_KEY);

export function UpdateChecker() {
  const [checkState, setCheckState] = useState<CheckState>('idle');
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const [newRelease, setNewRelease] = useState<RemoteRelease | null>(null);
  const [updatePhase, setUpdatePhase] = useState<UpdatePhase>('prompt');
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({ percent: 0, bytes: 0, total: 0 });
  const [downloadedPath, setDownloadedPath] = useState('');
  const [installNotice, setInstallNotice] = useState('');
  const [errorModal, setErrorModal] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  useEffect(() => {
    const cached = readCachedDownload();
    if (cached && !isNewer(cached.version)) {
      forgetCachedDownload();
      void clearUpdateCache();
    }
  }, []);

  const showToast = (message: string, error = false) => {
    setToast({ message, error });
    window.setTimeout(() => setToast(null), 2500);
  };

  const resetUpdate = () => {
    setNewRelease(null);
    setUpdatePhase('prompt');
    setDownloadProgress({ percent: 0, bytes: 0, total: 0 });
    setDownloadedPath('');
    setInstallNotice('');
  };

  const discardUpdate = async () => {
    if (updatePhase === 'downloading' && Capacitor.isNativePlatform()) {
      await AppUpdate.pauseDownload();
    }
    await clearUpdateCache();
    forgetCachedDownload();
    resetUpdate();
  };

  const handleCheck = async () => {
    setCheckState('checking');
    try {
      const release = await fetchLatestRelease();
      if (!release.version) {
        throw new Error('未能解析远端版本号');
      }
      if (isNewer(release.version)) {
        resetUpdate();
        setNewRelease(release);
        const cached = readCachedDownload();
        if (cached?.version === release.version && cached.url === release.apkUrl) {
          setDownloadedPath(cached.path);
          setUpdatePhase('paused');
          if (Capacitor.isNativePlatform()) {
            try {
              const stat = await Filesystem.stat({ path: cached.path });
              setDownloadProgress({ percent: 0, bytes: stat.size, total: 0 });
            } catch {
              forgetCachedDownload();
              setDownloadedPath('');
              setUpdatePhase('prompt');
            }
          }
        }
      } else {
        showToast('已是最新版本', false);
      }
    } catch (error) {
      const message = getErrorMessage(error, '检查更新失败，请稍后重试');
      setErrorModal({ show: true, message });
    } finally {
      setCheckState('idle');
    }
  };

  const startInstallation = async (path: string) => {
    try {
      await AppUpdate.installApk({ path });
      resetUpdate();
    } catch (error) {
      setUpdatePhase('ready');
      if (getErrorCode(error) === 'INSTALL_PERMISSION_REQUIRED') {
        setInstallNotice('请在系统设置中允许安装应用，返回 XiXiCare 后点击“继续安装”。');
        return;
      }
      setInstallNotice('安装程序未能打开，可以点击“继续安装”重试。');
      setErrorModal({ show: true, message: getErrorMessage(error, '无法打开安装程序，请稍后重试') });
    }
  };

  const handleDownload = async () => {
    if (!newRelease || updatePhase === 'downloading') return;
    const isResuming = updatePhase === 'paused' && Boolean(downloadedPath);
    setUpdatePhase('downloading');
    setInstallNotice('');
    if (!isResuming) setDownloadProgress({ percent: 0, bytes: 0, total: 0 });

    let removeProgressListener: (() => Promise<void>) | null = null;
    let activePath = downloadedPath;
    const updateProgress = (bytes: number, contentLength: number, lengthComputable: boolean) => {
      const percent = lengthComputable && contentLength > 0
        ? Math.min(100, Math.round((bytes / contentLength) * 100))
        : 0;
      setDownloadProgress({ percent, bytes, total: contentLength });
    };

    try {
      if (!Capacitor.isNativePlatform()) {
        const listener = await FileTransfer.addListener('progress', (event) => {
          if (event.type === 'download' && event.url === newRelease.apkUrl) {
            updateProgress(event.bytes, event.contentLength, event.lengthComputable);
          }
        });
        removeProgressListener = () => listener.remove();
        await FileTransfer.downloadFile({
          url: newRelease.apkUrl,
          path: 'XiXiCare.apk',
          progress: true
        });
        resetUpdate();
        showToast('安装包已下载到本地');
        return;
      }

      if (!isResuming) {
        await clearUpdateCache();
        await Filesystem.mkdir({ path: 'updates', directory: Directory.Cache, recursive: true });
        const relativePath = `updates/XiXiCare-${newRelease.version}.apk`;
        const file = await Filesystem.getUri({ path: relativePath, directory: Directory.Cache });
        activePath = file.uri;
        setDownloadedPath(activePath);
        localStorage.setItem(DOWNLOAD_STATE_KEY, JSON.stringify({
          version: newRelease.version,
          url: newRelease.apkUrl,
          path: activePath
        } satisfies CachedDownload));
      }

      const listener = await AppUpdate.addListener('downloadProgress', (event) => {
        updateProgress(event.bytes, event.contentLength, event.lengthComputable);
      });
      removeProgressListener = () => listener.remove();
      const result = await AppUpdate.downloadApk({
        url: newRelease.apkUrl,
        path: activePath
      });
      if (result.paused) {
        setUpdatePhase('paused');
        return;
      }

      setDownloadedPath(result.path);
      setDownloadProgress((current) => ({ ...current, percent: 100 }));
      setUpdatePhase('ready');
      forgetCachedDownload();
      await startInstallation(result.path);
    } catch (error) {
      setUpdatePhase(activePath ? 'paused' : 'prompt');
      setErrorModal({ show: true, message: `${getErrorMessage(error, '下载暂时中断')}，已保留进度，请点击继续下载。` });
    } finally {
      await removeProgressListener?.();
    }
  };

  const handlePauseDownload = async () => {
    if (updatePhase !== 'downloading' || !Capacitor.isNativePlatform()) return;
    try {
      await AppUpdate.pauseDownload();
      setUpdatePhase('paused');
    } catch (error) {
      setErrorModal({ show: true, message: getErrorMessage(error, '暂停下载失败，请稍后重试') });
    }
  };

  const handleUpdateConfirm = () => {
    if (updatePhase === 'ready' && downloadedPath) {
      void startInstallation(downloadedPath);
      return;
    }
    void handleDownload();
  };

  const releaseDate = newRelease ? formatDate(newRelease.publishedAt) : '';
  const canDismissUpdate = updatePhase !== 'downloading';

  return (
    <>
      <div className="settings-about">
        <div className="settings-about-version">
          <span className="settings-about-label">当前版本</span>
          <span className="settings-about-value">v{APP_VERSION}</span>
        </div>
        <button
          type="button"
          className="settings-update-btn"
          onClick={handleCheck}
          disabled={checkState === 'checking'}
        >
          <RefreshCw size={16} className={checkState === 'checking' ? 'spin' : ''} />
          <span>{checkState === 'checking' ? '检查中…' : '检查更新'}</span>
        </button>
      </div>

      {newRelease && (
        <div className="modal-overlay" onClick={canDismissUpdate ? () => void discardUpdate() : undefined}>
          <div className="modal-content update-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header update-modal-header">
              <div className="update-modal-title">
                <Download size={19} />
                <h3>{updatePhase === 'downloading' ? '正在下载更新' : updatePhase === 'paused' ? '下载已暂停' : '发现新版本'}</h3>
              </div>
              {canDismissUpdate && (
                <button type="button" onClick={() => void discardUpdate()} className="modal-close-btn" aria-label="关闭">
                  ✕
                </button>
              )}
            </div>
            <div className="modal-body update-modal-body">
              {updatePhase === 'prompt' && (
                <p>
                  最新版本 v{newRelease.version} 已发布{releaseDate ? `（${releaseDate}）` : ''}。
                  <br />当前版本 v{APP_VERSION}，安装包将在应用内直接下载。
                </p>
              )}
              {(updatePhase === 'downloading' || updatePhase === 'paused') && (
                <div className="update-download-progress">
                  <div className="update-download-track" role="progressbar" aria-valuenow={downloadProgress.percent} aria-valuemin={0} aria-valuemax={100}>
                    <span style={{ width: `${downloadProgress.percent}%` }} />
                  </div>
                  <div className="update-download-meta">
                    <strong>{downloadProgress.percent > 0 ? `${downloadProgress.percent}%` : '正在连接…'}</strong>
                    <span>
                      {formatBytes(downloadProgress.bytes)}
                      {downloadProgress.total > 0 ? ` / ${formatBytes(downloadProgress.total)}` : ''}
                    </span>
                  </div>
                  {updatePhase === 'paused' && <p className="update-paused-hint">已保留下载进度，可以继续下载。</p>}
                </div>
              )}
              {updatePhase === 'ready' && (
                <p>{installNotice || '安装包已下载完成，点击下方按钮继续安装。'}</p>
              )}
            </div>
            <div className="modal-footer update-modal-footer">
              {canDismissUpdate && (
                <button type="button" className="btn-secondary" onClick={() => void discardUpdate()}>{updatePhase === 'paused' ? '取消更新' : '以后再说'}</button>
              )}
              <button
                type="button"
                className="btn-primary"
                onClick={updatePhase === 'downloading' ? () => void handlePauseDownload() : handleUpdateConfirm}
                disabled={updatePhase === 'downloading' && !Capacitor.isNativePlatform()}
              >
                {updatePhase === 'downloading' ? (
                  <><Pause size={16} /> 暂停下载</>
                ) : updatePhase === 'paused' ? (
                  <><Download size={16} /> 继续下载</>
                ) : updatePhase === 'ready' ? (
                  <><Check size={16} /> 继续安装</>
                ) : (
                  <><Download size={16} /> 下载并安装</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={errorModal.show}
        message={errorModal.message}
        type="warning"
        confirmText="确定"
        cancelText=""
        onConfirm={() => setErrorModal({ show: false, message: '' })}
        onCancel={() => setErrorModal({ show: false, message: '' })}
      />

      {toast && (
        <div className={`toast ${toast.error ? 'toast-error' : 'toast-success'}`}>
          {toast.error ? <AlertTriangle size={16} /> : <Check size={16} />}
          <span>{toast.message}</span>
        </div>
      )}
    </>
  );
}
