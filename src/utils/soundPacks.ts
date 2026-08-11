import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { FileTransfer } from '@capacitor/file-transfer';

export type SoundCategory = 'ambient' | 'music';
export type SoundIconName = 'bird' | 'rain' | 'waves' | 'shush' | 'stream' | 'wind' | 'star' | 'moon' | 'music' | 'heart' | 'lamp' | 'snow';

export interface SoundTrackDefinition {
  id: string;
  name: string;
  file: string;
  icon: SoundIconName;
}

export interface SoundPackDefinition {
  id: SoundCategory;
  name: string;
  description: string;
  sizeMb: number;
  tracks: SoundTrackDefinition[];
}

const RAW_ROOT = 'https://gitee.com/Facksxx/xi-xi-care/raw/main/sound-packs';
export const SOUND_PACK_EVENT = 'xixicare-sound-packs-changed';
const INSTALLED_KEY = 'babycare_installed_sound_packs';

export const SOUND_PACKS: SoundPackDefinition[] = [
  {
    id: 'ambient', name: '环境声音包', description: '鸟鸣、雨声、海浪、嘘声、溪流与晚风', sizeMb: 15.1,
    tracks: [
      { id: 'forest-birds', name: '清晨鸟鸣', file: 'forest-birds.mp3', icon: 'bird' },
      { id: 'gentle-rain', name: '轻柔雨声', file: 'gentle-rain.mp3', icon: 'rain' },
      { id: 'sea-waves', name: '舒缓海浪', file: 'sea-waves.mp3', icon: 'waves' },
      { id: 'soothing-shush', name: '安抚嘘声', file: 'soothing-shush.m4a', icon: 'shush' },
      { id: 'forest-stream', name: '森林溪流', file: 'forest-stream.mp3', icon: 'stream' },
      { id: 'gentle-wind', name: '轻柔晚风', file: 'gentle-wind.mp3', icon: 'wind' }
    ]
  },
  {
    id: 'music', name: '纯音乐包', description: '小星星、摇篮曲与轻柔器乐', sizeMb: 19.1,
    tracks: [
      { id: 'twinkle-star', name: '小星星', file: 'twinkle-star.ogg', icon: 'star' },
      { id: 'baby-lullaby', name: '摇篮轻梦', file: 'baby-lullaby.mp3', icon: 'moon' },
      { id: 'close-your-eyes', name: '晚安旋律', file: 'close-your-eyes.mp3', icon: 'music' },
      { id: 'forever-love', name: '暖梦长笛', file: 'forever-love.mp3', icon: 'heart' },
      { id: 'moon-lullaby', name: '月光摇篮', file: 'moon-lullaby.mp3', icon: 'lamp' },
      { id: 'christmas-lullaby', name: '冬夜摇篮', file: 'christmas-lullaby.mp3', icon: 'snow' }
    ]
  }
];

export const getInstalledSoundPacks = (): SoundCategory[] => {
  try { return JSON.parse(localStorage.getItem(INSTALLED_KEY) ?? '[]') as SoundCategory[]; }
  catch { return []; }
};

const setInstalled = (ids: SoundCategory[]) => {
  localStorage.setItem(INSTALLED_KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event(SOUND_PACK_EVENT));
};

export const soundTrackPath = (packId: SoundCategory, file: string) => `sound-packs/${packId}/${file}`;

export const resolveSoundTrackUrl = async (packId: SoundCategory, file: string) => {
  const path = soundTrackPath(packId, file);
  const result = await Filesystem.getUri({ path, directory: Directory.Data });
  return Capacitor.isNativePlatform() ? Capacitor.convertFileSrc(result.uri) : result.uri;
};

export const downloadSoundPack = async (pack: SoundPackDefinition, onProgress: (done: number, total: number) => void) => {
  await Filesystem.mkdir({ path: `sound-packs/${pack.id}`, directory: Directory.Data, recursive: true });
  for (let index = 0; index < pack.tracks.length; index += 1) {
    const track = pack.tracks[index];
    const path = soundTrackPath(pack.id, track.file);
    try { await Filesystem.deleteFile({ path, directory: Directory.Data }); } catch { /* Start this file cleanly. */ }
    const target = await Filesystem.getUri({ path, directory: Directory.Data });
    await FileTransfer.downloadFile({
      url: `${RAW_ROOT}/${pack.id}/${track.file}`,
      path: target.uri,
      progress: false
    });
    onProgress(index + 1, pack.tracks.length);
  }
  setInstalled(Array.from(new Set([...getInstalledSoundPacks(), pack.id])));
};

export const deleteSoundPack = async (packId: SoundCategory) => {
  try { await Filesystem.rmdir({ path: `sound-packs/${packId}`, directory: Directory.Data, recursive: true }); }
  catch { /* A missing directory is already removed. */ }
  setInstalled(getInstalledSoundPacks().filter(id => id !== packId));
};
