import { useState, useEffect, useRef } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import type { ActivityLog, TimeInferenceMode } from './types/baby';
import { compressImage } from './utils/imageCompress';
import { fixTimezoneIssues, hasTimezoneIssues } from './utils/timezoneFix';

import { Dashboard } from './components/Dashboard';
import { Guide } from './components/Guide';
import { Stats } from './components/Stats';
import { Records } from './components/Records';
import { Settings as SettingsPage } from './components/Settings';
import { WhiteNoisePlayer } from './components/WhiteNoisePlayer';
import { ConfirmModal } from './components/ConfirmModal';
import { Sun, Moon, Calendar, BookOpen, BarChart2, Edit2, Check, Sparkles, Settings, Music2 } from 'lucide-react';
import './index.css';

interface BabyInfo {
  name: string;
  birthday: string;
  avatar?: string;
}

export default function App() {
  // Navigation tabs: 'dashboard' | 'guide' | 'stats' | 'records'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'guide' | 'stats' | 'records'>('dashboard');
  const [showSettings, setShowSettings] = useState(false);
  const [showWhiteNoise, setShowWhiteNoise] = useState(false);
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

  // Baby details state
  const [baby, setBaby] = useLocalStorage<BabyInfo>('babycare_info', {
    name: '',
    birthday: ''
  });

  const isFirstSetup = !baby.name;

  // Edit baby info modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState(baby.name);
  const [editBirthday, setEditBirthday] = useState(baby.birthday);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isFirstSetup) {
      setEditName('');
      setEditBirthday('');
      setShowEditModal(true);
    }
  }, [isFirstSetup]);

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
    setLogs([newLog, ...logs]);
  };

  // Delete a log
  const handleDeleteLog = (id: string) => {
    setLogs(logs.filter(log => log.id !== id));
  };

  // Update a log
  const handleUpdateLog = (updatedLog: ActivityLog) => {
    setLogs(logs.map(log => log.id === updatedLog.id ? updatedLog : log));
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
    let updated = 0;
    let added = 0;
    imported.forEach(l => {
      if (existingMap.has(l.id)) {
        existingMap.set(l.id, l);
        updated++;
      } else {
        existingMap.set(l.id, l);
        added++;
      }
    });
    const merged = Array.from(existingMap.values()).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    setLogs(merged);
  };

  const handleEditBaby = () => {
    setEditName(baby.name);
    setEditBirthday(baby.birthday);
    setShowEditModal(true);
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
      setBaby({ ...baby, avatar: compressedImage });
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
        setBaby({ ...baby, avatar: undefined });
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
    setBaby({
      ...baby,
      name: editName.trim(),
      birthday: editBirthday
    });
    setShowEditModal(false);
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

  return (
    <div className="app-shell">
      {/* Header Bar */}
      <header className="header">
        <div className="baby-info">
          <div 
            className="avatar-ring"
            onClick={() => { if (!isFirstSetup) fileInputRef.current?.click(); }}
            style={{ cursor: isFirstSetup ? 'default' : 'pointer', overflow: 'hidden' }}
            title={isFirstSetup ? '' : '点击更换头像'}
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
            <h2 
              onClick={isFirstSetup ? undefined : handleEditBaby} 
              style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: isFirstSetup ? 'default' : 'pointer' }}
              title={isFirstSetup ? '' : '点击修改宝宝信息'}
            >
              {baby.name || '未设置'} {!isFirstSetup && <Edit2 size={12} className="text-[var(--text-muted)]" />}
            </h2>
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
      <main style={{ flex: 1 }}>
        {showSettings ? (
          <SettingsPage
            timeInferenceMode={timeInferenceMode}
            onTimeInferenceModeChange={setTimeInferenceMode}
            logs={logs}
            onImportLogs={handleImportLogs}
          />
        ) : activeTab === 'dashboard' ? (
          <Dashboard 
            onAddLog={handleAddLog} 
            onUpdateLog={handleUpdateLog}
            editingLog={externalEditingLog}
            onEditingDone={handleEditingDone}
            timeInferenceMode={timeInferenceMode}
          />
        ) : activeTab === 'guide' ? (
          <Guide />
        ) : activeTab === 'stats' ? (
          <Stats logs={logs} />
        ) : (
          <Records
            logs={logs}
            onEditLog={handleEditLogFromRecords}
            onDeleteLog={handleDeleteLog}
          />
        )}
      </main>

      {/* Bottom Floating Navigation Tabs */}
      <nav className="nav-tabs">
        <button 
          onClick={() => { setActiveTab('dashboard'); setShowSettings(false); }} 
          className={`nav-tab-item ${activeTab === 'dashboard' ? 'active' : ''}`}
        >
          <Calendar />
          <span>记录大盘</span>
        </button>
        <button 
          onClick={() => { setActiveTab('records'); setShowSettings(false); }} 
          className={`nav-tab-item ${activeTab === 'records' ? 'active' : ''}`}
        >
          <Sparkles />
          <span>时间轴</span>
        </button>
        <button 
          onClick={() => { setActiveTab('guide'); setShowSettings(false); }} 
          className={`nav-tab-item ${activeTab === 'guide' ? 'active' : ''}`}
        >
          <BookOpen />
          <span>喂养指南</span>
        </button>
        <button 
          onClick={() => { setActiveTab('stats'); setShowSettings(false); }} 
          className={`nav-tab-item ${activeTab === 'stats' ? 'active' : ''}`}
        >
          <BarChart2 />
          <span>成长统计</span>
        </button>
      </nav>

      <WhiteNoisePlayer
        isOpen={showWhiteNoise}
        onClose={() => setShowWhiteNoise(false)}
        onPlaybackChange={setIsWhiteNoisePlaying}
      />

      {showEditModal && (
        <div 
          className="modal-overlay"
          onClick={() => { if (!isFirstSetup) setShowEditModal(false); }}
        >
          <div 
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{isFirstSetup ? '添加宝宝信息' : '编辑宝宝信息'}</h3>
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
                    width: '72px', 
                    height: '72px', 
                    fontSize: '28px',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    border: '3px solid var(--border-focus)'
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  title="点击更换头像"
                >
                  {baby.avatar ? (
                    <img 
                      src={baby.avatar} 
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
                  {baby.avatar && (
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
                autoFocus
              />
              <label className="form-label">出生日期</label>
              <input 
                type="date" 
                className="input-field" 
                value={editBirthday}
                onChange={(e) => setEditBirthday(e.target.value)}
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
                <Check size={16} /> {isFirstSetup ? '开始使用' : '保存'}
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
