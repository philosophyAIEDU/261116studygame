import { useEffect, useRef, useState, type ReactNode } from 'react';
import changelog from '../../../CHANGELOG.md?raw';
import { MBTI_TYPES, SPEEDS, type Mbti } from '@/types';
import type { ModelKey } from '@/config/geminiLimits';
import { ALL_PACKS } from '@/content/loader';
import { ko } from '@/i18n/ko';
import { SPEED_ICON, SPEED_LABEL } from '@/audio/speedLadder';
import { cacheSupported, downloadedPacks, downloadPack, formatBytes, packAudioBytes, packAudioUrls, removePack, storageUsage } from '@/audio/packCache';
import { allDrawings, clearDrawings, restoreDrawings, type AudioPackRecord } from '@/features/dictionary/db';
import { deleteApiKey, getApiKey, maskKey, setApiKey } from '@/features/gemini/key';
import { flashForTalkWarning } from '@/features/gemini/modelSelect';
import { nextResetAt, usageSummary } from '@/features/gemini/usage';
import { buildBackup, parseBackup } from '@/save/backup';
import type { ModelMode, QualitySetting } from '@/save/schema';
import { useGame } from '@/save/store';
import { useUi } from '@/app/uiStore';
import { useAppUpdate } from '@/app/appUpdate';
import { Btn, Modal } from '@/ui/kit';

// 설정 화면 (보호자용, 한국어). 문자열은 모두 src/i18n/ko.ts 에서 가져온다.

const t = ko.settings;
type Tab = keyof typeof t.tabs;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl bg-white/10 p-4">
      <h3 className="mb-3 text-lg font-extrabold text-honey">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-6 w-6 shrink-0 accent-[#f6b352]" />
      <span><span className="block text-base font-bold">{label}</span>{hint ? <span className="block text-sm leading-relaxed text-paper/80">{hint}</span> : null}</span>
    </label>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-24 text-base font-bold">{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-11 flex-1 accent-[#f6b352]" />
      <span className="w-10 text-right text-sm">{Math.round(value * 100)}</span>
    </label>
  );
}

