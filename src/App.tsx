import { useState, useEffect, useRef, type TouchEvent as ReactTouchEvent } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import type { ActivityLog, BabyInfo, TimeInferenceMode } from './types/baby';
import { compressImage } from './utils/imageCompress';
import { fixTimezoneIssues, hasTimezoneIssues } from './utils/timezoneFix';

import { Dashboard } from './components/Dashboard';
import { Guide } from './components/Guide';
import { Stats } from './components/Stats';
import { Records } from './components/Records';
import { Settings as SettingsPage } from './components/Settings';
import { WhiteNoisePlayer } from './components/WhiteNoisePlayer';
import { ConfirmModal } from './components/ConfirmModal';
import { DateTimePicker } from './components/DateTimePicker';
import { Sun, Moon, Calendar, BookOpen, BarChart2, Edit2, Check, Sparkles, Settings, Music2, ChevronDown, Plus } from 'lucide-react';
import type { Icon } from 'lucide-react';
import './index.css';

type AppTab = 'dashboard' | 'records' | 'guide' | 'stats';
type SwipePreview = { tab: AppTab; side: -1 | 1 };
const APP_TABS: AppTab[] = ['dashboard', 'records', 'guide', 'stats'];

function NavIcon({ icon: IconComponent, active }: { icon: Icon; active: boolean }) {
  return (
    <span className={`nav-icon ${active ? 'filled' : ''}`} aria-hidden="true">
      <IconComponent className="nav-icon-fill" />
      <IconComponent className="nav-icon-outline" />
    </span>
  );
}

const blocksPageSwipe = (target: EventTarget | null, boundary: HTMLElement) => {
  if (!(target instanceof Element)) return true;
  if (target.closest('input, textarea, select, button, a, [contenteditable="true"], [role="slider"]')) return true;

  let element: Element | null = target;
  while (element && element !== boundary) {
    const node = element as HTMLElement;
    const overflowX = window.getComputedStyle(node).overflowX;
    if (node.scrollWidth > node.clientWidth + 4 && (overflowX === 'auto' || overflowX === 'scroll')) return true;
    element = element.parentElement;
  }
  return false;
};

const readInitialBabies = (): BabyInfo[] => {
  try {
    const stored = JSON.parse(localStorage.getItem('babycare_babies') ?? '[]') as BabyInfo[];
    if (Array.isArray(stored) && stored.length > 0) return stored;
    const legacy = JSON.parse(localStorage.getItem('babycare_info') ?? '{}') as Partial<BabyInfo>;
    return legacy.name ? [{ id: 'baby-1', name: legacy.name, birthday: legacy.birthday ?? '', avatar: legacy.avatar }] : [];
  } catch {
    return [];
  }
};

