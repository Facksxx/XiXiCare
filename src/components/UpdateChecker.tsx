import { useState } from 'react';
import { AlertTriangle, Check, RefreshCw } from 'lucide-react';
import { APP_VERSION, fetchLatestRelease, isNewer, type RemoteRelease } from '../utils/version';
import { ConfirmModal } from './ConfirmModal';

type CheckState = 'idle' | 'checking';

const formatDate = (iso: string): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const openDownload = (url: string) => {
  // 在原生 Android 中，通过浏览器打开 APK 直链会触发系统下载并提示安装
  window.open(url, '_blank');
};

export function UpdateChecker() {
  const [checkState, setCheckState] = useState<CheckState>('idle');
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const [newRelease, setNewRelease] = useState<RemoteRelease | null>(null);
  const [errorModal, setErrorModal] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  const showToast = (message: string, error = false) => {
    setToast({ message, error });
    window.setTimeout(() => setToast(null), 2500);
  };

  const handleCheck = async () => {
    setCheckState('checking');
    try {
      const release = await fetchLatestRelease();
      if (!release.version) {
        throw new Error('未能解析远端版本号');
      }
      if (isNewer(release.version)) {
        setNewRelease(release);
      } else {
        showToast('已是最新版本', false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '检查更新失败，请稍后重试';
      setErrorModal({ show: true, message });
    } finally {
      setCheckState('idle');
    }
  };

  const handleDownload = () => {
    if (!newRelease) return;
    openDownload(newRelease.apkUrl);
  };

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

      <ConfirmModal
        isOpen={Boolean(newRelease)}
        title="发现新版本"
        message={
          newRelease
            ? `最新版本 v${newRelease.version} 已发布${formatDate(newRelease.publishedAt) ? `（${formatDate(newRelease.publishedAt)}）` : ''}。\n当前版本 v${APP_VERSION}。\n是否前往下载更新？`
            : ''
        }
        type="info"
        confirmText="下载更新"
        cancelText="以后再说"
        onConfirm={() => {
          handleDownload();
          setNewRelease(null);
        }}
        onCancel={() => setNewRelease(null)}
      />

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