/** CHANGELOG.md 를 간단히 그린다 (제목과 목록만) */
function Changelog({ text }: { text: string }) {
  return (
    <div className="scroll-y max-h-60 rounded-xl bg-night-2 p-3 text-sm leading-relaxed">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('## ')) return <p key={i} className="mt-2 text-base font-extrabold text-honey">{line.slice(3)}</p>;
        if (line.startsWith('### ')) return <p key={i} className="mt-1 font-bold">{line.slice(4)}</p>;
        if (line.startsWith('- ')) return <p key={i} className="pl-3">• {line.slice(2)}</p>;
        if (line.startsWith('# ') || line.trim() === '') return null;
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

export function Settings({ onClose }: { onClose: () => void }) {
  const save = useGame((s) => s.save);
  const patchSettings = useGame((s) => s.patchSettings);
  const setVolume = useGame((s) => s.setVolume);
  const patchGemini = useGame((s) => s.patchGemini);
  const updateProfile = useGame((s) => s.updateProfile);
  const open = useUi((s) => s.open);
  const update = useAppUpdate();
  const [tab, setTab] = useState<Tab>('general');
  const [keyDraft, setKeyDraft] = useState('');
  const [savedKey, setSavedKey] = useState(() => getApiKey());
  const [consent, setConsent] = useState<'sendAudioToGemini' | 'pronunciationFeedback' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [packs, setPacks] = useState<Record<string, AudioPackRecord>>({});
  const [busyPack, setBusyPack] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const settings = save.settings;
  const now = new Date();
  const sum = usageSummary(save.gemini.usage, save.gemini.limits, now);

  const refreshAudio = () => {
    void downloadedPacks().then(setPacks).catch(() => {});
    void storageUsage().then(setUsage).catch(() => {});
  };
  useEffect(refreshAudio, []);

  const setLimit = (model: ModelKey, field: 'rpm' | 'rpd', value: number) => {
    if (!Number.isFinite(value) || value < 1) return;
    patchGemini({ limits: { ...save.gemini.limits, [model]: { ...save.gemini.limits[model], [field]: Math.floor(value) } } });
  };

  const exportData = async () => {
    const backup = buildBackup(save, await allDrawings().catch(() => ({})), __APP_VERSION__, new Date());
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `school-quest-backup-${backup.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importData = async (file: File) => {
    const parsed = parseBackup(await file.text());
    if (!parsed) return setMessage(t.importFail);
    await restoreDrawings(parsed.drawings).catch(() => {});
    useGame.getState().replaceSave(parsed.save);
    setMessage(t.importDone);
  };
  const resetAll = async () => {
    if (!window.confirm(t.resetConfirm)) return;
    await clearDrawings().catch(() => {});
    useGame.getState().resetSave();
  };

  return (
    <Modal title={t.title} icon="⚙️" onClose={onClose} ko wide>
      <div role="tablist" className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(t.tabs) as Tab[]).map((id) => (
          <Btn key={id} role="tab" aria-selected={tab === id} tone={tab === id ? 'honey' : 'ghost'} className="flex-1" onClick={() => setTab(id)}>{t.tabs[id]}</Btn>
        ))}
      </div>

      {tab === 'general' && (
        <>
          <Section title={t.mbti}>
            <p className="text-sm text-paper/80">{t.mbtiHint}</p>
            <select aria-label={t.mbti} value={save.profile?.mbti ?? 'INFP'} onChange={(e) => updateProfile({ mbti: e.target.value as Mbti })}
              className="min-h-11 rounded-xl bg-white px-3 text-lg text-ink">
              {MBTI_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Section>
          <Section title={t.sound}>
            <Slider label={t.bgm} value={settings.volume.bgm} onChange={(v) => setVolume('bgm', v)} />
            <Slider label={t.sfx} value={settings.volume.sfx} onChange={(v) => setVolume('sfx', v)} />
            <Slider label={t.voice} value={settings.volume.voice} onChange={(v) => setVolume('voice', v)} />
          </Section>
          <Section title={t.speed}>
            <div role="radiogroup" aria-label={t.speed} className="flex gap-2">
              {SPEEDS.map((s) => (
                <Btn key={s} role="radio" aria-checked={settings.speed === s} tone={settings.speed === s ? 'honey' : 'ghost'} icon={SPEED_ICON[s]} className="flex-1" onClick={() => patchSettings({ speed: s })}>{SPEED_LABEL[s]}</Btn>
              ))}
            </div>
            <Toggle label={t.autoNight} checked={settings.autoNight} onChange={(v) => patchSettings({ autoNight: v })} />
          </Section>
          <Section title={t.quality}>
            <div role="radiogroup" aria-label={t.quality} className="flex flex-wrap gap-2">
              {([['auto', t.qualityAuto], ['low', t.qualityLow], ['medium', t.qualityMedium], ['high', t.qualityHigh]] as [QualitySetting, string][]).map(([q, label]) => (
                <Btn key={q} role="radio" aria-checked={settings.quality === q} tone={settings.quality === q ? 'honey' : 'ghost'} className="flex-1" onClick={() => patchSettings({ quality: q })}>{label}</Btn>
              ))}
            </div>
            <p className="text-sm text-paper/80">{t.qualityHint}</p>
          </Section>
        </>
      )}

      {tab === 'ai' && (
        <>
          <Section title={t.geminiTitle}>
            {savedKey ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-xl bg-night-2 px-3 py-2 font-mono text-base" aria-label={t.geminiKeySaved}>🔑 {maskKey(savedKey)}</span>
                <Btn tone="berry" icon="🗑️" onClick={() => { deleteApiKey(); setSavedKey(null); }}>{ko.common.delete}</Btn>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <label htmlFor="gemini-key" className="sr-only">{t.geminiKey}</label>
                <input id="gemini-key" type="password" value={keyDraft} autoComplete="off" placeholder={t.geminiKeyPlaceholder} onChange={(e) => setKeyDraft(e.target.value)}
                  className="min-h-11 min-w-0 flex-1 rounded-xl bg-white px-3 text-base text-ink" />
                <Btn tone="meadow" disabled={keyDraft.trim().length < 10} onClick={() => { setApiKey(keyDraft); setSavedKey(getApiKey()); setKeyDraft(''); }}>{ko.common.save}</Btn>
              </div>
            )}
            <p className="text-sm leading-relaxed text-paper/80">{t.geminiKeyHelp}</p>
            <p className="rounded-xl bg-berry/25 p-2 text-sm leading-relaxed">{t.geminiBilling}</p>
            <p className="text-sm text-paper/80">{t.geminiNoKey}</p>
          </Section>

          <Section title={t.usageToday}>
            <ul className="space-y-1 text-base">
              {[sum.lite, sum.flash].map((u) => (
                <li key={u.key} className={u.level === 'blocked' ? 'font-bold text-berry' : u.level === 'warn' ? 'font-bold text-honey' : ''}>🤖 {u.label}: {u.used} / {u.rpd}</li>
              ))}
            </ul>
            <p className="text-sm text-paper/80">{t.nextReset}: {nextResetAt(now).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
            <p className="text-sm leading-relaxed text-paper/80">{t.resetNote} {t.usageNote}</p>
          </Section>

          <Section title={t.model}>
            <div role="radiogroup" aria-label={t.model} className="space-y-2">
              {([['auto', t.modelAuto], ['lite', t.modelLite], ['flash', t.modelFlash]] as [ModelMode, string][]).map(([mode, label]) => (
                <label key={mode} className="flex cursor-pointer items-center gap-3">
                  <input type="radio" name="model-mode" checked={save.gemini.mode === mode} onChange={() => patchGemini({ mode })} className="h-5 w-5 accent-[#f6b352]" />
                  <span className="text-base">{label}</span>
                </label>
              ))}
            </div>
            {flashForTalkWarning(save.gemini.mode) ? <p role="alert" className="rounded-xl bg-honey/30 p-2 text-sm font-bold">{t.modelFlashWarn}</p> : null}
            <p className="text-sm text-paper/80">{t.budget}</p>
          </Section>

          <Section title={t.limits}>
            <p className="text-sm leading-relaxed text-paper/80">{t.limitsHint}</p>
            {(['lite', 'flash'] as const).map((m) => (
              <div key={m} className="flex flex-wrap items-center gap-2 text-base">
                <span className="w-24 font-bold">{save.gemini.limits[m].label}</span>
                <label className="flex items-center gap-1">{t.rpm}
                  <input type="number" min={1} value={save.gemini.limits[m].rpm} onChange={(e) => setLimit(m, 'rpm', Number(e.target.value))} className="h-11 w-20 rounded-lg bg-white px-2 text-ink" />
                </label>
                <label className="flex items-center gap-1">{t.rpd}
                  <input type="number" min={1} value={save.gemini.limits[m].rpd} onChange={(e) => setLimit(m, 'rpd', Number(e.target.value))} className="h-11 w-24 rounded-lg bg-white px-2 text-ink" />
                </label>
              </div>
            ))}
          </Section>

          <Section title={t.talkTitle}>
            <label className="flex flex-wrap items-center gap-2 text-base font-bold">{t.talkMax}
              <input type="number" min={0} max={80} value={settings.maxTalkSessionsPerDay}
                onChange={(e) => patchSettings({ maxTalkSessionsPerDay: Math.max(0, Math.min(80, Math.floor(Number(e.target.value) || 0))) })}
                className="h-11 w-20 rounded-lg bg-white px-2 text-ink" />
            </label>
            <p className="text-sm text-paper/80">{t.talkMaxHint}</p>
            <Toggle label={t.autoSend} checked={settings.autoSendSpeech} onChange={(v) => patchSettings({ autoSendSpeech: v })} />
            {/* 오디오 전송은 보호자 동의 창을 거쳐야만 켜진다 */}
            <Toggle label={t.sendAudio} hint={t.sendAudioHint} checked={settings.sendAudioToGemini}
              onChange={(v) => (v ? setConsent('sendAudioToGemini') : patchSettings({ sendAudioToGemini: false }))} />
            <Toggle label={t.pronunciation} hint={t.pronunciationHint} checked={settings.pronunciationFeedback}
              onChange={(v) => (v ? setConsent('pronunciationFeedback') : patchSettings({ pronunciationFeedback: false }))} />
          </Section>
        </>
      )}

      {tab === 'audio' && (
        <Section title={t.audioTitle}>
          <p className="text-sm leading-relaxed text-paper/80">{t.audioHint}</p>
          <ul className="space-y-2">
            {ALL_PACKS.map((pack) => {
              const files = packAudioUrls(pack).length;
              const record = packs[pack.meta.id];
              const current = record && record.version === pack.meta.version;
              return (
                <li key={pack.meta.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-night-2 p-2">
                  <span className="emoji text-2xl" aria-hidden="true">{pack.meta.cover}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{pack.meta.title}</span>
                    <span className="block text-sm text-paper/80">{files === 0 ? t.audioNone : `${files}${t.audioFiles} · ${formatBytes(packAudioBytes(pack))}${current ? ` · ${t.downloaded}` : ''}`}</span>
                  </span>
                  {files > 0 && cacheSupported() ? (
                    current
                      ? <Btn tone="ghost" icon="🗑️" disabled={busyPack !== null} onClick={() => { setBusyPack(pack.meta.id); void removePack(pack).finally(() => { setBusyPack(null); refreshAudio(); }); }}>{t.remove}</Btn>
                      : <Btn tone="meadow" icon="⬇️" disabled={busyPack !== null} onClick={() => { setBusyPack(pack.meta.id); void downloadPack(pack).finally(() => { setBusyPack(null); refreshAudio(); }); }}>{busyPack === pack.meta.id ? '…' : t.download}</Btn>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {usage ? <p className="text-sm text-paper/80">{t.storage}: {formatBytes(usage.used)}{usage.quota > 0 ? ` / ${formatBytes(usage.quota)}` : ''}</p> : null}
        </Section>
      )}

      {tab === 'data' && (
        <>
          <Section title={t.dataTitle}>
            <div className="flex flex-wrap gap-2">
              <Btn tone="sky" icon="📤" onClick={() => void exportData()}>{t.export}</Btn>
              <Btn tone="paper" icon="📥" onClick={() => fileInput.current?.click()}>{t.import}</Btn>
              <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" aria-label={t.import}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void importData(f); e.target.value = ''; }} />
            </div>
            <p className="text-sm text-paper/80">{t.exportHint}</p>
            {message ? <p role="status" className="rounded-xl bg-meadow/25 p-2 text-base font-bold">{message}</p> : null}
            <Btn tone="berry" icon="⚠️" onClick={() => void resetAll()}>{t.reset}</Btn>
          </Section>
          <Section title={t.appTitle}>
            <p className="text-base">{t.version}: <b>v{__APP_VERSION__}</b></p>
            <div className="flex flex-wrap items-center gap-2">
              <Btn tone="sky" icon="🔄" disabled={update.status === 'checking'} onClick={() => void update.checkNow()}>{t.checkUpdate}</Btn>
              <span role="status" className="text-base">
                {update.status === 'checking' ? t.updateChecking : update.status === 'latest' ? t.upToDate : update.status === 'found' || update.needRefresh ? t.updateFound : ''}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn tone="paper" icon="📲" onClick={() => open({ type: 'install' })}>{t.install}</Btn>
              <Btn tone="paper" icon="📊" onClick={() => open({ type: 'report' })}>{t.report}</Btn>
              <Btn tone="ghost" icon="📖" onClick={() => { useGame.setState((s) => ({ save: { ...s.save, guardianIntroSeen: false } })); onClose(); }}>{t.guide}</Btn>
            </div>
            <p className="text-base font-bold">{t.changelog}</p>
            <Changelog text={changelog} />
          </Section>
        </>
      )}

      {consent ? (
        <div role="alertdialog" aria-label={t.consentTitle} className="fixed inset-0 z-50 flex items-center justify-center bg-night/80 p-4">
          <div className="max-w-md rounded-3xl border-4 border-honey bg-night p-5">
            <h3 className="mb-2 text-xl font-extrabold text-honey">{t.consentTitle}</h3>
            <p className="mb-4 text-base leading-relaxed">{t.consentBody}</p>
            <div className="flex gap-2">
              <Btn tone="ghost" className="flex-1" onClick={() => setConsent(null)}>{ko.common.cancel}</Btn>
              <Btn tone="meadow" className="flex-1" onClick={() => { patchSettings({ [consent]: true }); setConsent(null); }}>{t.consentYes}</Btn>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