const createBabyId = () => `baby-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export default function App() {
  // Navigation tabs: 'dashboard' | 'guide' | 'stats' | 'records'
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [swipePreview, setSwipePreview] = useState<SwipePreview | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showWhiteNoise, setShowWhiteNoise] = useState(false);
  const [showBabySwitcher, setShowBabySwitcher] = useState(false);
  const [isWhiteNoisePlaying, setIsWhiteNoisePlaying] = useState(false);

  // Theme: 'light' | 'dark'
  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('babycare_theme', 'light');
  const [timeInferenceMode, setTimeInferenceMode] = useLocalStorage<TimeInferenceMode>('babycare_time_inference_mode', 'end');

  // Logs state: empty by default
  const [logs, setLogs] = useLocalStorage<ActivityLog[]>('babycare_logs', []);

  // 时区数据迁移：检测并修复历史数据中的时区问题
  useEffect(() => {
    if (logs.length > 0 && hasTimezoneIssues(logs)) {
      const fixed = fixTimezoneIssues(logs);
      if (fixed !== logs) {
        setLogs(fixed);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External editing log (triggered from Records tab)
  const [externalEditingLog, setExternalEditingLog] = useState<ActivityLog | null>(null);

  const [babies, setBabies] = useLocalStorage<BabyInfo[]>('babycare_babies', readInitialBabies());
  const [activeBabyId, setActiveBabyId] = useLocalStorage<string>('babycare_active_baby_id', babies[0]?.id ?? '');
  const baby = babies.find((item) => item.id === activeBabyId) ?? babies[0] ?? { id: '', name: '', birthday: '' };
  const activeLogs = logs.filter((log) => log.babyId === baby.id);
  const isFirstSetup = babies.length === 0;

  // Edit baby info modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBabyId, setEditingBabyId] = useState<string | null>(null);
  const [editName, setEditName] = useState(baby.name);
  const [editBirthday, setEditBirthday] = useState(baby.birthday);
  const [editAvatar, setEditAvatar] = useState<string | undefined>(baby.avatar);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentPageRef = useRef<HTMLDivElement>(null);
  const previewPageRef = useRef<HTMLDivElement>(null);
  const swipePreviewRef = useRef<SwipePreview | null>(null);
  const swipeTimerRef = useRef<number | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number; time: number; blocked: boolean; horizontal: boolean } | null>(null);
  const legacyBabyInfo = JSON.stringify(baby);

  const clearSwipeStyles = () => {
    [currentPageRef.current, previewPageRef.current].forEach(element => element?.removeAttribute('style'));
  };

  const completeNavigation = (nextTab: AppTab) => {
    setActiveTab(nextTab);
    setSwipePreview(null);
    swipePreviewRef.current = null;
    clearSwipeStyles();
    setShowSettings(false);
  };

  const animateToTab = (nextTab: AppTab, fromDrag = false) => {
    if (nextTab === activeTab) {
      setShowSettings(false);
      return;
    }
    if (swipeTimerRef.current !== null) return;
    const side: -1 | 1 = APP_TABS.indexOf(nextTab) > APP_TABS.indexOf(activeTab) ? 1 : -1;
    const preview = { tab: nextTab, side };
    swipePreviewRef.current = preview;
    setSwipePreview(preview);

    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const current = currentPageRef.current;
      const incoming = previewPageRef.current;
      if (!current || !incoming) return completeNavigation(nextTab);
      const duration = fromDrag ? 170 : 190;
      current.style.transition = `transform ${duration}ms cubic-bezier(0.22, 0.72, 0.24, 1)`;
      incoming.style.transition = current.style.transition;
      if (!fromDrag) {
        current.style.transform = 'translate3d(0,0,0)';
        incoming.style.transform = `translate3d(${side * 100}%,0,0)`;
        current.getBoundingClientRect();
      }
      current.style.transform = `translate3d(${-side * 100}%,0,0)`;
      incoming.style.transform = 'translate3d(0,0,0)';
      swipeTimerRef.current = window.setTimeout(() => {
        swipeTimerRef.current = null;
        completeNavigation(nextTab);
      }, duration);
    }));
  };

  const resetSwipe = () => {
    const preview = swipePreviewRef.current;
    const current = currentPageRef.current;
    const incoming = previewPageRef.current;
    if (!preview || !current || !incoming) return;
    current.style.transition = 'transform 150ms ease-out';
    incoming.style.transition = current.style.transition;
    current.style.transform = 'translate3d(0,0,0)';
    incoming.style.transform = `translate3d(${preview.side * 100}%,0,0)`;
    window.setTimeout(() => {
      setSwipePreview(null);
      swipePreviewRef.current = null;
      clearSwipeStyles();
    }, 155);
  };

  const handlePageTouchStart = (event: ReactTouchEvent<HTMLElement>) => {
    if (showSettings || event.touches.length !== 1) return;
    if (swipeTimerRef.current !== null) return;
    const touch = event.touches[0];
    swipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: performance.now(),
      blocked: blocksPageSwipe(event.target, event.currentTarget),
      horizontal: false
    };
  };

  const handlePageTouchMove = (event: ReactTouchEvent<HTMLElement>) => {
    const start = swipeStartRef.current;
    if (!start || start.blocked || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (!start.horizontal) {
      if (Math.abs(deltaY) > 10 && Math.abs(deltaY) > Math.abs(deltaX)) {
        start.blocked = true;
        return;
      }
      if (Math.abs(deltaX) < 8 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
      start.horizontal = true;
    }
    const currentIndex = APP_TABS.indexOf(activeTab);
    const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0 || nextIndex >= APP_TABS.length) return;
    const side: -1 | 1 = deltaX < 0 ? 1 : -1;
    const preview = swipePreviewRef.current;
    if (!preview || preview.tab !== APP_TABS[nextIndex]) {
      const nextPreview = { tab: APP_TABS[nextIndex], side };
      swipePreviewRef.current = nextPreview;
      setSwipePreview(nextPreview);
    }
    const applyOffset = () => {
      const current = currentPageRef.current;
      const incoming = previewPageRef.current;
      if (!current || !incoming) return;
      const width = Math.max(current.offsetWidth, 1);
      const offset = Math.max(-width, Math.min(width, deltaX));
      current.style.transition = 'none';
      incoming.style.transition = 'none';
      current.style.transform = `translate3d(${offset}px,0,0)`;
      incoming.style.transform = `translate3d(${side * width + offset}px,0,0)`;
    };
    window.requestAnimationFrame(applyOffset);
  };

  const handlePageTouchEnd = (event: ReactTouchEvent<HTMLElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || start.blocked || !start.horizontal || event.changedTouches.length === 0) return;

    const deltaX = event.changedTouches[0].clientX - start.x;
    const elapsed = Math.max(1, performance.now() - start.time);
    const velocity = Math.abs(deltaX) / elapsed;
    const currentIndex = APP_TABS.indexOf(activeTab);
    const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
    const shouldSwitch = nextIndex >= 0
      && nextIndex < APP_TABS.length
      && (Math.abs(deltaX) >= 46 || (Math.abs(deltaX) >= 24 && velocity >= 0.38));

    if (shouldSwitch && swipePreviewRef.current?.tab === APP_TABS[nextIndex]) {
      animateToTab(APP_TABS[nextIndex], true);
    } else {
      resetSwipe();
    }
  };

  useEffect(() => () => {
    if (swipeTimerRef.current !== null) window.clearTimeout(swipeTimerRef.current);
  }, []);

  useEffect(() => {
    if (isFirstSetup) {
      setEditingBabyId(null);
      setEditName('');
      setEditBirthday('');
      setEditAvatar(undefined);
      setShowEditModal(true);
    }
  }, [isFirstSetup]);

  useEffect(() => {
    if (!baby.id) return;
    if (activeBabyId !== baby.id) setActiveBabyId(baby.id);
    if (!localStorage.getItem('babycare_babies')) setBabies((current) => current);
    if (localStorage.getItem('babycare_multi_baby_migrated') === '1') return;
    setLogs((current) => current.map((log) => ({ ...log, babyId: baby.id })));
    const legacyVaccines = localStorage.getItem('babycare_vaccines');
    const legacyAllergens = localStorage.getItem('babycare_allergens');
    if (legacyVaccines && !localStorage.getItem(`babycare_vaccines_${baby.id}`)) localStorage.setItem(`babycare_vaccines_${baby.id}`, legacyVaccines);
    if (legacyAllergens && !localStorage.getItem(`babycare_allergens_${baby.id}`)) localStorage.setItem(`babycare_allergens_${baby.id}`, legacyAllergens);
    ['weight', 'height', 'temp'].forEach((type) => {
      const legacy = localStorage.getItem(`babycare_growth_${type}`);
      if (legacy && !localStorage.getItem(`babycare_growth_${type}_${baby.id}`)) localStorage.setItem(`babycare_growth_${type}_${baby.id}`, legacy);
    });
    localStorage.setItem('babycare_multi_baby_migrated', '1');
    // Migration must run once for the first active baby; later switching must never remap records.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baby.id]);

  useEffect(() => {
    if (baby.id) localStorage.setItem('babycare_info', legacyBabyInfo);
  }, [baby.id, legacyBabyInfo]);

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState<{ show: boolean; message: string; onConfirm: () => void }>({ show: false, message: '', onConfirm: () => {} });
  const [alertModal, setAlertModal] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  // Add a log
  const handleAddLog = (newLog: ActivityLog) => {
    setLogs(current => [newLog, ...current]);
  };

  // Delete a log
  const handleDeleteLog = (id: string) => {
    setLogs(current => current.filter(log => log.id !== id));
  };

  // Update a log
  const handleUpdateLog = (updatedLog: ActivityLog) => {
    setLogs(current => current.map(log => log.id === updatedLog.id ? updatedLog : log));
  };

  // Navigate to dashboard with a log to edit (from Records tab)
  const handleEditLogFromRecords = (log: ActivityLog) => {
    setExternalEditingLog(log);
    setActiveTab('dashboard');
  };

  // Dashboard finishes editing, clears external edit
  const handleEditingDone = () => {
    setExternalEditingLog(null);
  };

  // Import logs (merge, by ID: update existing, add new)
  const handleImportLogs = (imported: ActivityLog[]) => {
    const existingMap = new Map(logs.map(l => [l.id, l]));
    imported.forEach(l => {
      if (existingMap.has(l.id)) {
        existingMap.set(l.id, l);
      } else {
        existingMap.set(l.id, l);
      }
    });
    const merged = Array.from(existingMap.values()).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    setLogs(merged);
  };

  const handleImportBabies = (imported: BabyInfo[]) => {
    if (imported.length === 0) return;
    setBabies((current) => {
      const merged = new Map(current.map((item) => [item.id, item]));
      imported.forEach((item) => merged.set(item.id, { ...merged.get(item.id), ...item }));
      return Array.from(merged.values());
    });
    if (!activeBabyId) setActiveBabyId(imported[0].id);
  };

  const handleEditBaby = (babyId = baby.id) => {
    const target = babies.find((item) => item.id === babyId);
    if (!target) return;
    setEditingBabyId(target.id);
    setEditName(target.name);
    setEditBirthday(target.birthday);
    setEditAvatar(target.avatar);
    setShowEditModal(true);
  };

  const handleAddBaby = () => {
    setEditingBabyId(null);
    setEditName('');
    setEditBirthday('');
    setEditAvatar(undefined);
    setShowBabySwitcher(false);
    setShowEditModal(true);
  };

  const handleSwitchBaby = (babyId: string) => {
    setActiveBabyId(babyId);
    setExternalEditingLog(null);
    setShowBabySwitcher(false);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const compressedImage = await compressImage(file, {
        maxSizeMB: 1,
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.85,
        cropToSquare: true
      });
      setEditAvatar(compressedImage);
    } catch (error) {
      console.error('图片压缩失败:', error);
    }
    
    e.target.value = '';
  };

  const handleRemoveAvatar = () => {
    setConfirmModal({
      show: true,
      message: '确认移除头像？',
      onConfirm: () => {
        setEditAvatar(undefined);
        setConfirmModal({ show: false, message: '', onConfirm: () => {} });
      }
    });
  };

  const handleSaveBabyInfo = () => {
    if (!editName.trim()) {
      setAlertModal({ show: true, message: '请输入宝宝名字' });
      return;
    }
    if (isNaN(Date.parse(editBirthday))) {
      setAlertModal({ show: true, message: '输入的日期格式有误，请使用 YYYY-MM-DD' });
      return;
    }
    if (editingBabyId) {
      setBabies((current) => current.map((item) => item.id === editingBabyId ? {
        ...item,
        name: editName.trim(),
        birthday: editBirthday,
        avatar: editAvatar
      } : item));
    } else {
      const newBaby: BabyInfo = {
        id: createBabyId(),
        name: editName.trim(),
        birthday: editBirthday,
        avatar: editAvatar
      };
      setBabies((current) => [...current, newBaby]);
      setActiveBabyId(newBaby.id);
    }
    setShowEditModal(false);
  };

  const handleDeleteBaby = (babyId: string) => {
    const target = babies.find((item) => item.id === babyId);
    if (!target || babies.length <= 1) return;
    setConfirmModal({
      show: true,
      message: `删除“${target.name}”及其全部记录、疫苗和过敏排查数据？此操作不可恢复。`,
      onConfirm: () => {
        const remaining = babies.filter((item) => item.id !== babyId);
        setBabies(remaining);
        setLogs((current) => current.filter((log) => log.babyId !== babyId));
        localStorage.removeItem(`babycare_vaccines_${babyId}`);
        localStorage.removeItem(`babycare_allergens_${babyId}`);
        ['weight', 'height', 'temp'].forEach((type) => localStorage.removeItem(`babycare_growth_${type}_${babyId}`));
        if (activeBabyId === babyId) setActiveBabyId(remaining[0].id);
        setConfirmModal({ show: false, message: '', onConfirm: () => {} });
      }
    });
  };

  // Calculate age string dynamically
  const calculateAgeStr = (birthdayStr: string) => {
    const bday = new Date(birthdayStr);
    const now = new Date();
    
    // Reset hours to avoid minor time offset discrepancies
    bday.setHours(0,0,0,0);
    now.setHours(0,0,0,0);
    
    if (now < bday) return '未出生';

    let years = now.getFullYear() - bday.getFullYear();
    let months = now.getMonth() - bday.getMonth();
    let days = now.getDate() - bday.getDate();

    if (days < 0) {
      months -= 1;
      // Get number of days in the previous month
      const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      days += prevMonth.getDate();
    }
    
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    const parts = [];
    if (years > 0) parts.push(`${years}岁`);
    if (months > 0) parts.push(`${months}个月`);
    if (days > 0 || parts.length === 0) parts.push(`${days}天`);
    
    return parts.join('');
  };

  const renderTab = (tab: AppTab) => {
    if (tab === 'dashboard') {
      return (
        <Dashboard
          key={`dashboard-${baby.id}`}
          babyId={baby.id}
          onAddLog={handleAddLog}
          onUpdateLog={handleUpdateLog}
          editingLog={externalEditingLog}
          onEditingDone={handleEditingDone}
          timeInferenceMode={timeInferenceMode}
        />
      );
    }
    if (tab === 'guide') return <Guide key={`guide-${baby.id}`} babyId={baby.id} />;
    if (tab === 'stats') return <Stats logs={activeLogs} birthday={baby.birthday} />;
    return <Records logs={activeLogs} onEditLog={handleEditLogFromRecords} onDeleteLog={handleDeleteLog} />;
  };

  return (
    <div className="app-shell">
      {/* Header Bar */}
      <header className="header">
        <div className="baby-info">
          <div 
            className="avatar-ring"
            onClick={() => { if (!isFirstSetup) handleEditBaby(); }}
            style={{ cursor: isFirstSetup ? 'default' : 'pointer', overflow: 'hidden' }}
            title={isFirstSetup ? '' : '编辑当前宝宝'}
          >
            {baby.avatar ? (
              <img 
                src={baby.avatar} 
                alt="宝宝头像" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              (baby.name || '宝').substring(0, 1).toUpperCase()
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarChange}
          />
          <div className="baby-meta">
            <div className="baby-name-row">
              <button type="button" className="baby-switch-button" disabled={isFirstSetup} onClick={() => setShowBabySwitcher(true)} aria-label="切换宝宝">
                <span>{baby.name || '未设置'}</span>{!isFirstSetup && <ChevronDown size={15} />}
              </button>
              {!isFirstSetup && <button type="button" className="baby-edit-button" onClick={() => handleEditBaby()} aria-label="编辑当前宝宝"><Edit2 size={13} /></button>}
            </div>
            <p>{baby.birthday || '--'} {baby.birthday && `(${calculateAgeStr(baby.birthday)})`}</p>
          </div>
        </div>

        <div className="header-actions">
          <button
            onClick={() => { setShowSettings((current) => !current); setShowWhiteNoise(false); }}
            className={`header-icon-btn ${showSettings ? 'active' : ''}`}
            aria-label={showSettings ? '返回记录页面' : '打开设置'}
            title={showSettings ? '返回记录页面' : '设置'}
          >
            <Settings size={20} />
          </button>
          <button
            onClick={() => setShowWhiteNoise((current) => !current)}
            className={`header-icon-btn noise-header-button ${showWhiteNoise || isWhiteNoisePlaying ? 'active' : ''} ${isWhiteNoisePlaying ? 'playing' : ''}`}
            aria-label={showWhiteNoise ? '关闭睡眠声音播放器' : '打开睡眠声音播放器'}
            title="睡眠声音"
          >
            <Music2 size={20} />
            {isWhiteNoisePlaying && <span className="noise-playing-dot" aria-hidden="true" />}
          </button>
          <button 
            onClick={toggleTheme} 
            className="header-icon-btn"
            aria-label="切换夜间模式"
            title={theme === 'light' ? '切换为深夜模式' : '切换为日间模式'}
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} style={{ color: 'var(--amber)' }} />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main
        className="app-main"
        onTouchStart={handlePageTouchStart}
        onTouchMove={handlePageTouchMove}
        onTouchEnd={handlePageTouchEnd}
        onTouchCancel={() => { swipeStartRef.current = null; resetSwipe(); }}
      >
        <div className="page-swipe-stage">
          {showSettings ? (
          <div className="page-swipe-view" ref={currentPageRef}><SettingsPage
            timeInferenceMode={timeInferenceMode}
            onTimeInferenceModeChange={setTimeInferenceMode}
            logs={logs}
            onImportLogs={handleImportLogs}
            onImportBabies={handleImportBabies}
            babies={babies}
            activeBabyId={baby.id}
            onAddBaby={handleAddBaby}
            onSwitchBaby={handleSwitchBaby}
            onEditBaby={handleEditBaby}
            onDeleteBaby={handleDeleteBaby}
          /></div>
          ) : (
            <>
              <div className="page-swipe-view" ref={currentPageRef}>{renderTab(activeTab)}</div>
              {swipePreview && (
                <div
                  className="page-swipe-view page-swipe-preview"
                  ref={previewPageRef}
                  style={{ transform: `translate3d(${swipePreview.side * 100}%,0,0)` }}
                  aria-hidden="true"
                >
                  {renderTab(swipePreview.tab)}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Bottom Floating Navigation Tabs */}
      <nav className="nav-tabs">
        <button 
          type="button"
          onClick={() => animateToTab('dashboard')}
          className={`nav-tab-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          aria-current={activeTab === 'dashboard' ? 'page' : undefined}
        >
          <NavIcon icon={Calendar} active={activeTab === 'dashboard'} />
          <span>记录大盘</span>
        </button>
        <button 
          type="button"
          onClick={() => animateToTab('records')}
          className={`nav-tab-item ${activeTab === 'records' ? 'active' : ''}`}
          aria-current={activeTab === 'records' ? 'page' : undefined}
        >
          <NavIcon icon={Sparkles} active={activeTab === 'records'} />
          <span>时间轴</span>
        </button>
        <button 
          type="button"
          onClick={() => animateToTab('guide')}
          className={`nav-tab-item ${activeTab === 'guide' ? 'active' : ''}`}
          aria-current={activeTab === 'guide' ? 'page' : undefined}
        >
          <NavIcon icon={BookOpen} active={activeTab === 'guide'} />
          <span>喂养指南</span>
        </button>
        <button 
          type="button"
          onClick={() => animateToTab('stats')}
          className={`nav-tab-item ${activeTab === 'stats' ? 'active' : ''}`}
          aria-current={activeTab === 'stats' ? 'page' : undefined}
        >
          <NavIcon icon={BarChart2} active={activeTab === 'stats'} />
          <span>成长统计</span>
        </button>
      </nav>

      <WhiteNoisePlayer
        isOpen={showWhiteNoise}
        onClose={() => setShowWhiteNoise(false)}
        onPlaybackChange={setIsWhiteNoisePlaying}
      />

      {showBabySwitcher && (
        <div className="modal-overlay baby-switcher-overlay" onClick={() => setShowBabySwitcher(false)}>
          <section className="baby-switcher" role="dialog" aria-modal="true" aria-labelledby="baby-switcher-title" onClick={(event) => event.stopPropagation()}>
            <div className="baby-switcher-header">
              <h3 id="baby-switcher-title">选择宝宝</h3>
              <button type="button" className="modal-close-btn" onClick={() => setShowBabySwitcher(false)} aria-label="关闭">×</button>
            </div>
            <div className="baby-switcher-list">
              {babies.map((item) => (
                <button type="button" key={item.id} className={`baby-switcher-item ${item.id === baby.id ? 'active' : ''}`} onClick={() => handleSwitchBaby(item.id)}>
                  <span className="baby-switcher-avatar">{item.avatar ? <img src={item.avatar} alt="" /> : item.name.slice(0, 1)}</span>
                  <span className="baby-switcher-copy"><strong>{item.name}</strong><small>{item.birthday} · {calculateAgeStr(item.birthday)}</small></span>
                  {item.id === baby.id && <Check size={18} />}
                </button>
              ))}
            </div>
            <button type="button" className="baby-add-button" onClick={handleAddBaby}><Plus size={17} />添加宝宝</button>
          </section>
        </div>
      )}

      {showEditModal && (
        <div 
          className="modal-overlay"
          onClick={() => { if (!isFirstSetup) setShowEditModal(false); }}
        >
          <div 
            className="modal-content baby-edit-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{editingBabyId ? '编辑宝宝信息' : '添加宝宝信息'}</h3>
              {!isFirstSetup && (
                <button 
                  onClick={() => setShowEditModal(false)}
                  className="modal-close-btn"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div 
                  className="avatar-ring"
                  style={{ 
                    width: '60px',
                    height: '60px',
                    fontSize: '24px',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    border: '3px solid var(--border-focus)'
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  title="点击更换头像"
                >
                  {editAvatar ? (
                    <img 
                      src={editAvatar}
                      alt="宝宝头像" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    (editName || '宝').substring(0, 1).toUpperCase()
                  )}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ flex: 'none', padding: '8px 16px', fontSize: '13px', minHeight: '36px', width: 'auto' }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    上传头像
                  </button>
                  {editAvatar && (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ flex: 'none', padding: '8px 16px', fontSize: '13px', minHeight: '36px', width: 'auto', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                      onClick={handleRemoveAvatar}
                    >
                      移除
                    </button>
                  )}
                </div>
              </div>
              <label className="form-label">宝宝名字</label>
              <input 
                type="text" 
                className="input-field" 
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="请输入宝宝名字"
              />
              <label className="form-label">出生日期</label>
              <DateTimePicker
                mode="date"
                label="出生日期"
                placeholder="选择出生日期"
                className="baby-birthday-picker"
                value={editBirthday}
                onChange={setEditBirthday}
              />
            </div>
            <div className="modal-footer">
              {!isFirstSetup && (
                <button 
                  className="btn-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  取消
                </button>
              )}
              <button 
                className="btn-primary"
                onClick={handleSaveBabyInfo}
                style={isFirstSetup ? { width: '100%' } : {}}
              >
                <Check size={16} /> {isFirstSetup ? '开始使用' : editingBabyId ? '保存' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={alertModal.show}
        message={alertModal.message}
        type="info"
        confirmText="确定"
        cancelText=""
        onConfirm={() => setAlertModal({ show: false, message: '' })}
        onCancel={() => setAlertModal({ show: false, message: '' })}
      />

      <ConfirmModal
        isOpen={confirmModal.show}
        message={confirmModal.message}
        type="warning"
        confirmText="确认"
        cancelText="取消"
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ show: false, message: '', onConfirm: () => {} })}
      />
    </div>
  );
}
