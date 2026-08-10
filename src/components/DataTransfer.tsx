import { useRef, useState } from 'react';
import { AlertTriangle, Check, Download, Upload } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import type { ActivityLog, BabyInfo } from '../types/baby';
import { guideData } from '../data/guideData';
import { createXlsxWorkbook, parseXlsxWorkbook } from '../utils/xlsx';
import { ConfirmModal } from './ConfirmModal';

interface DataTransferProps {
  logs: ActivityLog[];
  onImportLogs: (logs: ActivityLog[]) => void;
  babies: BabyInfo[];
  activeBabyId: string;
  onImportBabies: (babies: BabyInfo[]) => void;
}

const LOG_TYPE_LABEL: Record<string, string> = {
  feeding: '喂养',
  sleep: '睡眠',
  diaper: '尿布',
  growth: '体征'
};

const createBabyId = () => `baby-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const TABLE_HEADERS = [
  { key: 'id', label: '记录ID' },
  { key: 'babyId', label: '宝宝ID' },
  { key: 'timestamp', label: '时间' },
  { key: 'logType', label: '类型' },
  { key: 'subType', label: '子类型' },
  { key: 'leftMinutes', label: '左侧(分钟)' },
  { key: 'rightMinutes', label: '右侧(分钟)' },
  { key: 'volumeMl', label: '奶量(ml)' },
  { key: 'fluidType', label: '奶液类型' },
  { key: 'foodName', label: '辅食名称' },
  { key: 'foodAmount', label: '辅食量' },
  { key: 'reaction', label: '过敏反应' },
  { key: 'sleepStartTime', label: '睡眠开始时间' },
  { key: 'sleepEndTime', label: '睡眠结束时间' },
  { key: 'durationMinutes', label: '时长(分钟)' },
  { key: 'pee', label: '嘘嘘' },
  { key: 'poop', label: '便便' },
  { key: 'poopColor', label: '便便颜色' },
  { key: 'poopConsistency', label: '便便性状' },
  { key: 'weightKg', label: '体重(kg)' },
  { key: 'heightCm', label: '身高(cm)' },
  { key: 'headCircumferenceCm', label: '头围(cm)' },
  { key: 'temperatureC', label: '体温(°C)' },
  { key: 'rawMetadata', label: '完整条件数据(JSON)' }
];

const readStoredObject = <T extends Record<string, unknown>>(key: string): T => {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}') as T;
  } catch {
    return {} as T;
  }
};

const readStoredValue = <T,>(key: string, fallback: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
};

const logToRow = (log: ActivityLog) => {
  const meta = log.metadata;
  return {
    id: log.id,
    babyId: log.babyId,
    timestamp: log.timestamp,
    logType: LOG_TYPE_LABEL[log.logType] || log.logType,
    subType: meta.feedingType || '',
    leftMinutes: meta.breast?.leftMinutes ?? '',
    rightMinutes: meta.breast?.rightMinutes ?? '',
    volumeMl: meta.bottle?.volumeMl ?? '',
    fluidType: meta.bottle?.fluidType === 'formula' ? '配方奶' : meta.bottle?.fluidType === 'breastmilk' ? '吸出母乳' : '',
    foodName: meta.solids?.foodName ?? '',
    foodAmount: meta.solids?.amount ?? '',
    reaction: meta.solids?.reaction === 'severe' ? '严重过敏' : meta.solids?.reaction === 'mild' ? '轻度过敏' : meta.solids?.reaction === 'none' ? '无过敏' : '',
    sleepStartTime: meta.startTime ?? '',
    sleepEndTime: meta.endTime ?? '',
    durationMinutes: meta.durationMinutes ?? '',
    pee: meta.pee ? '是' : '否',
    poop: meta.poop ? '是' : '否',
    poopColor: meta.poopColor === 'yellow' ? '黄色' : meta.poopColor === 'green' ? '绿色' : meta.poopColor === 'brown' ? '褐色' : meta.poopColor || '',
    poopConsistency: meta.poopConsistency === 'watery' ? '稀便' : meta.poopConsistency === 'normal' ? '正常' : meta.poopConsistency === 'hard' ? '硬便' : '',
    weightKg: meta.weightKg ?? '',
    heightCm: meta.heightCm ?? '',
    headCircumferenceCm: meta.headCircumferenceCm ?? '',
    temperatureC: meta.temperatureC ?? '',
    rawMetadata: JSON.stringify(meta)
  };
};

const buildCompleteWorkbook = (logs: ActivityLog[], babies: BabyInfo[], now: Date) => {
  const rows = [...logs].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map(log => {
    const source = logToRow(log);
    const row: Record<string, string | number | boolean> = {};
    TABLE_HEADERS.forEach(header => { row[header.label] = source[header.key as keyof typeof source]; });
    return row;
  });
  const vaccineRows = babies.flatMap(baby => {
    const vaccines = readStoredObject<Record<string, boolean>>(`babycare_vaccines_${baby.id}`);
    return guideData.flatMap(stage => (stage.vaccineGuide?.vaccines ?? []).map(vaccine => ({
      '宝宝ID': baby.id,
      '宝宝名字': baby.name,
      '年龄阶段': stage.ageRange,
      '疫苗名称': vaccine.name,
      '建议接种时间': vaccine.age,
      '接种状态': vaccines[`${stage.id}:${vaccine.name}`] ? '已接种' : '未接种',
      '接种说明': vaccine.note ?? ''
    })));
  });
  const allergenRows = babies.flatMap(baby => {
    const allergens = readStoredObject<Record<string, 'untested' | 'safe' | 'allergic'>>(`babycare_allergens_${baby.id}`);
    return guideData.flatMap(stage => (stage.solidsGuide?.allergenChecklist ?? []).map(food => {
      const status = allergens[food] ?? 'untested';
      return {
        '宝宝ID': baby.id,
        '宝宝名字': baby.name,
        '年龄阶段': stage.ageRange,
        '过敏原/食物': food,
        '排查状态': status === 'safe' ? '安全' : status === 'allergic' ? '过敏' : '未排查'
      };
    }));
  });
  const settingRows = [
    { '设置项': '时间推断方式', '当前值': localStorage.getItem('babycare_time_inference_mode') === '"start"' ? '当前时间为开始时间' : '当前时间为结束时间' },
    { '设置项': '主题', '当前值': localStorage.getItem('babycare_theme') === '"dark"' ? '深色' : '浅色' },
    { '设置项': '睡眠声音', '当前值': localStorage.getItem('babycare_white_noise_track') ?? '' },
    { '设置项': '声音循环方式', '当前值': localStorage.getItem('babycare_white_noise_loop') ?? '' },
    { '设置项': '声音音量', '当前值': localStorage.getItem('babycare_white_noise_volume') ?? '' },
    { '设置项': '自定义音乐信息', '当前值': localStorage.getItem('babycare_custom_audio') ?? '[]' },
    { '设置项': '各宝宝喂养偏好', '当前值': JSON.stringify(Object.fromEntries(babies.map(baby => [baby.id, {
      feedingType: readStoredValue(`babycare_last_feeding_type_${baby.id}`, 'breast'),
      bottleVolume: readStoredValue(`babycare_last_bottle_volume_${baby.id}`, 120),
      bottleType: readStoredValue(`babycare_last_bottle_type_${baby.id}`, 'formula')
    }]))) },
    { '设置项': '导出时间', '当前值': now.toISOString() },
    { '设置项': '记录总数', '当前值': logs.length }
  ];

  return createXlsxWorkbook([
    { name: '宝宝列表', headers: ['宝宝ID', '宝宝名字', '出生日期', '头像状态'], rows: babies.map(baby => ({ '宝宝ID': baby.id, '宝宝名字': baby.name, '出生日期': baby.birthday, '头像状态': baby.avatar ? '已设置（图片不写入表格）' : '未设置' })) },
    { name: '全部记录', headers: TABLE_HEADERS.map(header => header.label), rows },
    { name: '疫苗接种记录', headers: ['宝宝ID', '宝宝名字', '年龄阶段', '疫苗名称', '建议接种时间', '接种状态', '接种说明'], rows: vaccineRows },
    { name: '过敏排查记录', headers: ['宝宝ID', '宝宝名字', '年龄阶段', '过敏原/食物', '排查状态'], rows: allergenRows },
    { name: '宝宝与程序设置', headers: ['设置项', '当前值'], rows: settingRows }
  ]);
};

const rowToLog = (row: Record<string, string>): ActivityLog | null => {
  const timestamp = row['时间'] || '';
  const logType = ({ '喂养': 'feeding', feeding: 'feeding', '睡眠': 'sleep', sleep: 'sleep', '尿布': 'diaper', diaper: 'diaper', '体征': 'growth', growth: 'growth' } as Record<string, ActivityLog['logType']>)[row['类型']];
  if (!timestamp || !logType) return null;

  let metadata: ActivityLog['metadata'] = {};
  try {
    const raw = JSON.parse(row['完整条件数据(JSON)'] || '{}');
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) metadata = raw;
  } catch {
    // Read the visible columns below when the JSON cell was manually edited.
  }
  const subType = row['子类型'];
  if (logType === 'feeding') {
    metadata.feedingType = ['breast', 'bottle', 'solids'].includes(subType) ? subType as 'breast' | 'bottle' | 'solids' : row['左侧(分钟)'] ? 'breast' : row['奶量(ml)'] ? 'bottle' : 'solids';
    if (metadata.feedingType === 'breast') metadata.breast = { leftMinutes: Number(row['左侧(分钟)']) || 0, rightMinutes: Number(row['右侧(分钟)']) || 0 };
    if (metadata.feedingType === 'bottle') metadata.bottle = { volumeMl: Number(row['奶量(ml)']) || 0, fluidType: row['奶液类型'] === '配方奶' ? 'formula' : 'breastmilk' };
    if (metadata.feedingType === 'solids') metadata.solids = { foodName: row['辅食名称'] || '', amount: row['辅食量'] || '', reaction: row['过敏反应'] === '严重过敏' ? 'severe' : row['过敏反应'] === '轻度过敏' ? 'mild' : 'none' };
  } else if (logType === 'sleep') {
    if (row['睡眠开始时间']) metadata.startTime = row['睡眠开始时间'];
    if (row['睡眠结束时间']) metadata.endTime = row['睡眠结束时间'];
    metadata.durationMinutes = Number(row['时长(分钟)']) || 0;
  } else if (logType === 'diaper') {
    metadata.pee = row['嘘嘘'] === '是' || row['嘘嘘']?.toLowerCase() === 'true';
    metadata.poop = row['便便'] === '是' || row['便便']?.toLowerCase() === 'true';
    const color = row['便便颜色'];
    if (color) metadata.poopColor = color === '黄色' ? 'yellow' : color === '绿色' ? 'green' : color === '褐色' ? 'brown' : 'other';
    const consistency = row['便便性状'];
    if (consistency) metadata.poopConsistency = consistency === '稀便' ? 'watery' : consistency === '硬便' ? 'hard' : 'normal';
  } else {
    if (row['体重(kg)']) metadata.weightKg = Number(row['体重(kg)']);
    if (row['身高(cm)']) metadata.heightCm = Number(row['身高(cm)']);
    if (row['头围(cm)']) metadata.headCircumferenceCm = Number(row['头围(cm)']);
    if (row['体温(°C)']) metadata.temperatureC = Number(row['体温(°C)']);
  }
  return { id: row['记录ID'] || `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, babyId: row['宝宝ID'] || 'imported', timestamp, logType, metadata };
};

