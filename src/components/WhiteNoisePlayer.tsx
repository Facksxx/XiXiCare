import { useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import {
  Bird,
  Check,
  CloudRain,
  Droplets,
  Edit2,
  Heart,
  LampDesk,
  Music2,
  Moon,
  Pause,
  Play,
  Plus,
  Repeat,
  Repeat1,
  Radio,
  SkipBack,
  SkipForward,
  Sparkles,
  Snowflake,
  Timer,
  Trash2,
  Volume2,
  Waves,
  Wind,
  X
} from 'lucide-react';
import type { Icon } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { getInstalledSoundPacks, resolveSoundTrackUrl, SOUND_PACK_EVENT, SOUND_PACKS, type SoundIconName } from '../utils/soundPacks';
import { BackgroundAudio } from '../plugins/backgroundAudio';

type TrackCategory = 'ambient' | 'music';
type LoopMode = 'track' | 'list' | 'once';

interface PlayerTrack {
  id: string;
  name: string;
  src: string;
  icon: Icon;
  category: TrackCategory;
  custom?: boolean;
  path?: string;
}

interface CustomTrackMeta {
  id: string;
  name: string;
  path: string;
  mimeType: string;
  category?: TrackCategory;
}

const TRACK_ICONS: Record<SoundIconName, Icon> = {
  bird: Bird, rain: CloudRain, waves: Waves, shush: Radio, stream: Droplets, wind: Wind,
  star: Sparkles, moon: Moon, music: Music2, heart: Heart, lamp: LampDesk, snow: Snowflake
};

const EMPTY_TRACK: PlayerTrack = { id: '', name: '尚未下载声音包', src: '', icon: Moon, category: 'ambient' };

const LOOP_OPTIONS: Array<{ value: LoopMode; label: string; icon: Icon }> = [
  { value: 'track', label: '单曲循环', icon: Repeat1 },
  { value: 'list', label: '列表循环', icon: Repeat },
  { value: 'once', label: '播放一次', icon: Music2 }
];

const TIMER_OPTIONS = [0, 15, 30, 60] as const;

interface WhiteNoisePlayerProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaybackChange: (isPlaying: boolean) => void;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function base64ToBlob(data: string, mimeType: string) {
  const base64 = data.includes(',') ? data.split(',')[1] : data;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

function fileExtension(file: File) {
  const fromName = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (fromName && fromName.length <= 8) return fromName;
  if (file.type.includes('wav')) return 'wav';
  if (file.type.includes('ogg')) return 'ogg';
  if (file.type.includes('m4a') || file.type.includes('mp4')) return 'm4a';
  return 'mp3';
}

export function WhiteNoisePlayer({ isOpen, onClose, onPlaybackChange }: WhiteNoisePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addCategoryRef = useRef<TrackCategory>('music');
  const isPlayingRef = useRef(false);
  const playOnLoadRef = useRef<string | null>(null);
  const backgroundActiveRef = useRef(false);
  const resumePositionRef = useRef(0);
  const [trackId, setTrackId] = useLocalStorage<string>('babycare_white_noise_track', 'forest-birds');
  const [loopMode, setLoopMode] = useLocalStorage<LoopMode>('babycare_white_noise_loop', 'track');
  const [volume, setVolume] = useLocalStorage<number>('babycare_white_noise_volume', 0.45);
  const [customTracks, setCustomTracks] = useLocalStorage<CustomTrackMeta[]>('babycare_custom_audio', []);
  const [customSources, setCustomSources] = useState<Record<string, string>>({});
  const [packTracks, setPackTracks] = useState<PlayerTrack[]>([]);
  const [browseCategory, setBrowseCategory] = useState<TrackCategory>('ambient');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [timerMinutes, setTimerMinutes] = useState<(typeof TIMER_OPTIONS)[number]>(0);
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [editingCustomId, setEditingCustomId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];

    const resolveSources = async () => {
      const entries = await Promise.all(customTracks.map(async (track) => {
        try {
          if (Capacitor.isNativePlatform()) {
            const result = await Filesystem.getUri({ path: track.path, directory: Directory.Data });
            return [track.id, Capacitor.convertFileSrc(result.uri)] as const;
          }
          const result = await Filesystem.readFile({ path: track.path, directory: Directory.Data });
          const blob = result.data instanceof Blob ? result.data : base64ToBlob(result.data, track.mimeType);
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          return [track.id, url] as const;
        } catch {
          return [track.id, ''] as const;
        }
      }));
      if (!cancelled) setCustomSources(Object.fromEntries(entries));
    };

    void resolveSources();
    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [customTracks]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const installed = getInstalledSoundPacks();
      const tracks = (await Promise.all(SOUND_PACKS.filter(pack => installed.includes(pack.id)).flatMap(pack =>
        pack.tracks.map(async track => ({
          id: track.id, name: track.name, src: await resolveSoundTrackUrl(pack.id, track.file),
          icon: TRACK_ICONS[track.icon], category: pack.id
        } satisfies PlayerTrack))
      ))).filter(track => track.src);
      if (!cancelled) setPackTracks(tracks);
    };
    const refresh = () => void load();
    void load();
    window.addEventListener(SOUND_PACK_EVENT, refresh);
    return () => { cancelled = true; window.removeEventListener(SOUND_PACK_EVENT, refresh); };
  }, []);

  const allTracks = useMemo<PlayerTrack[]>(() => [
    ...packTracks,
    ...customTracks.map((track) => ({
      ...track,
      src: customSources[track.id] ?? '',
      icon: track.category === 'ambient' ? Volume2 : Music2,
      category: track.category ?? 'music',
      custom: true
    }))
  ], [customSources, customTracks, packTracks]);

  const currentTrack = allTracks.find((track) => track.id === trackId) ?? allTracks[0] ?? EMPTY_TRACK;
  const CurrentIcon = currentTrack.icon;

  useEffect(() => {
    if (trackId !== currentTrack.id) setTrackId(currentTrack.id);
  }, [currentTrack.id, setTrackId, trackId]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    onPlaybackChange(isPlaying);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying, onPlaybackChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack.src) return;

    const shouldPlay = playOnLoadRef.current === currentTrack.id || isPlayingRef.current;
    let resumed = false;
    const resume = async () => {
      if (resumed || !shouldPlay) return;
      resumed = true;
      try {
        if (resumePositionRef.current > 0) {
          audio.currentTime = resumePositionRef.current / 1000;
          resumePositionRef.current = 0;
        }
        await audio.play();
        if (playOnLoadRef.current === currentTrack.id) playOnLoadRef.current = null;
        setError('');
      } catch {
        resumed = false;
        setIsPlaying(false);
        setError('暂时无法播放，请重新点击播放');
      }
    };

    audio.addEventListener('canplay', resume);
    audio.pause();
    audio.src = currentTrack.src;
    audio.load();
    setCurrentTime(0);
    setDuration(0);
    setError('');

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.name,
        artist: currentTrack.category === 'ambient' ? 'XiXiCare 环境声音' : 'XiXiCare 纯音乐'
      });
    }

    if (shouldPlay) void resume();
    return () => audio.removeEventListener('canplay', resume);
  }, [currentTrack.id, currentTrack.name, currentTrack.src, currentTrack.category]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = Math.min(1, Math.max(0, volume));
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = loopMode === 'track';
  }, [loopMode]);

  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    const previous = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width
    };
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previous.overflow;
      document.body.style.position = previous.position;
      document.body.style.top = previous.top;
      document.body.style.width = previous.width;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!timerEndsAt) {
      setTimerRemaining(0);
      return;
    }
    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
      setTimerRemaining(remaining);
      if (remaining === 0) {
        audioRef.current?.pause();
        setTimerMinutes(0);
        setTimerEndsAt(null);
      }
    };
    updateTimer();
    const intervalId = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(intervalId);
  }, [timerEndsAt]);

  const categoryQueue = allTracks.filter((track) => track.category === currentTrack.category && track.src);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handleVisibility = async () => {
      const audio = audioRef.current;
      if (document.hidden) {
        if (!audio || audio.paused || categoryQueue.length === 0) return;
        const currentIndex = Math.max(0, categoryQueue.findIndex(track => track.id === currentTrack.id));
        try {
          await BackgroundAudio.start({
            urls: categoryQueue.map(track => track.src),
            trackIds: categoryQueue.map(track => track.id),
            index: currentIndex,
            positionMs: Math.round(audio.currentTime * 1000),
            loopMode,
            volume
          });
          backgroundActiveRef.current = true;
          audio.pause();
        } catch { /* Keep WebView playback as a fallback. */ }
        return;
      }
      if (!backgroundActiveRef.current) return;
      backgroundActiveRef.current = false;
      try {
        const state = await BackgroundAudio.stop();
        if (!state.trackId) return;
        resumePositionRef.current = state.positionMs;
        playOnLoadRef.current = state.playing ? state.trackId : null;
        if (state.trackId === currentTrack.id) {
          if (audio) {
            audio.currentTime = state.positionMs / 1000;
            if (state.playing) void audio.play();
          }
        } else {
          setTrackId(state.trackId);
        }
      } catch { /* The service may already have stopped after one-time playback. */ }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [categoryQueue, currentTrack.id, loopMode, setTrackId, volume]);

  const playTrack = (nextTrack: PlayerTrack) => {
    setBrowseCategory(nextTrack.category);
    setError('');
    if (nextTrack.id === currentTrack.id) {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = 0;
      void audio.play().catch(() => setError('暂时无法播放，请检查系统媒体音量'));
      return;
    }
    playOnLoadRef.current = nextTrack.id;
    setTrackId(nextTrack.id);
  };

  const selectAdjacentTrack = (direction: -1 | 1, keepPlaying = false) => {
    if (categoryQueue.length === 0) return;
    const currentIndex = Math.max(0, categoryQueue.findIndex((track) => track.id === currentTrack.id));
    const nextIndex = (currentIndex + direction + categoryQueue.length) % categoryQueue.length;
    if (keepPlaying) playOnLoadRef.current = categoryQueue[nextIndex].id;
    playTrack(categoryQueue[nextIndex]);
  };

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', () => void audioRef.current?.play());
    navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => selectAdjacentTrack(-1, true));
    navigator.mediaSession.setActionHandler('nexttrack', () => selectAdjacentTrack(1, true));
    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
    };
  });

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setError('');
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setError('暂时无法播放，请检查系统媒体音量');
      }
    } else {
      audio.pause();
    }
  };

  const handleEnded = () => {
    if (loopMode === 'list') {
      selectAdjacentTrack(1, true);
      return;
    }
    setIsPlaying(false);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      setError('请选择音频文件');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('单个音频文件不能超过 50MB');
      return;
    }

    try {
      const id = `custom-${Date.now()}`;
      const path = `custom-audio/${id}.${fileExtension(file)}`;
      const result = await Filesystem.writeFile({
        path,
        directory: Directory.Data,
        recursive: true,
        data: Capacitor.isNativePlatform() ? await fileToDataUrl(file) : file
      });
      const source = Capacitor.isNativePlatform() ? Capacitor.convertFileSrc(result.uri) : URL.createObjectURL(file);
      const category = addCategoryRef.current;
      const name = file.name.replace(/\.[^.]+$/, '').trim() || (category === 'ambient' ? '本地环境声音' : '本地音乐');
      const nextTrack: CustomTrackMeta = { id, name, path, mimeType: file.type || 'audio/mpeg', category };
      setCustomSources((current) => ({ ...current, [id]: source }));
      setCustomTracks((current) => [...current, nextTrack]);
      playOnLoadRef.current = id;
      setTrackId(id);
      setBrowseCategory(category);
      setError('');
    } catch {
      setError('添加声音失败，请重新选择文件');
    }
  };

  const saveCustomName = (id: string) => {
    const name = editingName.trim();
    if (!name) return;
    setCustomTracks((tracks) => tracks.map((track) => track.id === id ? { ...track, name } : track));
    setEditingCustomId(null);
  };

  const deleteCustomTrack = async (track: CustomTrackMeta) => {
    if (!window.confirm(`确认移除“${track.name}”？`)) return;
    try {
      await Filesystem.deleteFile({ path: track.path, directory: Directory.Data });
    } catch {
      // Metadata still needs removing if the underlying file is already gone.
    }
    setCustomTracks((tracks) => tracks.filter((item) => item.id !== track.id));
    if (track.id === currentTrack.id) {
      const category = track.category ?? 'music';
      const fallback = packTracks.find((item) => item.category === category) ?? allTracks.find(item => item.id !== track.id);
      if (fallback) playTrack(fallback);
    }
  };

  const openFilePicker = (category: TrackCategory) => {
    addCategoryRef.current = category;
    fileInputRef.current?.click();
  };

  const activeLoop = LOOP_OPTIONS.find((option) => option.value === loopMode) ?? LOOP_OPTIONS[0];
  const visibleBuiltinTracks = packTracks.filter((track) => track.category === browseCategory);
  const visibleCustomTracks = customTracks.filter((track) => (track.category ?? 'music') === browseCategory);

  return (
    <>
      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onEnded={handleEnded}
        onError={() => setError('声音加载失败，请重新选择')}
      />
      <input ref={fileInputRef} type="file" accept="audio/*" hidden onChange={(event) => void handleFileChange(event)} />

      {isOpen && (
        <div className="noise-player-layer fade-in">
          <button className="noise-player-backdrop" type="button" onClick={onClose} aria-label="关闭睡眠声音播放器" />
          <section className="noise-player-panel" role="dialog" aria-modal="true" aria-labelledby="noise-player-title">
            <header className="noise-player-header">
              <div>
                <h2 id="noise-player-title">睡眠声音</h2>
              </div>
              <button className="noise-player-close" type="button" onClick={onClose} aria-label="关闭播放器"><X size={19} /></button>
            </header>

            <div className="noise-category-tabs" role="tablist" aria-label="声音类型">
              <button type="button" role="tab" aria-selected={browseCategory === 'ambient'} className={browseCategory === 'ambient' ? 'active' : ''} onClick={() => setBrowseCategory('ambient')}>环境声音</button>
              <button type="button" role="tab" aria-selected={browseCategory === 'music'} className={browseCategory === 'music' ? 'active' : ''} onClick={() => setBrowseCategory('music')}>纯音乐</button>
            </div>

            <div className="noise-library" role="radiogroup" aria-label={browseCategory === 'ambient' ? '环境声音' : '纯音乐'}>
              <div className="noise-track-list">
                {visibleBuiltinTracks.map((track) => {
                  const TrackIcon = track.icon;
                  return (
                    <button key={track.id} type="button" role="radio" aria-checked={track.id === currentTrack.id} className={`noise-track-option ${track.id === currentTrack.id ? 'active' : ''}`} onClick={() => playTrack(track)}>
                      <span className="noise-track-icon"><TrackIcon size={19} /></span>
                      <strong>{track.name}</strong>
                    </button>
                  );
                })}
              </div>
              {visibleBuiltinTracks.length === 0 && <p className="noise-pack-empty">请前往设置下载{browseCategory === 'ambient' ? '环境声音包' : '纯音乐包'}</p>}

              <div className="custom-music-section">
                <div className="custom-music-heading">
                  <h3>{browseCategory === 'ambient' ? '我的环境声音' : '我的音乐'}</h3>
                  <button type="button" onClick={() => openFilePicker(browseCategory)}><Plus size={15} />添加</button>
                </div>
                {visibleCustomTracks.length === 0 ? (
                  <p className="custom-music-empty">{browseCategory === 'ambient' ? '暂无本地环境声音' : '暂无本地音乐'}</p>
                ) : (
                  <div className="custom-music-list">
                    {visibleCustomTracks.map((track) => (
                      <div className={`custom-music-row ${track.id === currentTrack.id ? 'active' : ''}`} key={track.id}>
                        {editingCustomId === track.id ? (
                          <>
                            <input value={editingName} onChange={(event) => setEditingName(event.target.value)} aria-label="声音名称" autoFocus onKeyDown={(event) => { if (event.key === 'Enter') saveCustomName(track.id); }} />
                            <button type="button" aria-label="保存名称" onClick={() => saveCustomName(track.id)}><Check size={16} /></button>
                          </>
                        ) : (
                          <>
                            <button className="custom-music-select" type="button" onClick={() => playTrack(allTracks.find((item) => item.id === track.id)!)}>
                              {browseCategory === 'ambient' ? <Volume2 size={16} /> : <Music2 size={16} />}
                              <span>{track.name}</span>
                            </button>
                            <button type="button" aria-label={`修改${track.name}名称`} onClick={() => { setEditingCustomId(track.id); setEditingName(track.name); }}><Edit2 size={15} /></button>
                            <button type="button" aria-label={`移除${track.name}`} onClick={() => void deleteCustomTrack(track)}><Trash2 size={15} /></button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="noise-now-playing">
              <div className={`noise-visual ${isPlaying ? 'playing' : ''}`} aria-hidden="true"><CurrentIcon size={24} /><span /><span /><span /></div>
              <div className="noise-now-copy"><small>正在播放</small><strong>{currentTrack.name}</strong></div>
              <div className="noise-loop-status"><activeLoop.icon size={15} /><span>{activeLoop.label}</span></div>
            </div>

            <div className="noise-progress-row">
              <span>{formatTime(currentTime)}</span>
              <input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} disabled={!duration} aria-label="播放进度" onChange={(event) => { const nextTime = Number(event.target.value); if (audioRef.current) audioRef.current.currentTime = nextTime; setCurrentTime(nextTime); }} />
              <span>{formatTime(duration)}</span>
            </div>

            <div className="noise-main-controls">
              <button type="button" onClick={() => selectAdjacentTrack(-1, isPlayingRef.current)} aria-label="上一首"><SkipBack size={22} /></button>
              <button className="noise-play-button" type="button" onClick={() => void togglePlayback()} aria-label={isPlaying ? '暂停' : '播放'}>{isPlaying ? <Pause size={25} fill="currentColor" /> : <Play size={25} fill="currentColor" />}</button>
              <button type="button" onClick={() => selectAdjacentTrack(1, isPlayingRef.current)} aria-label="下一首"><SkipForward size={22} /></button>
            </div>

            {error && <p className="noise-error" role="alert">{error}</p>}

            <div className="noise-volume-row">
              <Volume2 size={17} aria-hidden="true" />
              <input type="range" min="0" max="1" step="0.05" value={volume} aria-label="音量" onChange={(event) => setVolume(Number(event.target.value))} />
              <span>{Math.round(volume * 100)}%</span>
            </div>

            <div className="noise-setting-block">
              <div className="noise-setting-label"><Repeat size={16} /><span>循环模式</span></div>
              <div className="noise-segmented" role="radiogroup" aria-label="循环模式">
                {LOOP_OPTIONS.map((option) => <button key={option.value} type="button" role="radio" aria-checked={loopMode === option.value} className={loopMode === option.value ? 'active' : ''} onClick={() => setLoopMode(option.value)}>{option.label}</button>)}
              </div>
            </div>

            <div className="noise-setting-block">
              <div className="noise-setting-label"><Timer size={16} /><span>{timerRemaining > 0 ? `${formatTime(timerRemaining)} 后停止` : '睡眠定时'}</span></div>
              <div className="noise-timer-options">
                {TIMER_OPTIONS.map((minutes) => <button key={minutes} type="button" className={timerMinutes === minutes ? 'active' : ''} onClick={() => { setTimerMinutes(minutes); setTimerEndsAt(minutes === 0 ? null : Date.now() + minutes * 60 * 1000); }}>{minutes === 0 ? '关闭' : `${minutes} 分`}</button>)}
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
