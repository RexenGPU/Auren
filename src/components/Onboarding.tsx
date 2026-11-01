import { useState } from 'react';
import { ArrowRight, Check, FileDown, PenLine, ShieldCheck, SunMedium, MoonStar, Circle, Upload, WifiOff } from 'lucide-react';
import { useAppStore } from '../store/app';
import { useT } from '../lib/utils';
import { BrandMark } from './TitleBar';
import type { ThemeId } from '../../shared/types';

const SAMPLE_HTML = `<h1>Welcome to AUREN</h1>
<p><em>A quiet place for ambitious work.</em></p>
<p>This is a real document. Type into it, format it, close AUREN, and open it again — it will still be here, stored only on this computer.</p>
<h2>What makes AUREN different</h2>
<ul>
  <li><p><strong>Local-first.</strong> No account, no cloud, no telemetry. Your library is a folder on your PC.</p></li>
  <li><p><strong>Real documents.</strong> Import and export DOCX, ODT, RTF, Markdown, HTML, and PDF.</p></li>
  <li><p><strong>Made for long thought.</strong> Focus mode, version history, outline, real pages, and a considered typographic surface.</p></li>
</ul>
<h2>Try the essentials</h2>
<p>Press <strong>Ctrl K</strong> for the command palette. Press <strong>Ctrl S</strong> to save. Press <strong>F8</strong> for focus mode. Everything autosaves by default.</p>
<blockquote><p>“The page is not a container. It is a place to think.”</p></blockquote>
<h2>Your next step</h2>
<p>Replace this text with something that matters to you. AUREN will keep it safe.</p>`;

const THEMES: Array<{ id: ThemeId; name: string; hint: string; icon: typeof MoonStar; colors: [string, string, string] }> = [
  { id: 'midnight', name: 'settings.midnight', hint: 'settings.midnightHint', icon: MoonStar, colors: ['#12121a', '#8b7cf6', '#efedf6'] },
  { id: 'paper', name: 'settings.paper', hint: 'settings.paperHint', icon: SunMedium, colors: ['#f4f1ea', '#6d5bd0', '#252219'] },
  { id: 'oled', name: 'settings.oled', hint: 'settings.oledHint', icon: Circle, colors: ['#000000', '#b7a4ff', '#f6f5f9'] }
];