export function DataTransfer({ logs, onImportLogs, babies, activeBabyId, onImportBabies }: DataTransferProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<{ show: boolean; message: string; confirm?: () => void }>({ show: false, message: '' });
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);

  const showToast = (message: string, error = false) => {
    setToast({ message, error });
    window.setTimeout(() => setToast(null), 2500);
  };

  const handleExport = async () => {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const fileName = `XiXiCare_完整数据_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.xlsx`;
    const fileBytes = buildCompleteWorkbook(logs, babies, now);
    const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    try {
      if (Capacitor.isNativePlatform()) {
        const binary = Array.from(fileBytes).map(byte => String.fromCharCode(byte)).join('');
        const data = btoa(binary);
        try {
          await Filesystem.writeFile({ path: fileName, data, directory: Directory.Documents });
          setDialog({ show: true, message: `导出成功：文件已保存到 Documents 目录\n${fileName}` });
        } catch {
          await Filesystem.writeFile({ path: fileName, data, directory: Directory.Data });
          setDialog({ show: true, message: `导出成功：文件已保存到 App Data 目录\n${fileName}` });
        }
        showToast('全部数据导出成功');
        return;
      }

      const blob = new Blob([fileBytes], { type: mimeType });
      const browserWindow = window as Window & { showDirectoryPicker?: (options: { mode: string }) => Promise<any> };
      if (browserWindow.showDirectoryPicker) {
        try {
          const directory = await browserWindow.showDirectoryPicker({ mode: 'readwrite' });
          const file = await directory.getFileHandle(fileName, { create: true });
          const writable = await file.createWritable();
          await writable.write(blob);
          await writable.close();
          showToast('全部数据导出成功');
          setDialog({ show: true, message: `导出成功：文件已保存到“${directory.name}”文件夹\n${fileName}` });
          return;
        } catch (error: any) {
          if (error?.name === 'AbortError') return;
        }
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      showToast('全部数据导出成功');
      setDialog({ show: true, message: `导出成功：文件已保存到浏览器下载目录\n${fileName}` });
    } catch (error) {
      console.error('导出失败:', error);
      showToast('导出失败，请重试', true);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setDialog({ show: true, message: '导入失败：目前仅支持 .xlsx 表格' });
      event.target.value = '';
      return;
    }
    try {
      const workbook = await parseXlsxWorkbook(await file.arrayBuffer());
      const recordsSheet = workbook.find(sheet => sheet.name === '全部记录') ?? workbook[0];
      const babiesSheet = workbook.find(sheet => sheet.name === '宝宝列表');
      const vaccineSheet = workbook.find(sheet => sheet.name === '疫苗接种记录');
      const allergenSheet = workbook.find(sheet => sheet.name === '过敏排查记录');
      const settingsSheet = workbook.find(sheet => sheet.name === '宝宝与程序设置');
      const importedBabies = babiesSheet?.rows.map((row) => ({
        id: row['宝宝ID'] || createBabyId(),
        name: row['宝宝名字'] || '宝宝',
        birthday: row['出生日期'] || ''
      } satisfies BabyInfo)).filter((item) => item.birthday) ?? [];
      const importedLogs = recordsSheet.rows.map(rowToLog).filter((log): log is ActivityLog => Boolean(log)).map((log) => babiesSheet ? log : { ...log, babyId: activeBabyId });
      const importedVaccines: Record<string, Record<string, boolean>> = {};
      vaccineSheet?.rows.forEach(row => {
        const stage = guideData.find(item => item.ageRange === row['年龄阶段'] && item.vaccineGuide?.vaccines.some(vaccine => vaccine.name === row['疫苗名称']));
        const babyId = row['宝宝ID'] || activeBabyId;
        if (stage && row['疫苗名称']) {
          importedVaccines[babyId] ??= {};
          importedVaccines[babyId][`${stage.id}:${row['疫苗名称']}`] = row['接种状态'] === '已接种';
        }
      });
      const importedAllergens: Record<string, Record<string, 'untested' | 'safe' | 'allergic'>> = {};
      allergenSheet?.rows.forEach(row => {
        if (!row['过敏原/食物']) return;
        const babyId = row['宝宝ID'] || activeBabyId;
        importedAllergens[babyId] ??= {};
        importedAllergens[babyId][row['过敏原/食物']] = row['排查状态'] === '安全' ? 'safe' : row['排查状态'] === '过敏' ? 'allergic' : 'untested';
      });
      const importedSettings = new Map(settingsSheet?.rows.map(row => [row['设置项'], row['当前值']]) ?? []);
      const hasCompleteData = Boolean(babiesSheet || vaccineSheet || allergenSheet || settingsSheet);

      if (importedLogs.length === 0 && !hasCompleteData) {
        setDialog({ show: true, message: '导入失败：未解析到有效数据' });
      } else {
        const summary = [
          `${importedLogs.length} 条大盘记录`,
          babiesSheet ? `${importedBabies.length} 位宝宝` : '',
          vaccineSheet ? `${Object.values(importedVaccines).flatMap(Object.values).filter(Boolean).length} 项已接种状态` : '',
          allergenSheet ? `${Object.values(importedAllergens).flatMap(Object.keys).length} 项过敏排查` : '',
          settingsSheet ? '程序设置' : ''
        ].filter(Boolean).join('、');
        setDialog({
          show: true,
          message: `将导入：${summary}。是否继续？`,
          confirm: () => {
            if (importedLogs.length > 0) onImportLogs(importedLogs);
            if (importedBabies.length > 0) onImportBabies(importedBabies);
            if (vaccineSheet) Object.entries(importedVaccines).forEach(([babyId, status]) => localStorage.setItem(`babycare_vaccines_${babyId}`, JSON.stringify(status)));
            if (allergenSheet) Object.entries(importedAllergens).forEach(([babyId, status]) => localStorage.setItem(`babycare_allergens_${babyId}`, JSON.stringify(status)));
            if (settingsSheet) {
              const legacyName = importedSettings.get('宝宝名字');
              const legacyBirthday = importedSettings.get('出生日期');
              if (!babiesSheet && legacyName && legacyBirthday) {
                const current = babies.find((item) => item.id === activeBabyId);
                onImportBabies([{ id: activeBabyId, name: legacyName, birthday: legacyBirthday, avatar: current?.avatar }]);
              }
              const timeMode = importedSettings.get('时间推断方式');
              if (timeMode) localStorage.setItem('babycare_time_inference_mode', JSON.stringify(timeMode.includes('开始') ? 'start' : 'end'));
              const theme = importedSettings.get('主题');
              if (theme) localStorage.setItem('babycare_theme', JSON.stringify(theme === '深色' ? 'dark' : 'light'));
              const storedSettingKeys: Array<[string, string]> = [
                ['睡眠声音', 'babycare_white_noise_track'],
                ['声音循环方式', 'babycare_white_noise_loop'],
                ['声音音量', 'babycare_white_noise_volume'],
                ['自定义音乐信息', 'babycare_custom_audio']
              ];
              storedSettingKeys.forEach(([label, key]) => {
                const value = importedSettings.get(label);
                if (value) localStorage.setItem(key, value);
              });
              const feedingPreferences = importedSettings.get('各宝宝喂养偏好');
              if (feedingPreferences) {
                try {
                  const preferences = JSON.parse(feedingPreferences) as Record<string, { feedingType?: string; bottleVolume?: number; bottleType?: string }>;
                  Object.entries(preferences).forEach(([babyId, preference]) => {
                    if (['breast', 'bottle', 'solids'].includes(preference.feedingType ?? '')) localStorage.setItem(`babycare_last_feeding_type_${babyId}`, JSON.stringify(preference.feedingType));
                    if (Number(preference.bottleVolume) > 0) localStorage.setItem(`babycare_last_bottle_volume_${babyId}`, JSON.stringify(Number(preference.bottleVolume)));
                    if (['formula', 'breastmilk'].includes(preference.bottleType ?? '')) localStorage.setItem(`babycare_last_bottle_type_${babyId}`, JSON.stringify(preference.bottleType));
                  });
                } catch {
                  // Older backups do not contain per-baby feeding preferences.
                }
              }
            }
            setDialog({ show: false, message: '' });
            showToast('全部数据导入成功，正在刷新');
            window.setTimeout(() => window.location.reload(), 600);
          }
        });
      }
    } catch (error) {
      console.error('导入失败:', error);
      setDialog({ show: true, message: '读取 XLSX 文件失败，请确认表头和导出模板一致' });
    }
    event.target.value = '';
  };

  return (
    <>
      <div className="settings-data-actions">
        <button type="button" onClick={handleExport}><Download size={17} /><span><strong>导出全部数据</strong><small>宝宝、记录、疫苗、过敏排查与设置</small></span></button>
        <button type="button" onClick={() => fileInputRef.current?.click()}><Upload size={17} /><span><strong>导入全部数据</strong><small>恢复全部宝宝与对应记录</small></span></button>
        <input ref={fileInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={handleFileChange} />
      </div>
      <ConfirmModal
        isOpen={dialog.show}
        message={dialog.message}
        type={dialog.confirm ? 'warning' : 'info'}
        confirmText={dialog.confirm ? '确认' : '确定'}
        cancelText={dialog.confirm ? '取消' : ''}
        onConfirm={dialog.confirm ?? (() => setDialog({ show: false, message: '' }))}
        onCancel={() => setDialog({ show: false, message: '' })}
      />
      {toast && <div className={`toast ${toast.error ? 'toast-error' : 'toast-success'}`}>{toast.error ? <AlertTriangle size={16} /> : <Check size={16} />}<span>{toast.message}</span></div>}
    </>
  );
}