export function Onboarding() {
  const t = useT();
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const createDocument = useAppStore((state) => state.createDocument);
  const beginImport = useAppStore((state) => state.beginImport);
  const [step, setStep] = useState(0);

  if (!settings) return null;

  const complete = async (openSample = false) => {
    await updateSettings({ onboardingComplete: true, showLaunchScreen: false });
    if (openSample) {
      await createDocument({ title: 'Welcome to AUREN', html: SAMPLE_HTML });
    }
  };

  return (
    <div className="onboarding">
      <div className="onboarding-visual">
        <div className="onboarding-brand">
          <span className="brand-mark" style={{ width: 26, height: 26 }}><BrandMark size={26} /></span>
          <span>AUREN</span>
        </div>
        <div className="onboarding-orbit orbit-one" />
        <div className="onboarding-orbit orbit-two" />
        <div className="onboarding-quote">
          <span className="eyebrow">{t('onboarding.eyebrow')}</span>
          <h1>{t('onboarding.title')}</h1>
          <p>{t('onboarding.body')}</p>
        </div>
        <div className="onboarding-page-stack" aria-hidden="true">
          <div className="ghost-page ghost-page-back" />
          <div className="ghost-page ghost-page-mid" />
          <div className="ghost-page ghost-page-front">
            <div className="ghost-kicker" />
            <div className="ghost-title" />
            <div className="ghost-line w90" />
            <div className="ghost-line w80" />
            <div className="ghost-line w95" />
            <div className="ghost-line w60" />
            <div className="ghost-space" />
            <div className="ghost-line w85" />
            <div className="ghost-line w70" />
            <div className="ghost-line w90" />
            <div className="ghost-line w45" />
            <div className="ghost-rule" />
            <div className="ghost-line w80" />
            <div className="ghost-line w65" />
          </div>
        </div>
        <div className="onboarding-local">
          <ShieldCheck size={13} /> {t('onboarding.localBody')}
        </div>
      </div>

      <div className="onboarding-panel">
        <div className="onboarding-steps">
          {[0, 1, 2].map((index) => <span key={index} className={index === step ? 'is-active' : index < step ? 'is-done' : ''} />)}
        </div>

        {step === 0 && (
          <div className="onboarding-content">
            <span className="onboarding-kicker">01 · Welcome</span>
            <h2>A word processor<br />for what matters.</h2>
            <p className="onboarding-lede">AUREN is calm by design: a private library, a beautiful page, and only the tools you actually need.</p>
            <div className="onboarding-actions">
              <button className="btn btn-primary btn-lg" onClick={() => setStep(1)}>{t('onboarding.continue')} <ArrowRight size={15} /></button>
              <button className="btn btn-ghost btn-lg" onClick={() => void beginImport()}><Upload size={14} /> {t('onboarding.import')}</button>
            </div>
            <button className="btn-link onboarding-sample" onClick={() => void complete(true)}><PenLine size={13} /> {t('onboarding.sample')}</button>
          </div>
        )}

        {step === 1 && (
          <div className="onboarding-content">
            <span className="onboarding-kicker">02 · Atmosphere</span>
            <h2>{t('onboarding.themeTitle')}</h2>
            <p className="onboarding-lede">{t('onboarding.themeBody')}</p>
            <div className="theme-choice-list">
              {THEMES.map((theme) => {
                const Icon = theme.icon;
                return (
                  <button key={theme.id} className={`theme-choice ${settings.theme === theme.id ? 'is-selected' : ''}`} onClick={() => void updateSettings({ theme: theme.id })}>
                    <span className="theme-choice-preview" style={{ background: theme.colors[0] }}>
                      <span style={{ background: theme.colors[2], opacity: 0.9 }} />
                      <span style={{ background: theme.colors[1] }} />
                      <span style={{ background: theme.colors[2], opacity: 0.45 }} />
                    </span>
                    <span className="theme-choice-text">
                      <strong><Icon size={13} /> {t(theme.name)}</strong>
                      <em>{t(theme.hint)}</em>
                    </span>
                    {settings.theme === theme.id && <span className="theme-check"><Check size={12} /></span>}
                  </button>
                );
              })}
            </div>
            <div className="onboarding-actions">
              <button className="btn btn-ghost btn-lg" onClick={() => setStep(0)}>{t('onboarding.back')}</button>
              <button className="btn btn-primary btn-lg" onClick={() => setStep(2)}>{t('onboarding.continue')} <ArrowRight size={15} /></button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-content">
            <span className="onboarding-kicker">03 · Ready</span>
            <h2>{t('onboarding.ready')}</h2>
            <p className="onboarding-lede">{t('onboarding.readyBody')}</p>
            <div className="onboarding-features">
              <div><ShieldCheck size={17} /><strong>{t('onboarding.local')}</strong><span>{t('onboarding.localBody')}</span></div>
              <div><WifiOff size={17} /><strong>{t('onboarding.offline')}</strong><span>{t('onboarding.offlineBody')}</span></div>
              <div><FileDown size={17} /><strong>DOCX & PDF</strong><span>Bring your work in. Take it anywhere.</span></div>
            </div>
            <div className="onboarding-actions">
              <button className="btn btn-ghost btn-lg" onClick={() => setStep(1)}>{t('onboarding.back')}</button>
              <button className="btn btn-primary btn-lg" onClick={() => void complete(false)}>{t('onboarding.finish')} <ArrowRight size={15} /></button>
            </div>
            <button className="btn-link onboarding-sample" onClick={() => void complete(true)}><PenLine size={13} /> {t('onboarding.sample')}</button>
          </div>
        )}

        <div className="onboarding-footer">
          <span>{t('app.tagline')}</span>
          <span>·</span>
          <span>{t('nav.localOnly')}</span>
        </div>
      </div>
    </div>
  );
}
