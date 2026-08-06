import { useState } from "react";
import {
  ArrowRight,
  AudioLines,
  Check,
  ChevronRight,
  Clapperboard,
  Download,
  FileText,
  Menu,
  Mic2,
  MonitorDown,
  MousePointer2,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  Video,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: Mic2,
    number: "01",
    title: "It follows your voice",
    copy: "SimplePrompt tracks where you are in the script and moves at your pace. Pause, improvise, or take a breath—it waits for you.",
    tone: "lime",
  },
  {
    icon: Video,
    number: "02",
    title: "Record a clean take",
    copy: "Capture crisp camera and microphone footage. Your prompt stays on screen for you, never burned into the final video.",
    tone: "violet",
  },
  {
    icon: ShieldCheck,
    number: "03",
    title: "Private by design",
    copy: "Scripts, recordings, and voice recognition stay on your computer. Your work remains yours—full stop.",
    tone: "blue",
  },
];

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [demoPlaying, setDemoPlaying] = useState(true);

  return (
    <main>
      <header className="site-header">
        <a className="logo" href="#top" aria-label="SimplePrompt home">
          <span className="logo-mark"><AudioLines size={19} strokeWidth={2.6} /></span>
          <span>Simple<span>Prompt</span></span>
        </a>

        <nav className={menuOpen ? "nav-open" : ""} aria-label="Main navigation">
          <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
          <a href="#workflow" onClick={() => setMenuOpen(false)}>How it works</a>
          <a href="#privacy" onClick={() => setMenuOpen(false)}>Privacy</a>
          <a href="#download" onClick={() => setMenuOpen(false)}>Download</a>
        </nav>

        <a className="header-cta" href="#download">
          Get SimplePrompt <ArrowRight size={15} />
        </a>
        <button
          className="menu-button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>

      <section className="hero" id="top">
        <div className="hero-glow" />
        <div className="hero-copy">
          <a className="announce" href="#features">
            <span><Sparkles size={13} /> Built for natural delivery</span>
            <ChevronRight size={14} />
          </a>
          <h1>Your words.<br /><em>Your pace.</em></h1>
          <p className="hero-subtitle">
            The private teleprompter that listens as you speak, follows naturally, and helps every take feel like you.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#download">
              <MonitorDown size={18} /> Get it for $1.99/month
            </a>
            <a className="button button-secondary" href="#workflow">
              See how it works <ArrowRight size={17} />
            </a>
          </div>
          <div className="hero-note">
            <span><Check size={13} /> $1.99 per month</span>
            <span><Check size={13} /> Billed monthly</span>
          </div>
        </div>

        <div className="product-stage" aria-label="SimplePrompt app preview">
          <div className="stage-orbit orbit-one" />
          <div className="stage-orbit orbit-two" />
          <div className="app-window">
            <div className="window-bar">
              <div className="window-brand">
                <span className="mini-mark"><AudioLines size={12} /></span>
                SimplePrompt
              </div>
              <div className="window-nav"><span>Scripts</span><b>Studio</b></div>
              <span className="local-pill"><ShieldCheck size={11} /> Local-first</span>
            </div>
            <div className="studio-view">
              <div className="camera-copy">
                <span>“The best ideas don’t need to sound rehearsed.</span>
                <strong>They just need the space to land.</strong>
                <span>Take a breath, look into the lens, and make it yours.”</span>
              </div>
              <div className="camera-person" aria-hidden="true">
                <div className="person-hair" />
                <div className="person-head" />
                <div className="person-neck" />
                <div className="person-body" />
              </div>
              <div className="focus-line" />
              <div className="following-badge"><span /> Following your voice</div>
              <div className="studio-controls">
                <div className="control-left"><span>00:18</span><i /></div>
                <button onClick={() => setDemoPlaying((playing) => !playing)} aria-label={demoPlaying ? "Pause demo" : "Play demo"}>
                  {demoPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
                </button>
                <div className="audio-meter"><i /><i /><i /><i /><i /><i /></div>
              </div>
            </div>
          </div>
          <div className="floating-card pace-card">
            <AudioLines size={17} />
            <div><small>VOICE PACE</small><strong>Natural & steady</strong></div>
            <span className="live-dot" />
          </div>
          <div className="floating-card clean-card">
            <Check size={16} /> <span>Prompt hidden from recording</span>
          </div>
        </div>
      </section>

      <section className="trust-strip" aria-label="Product highlights">
        <div><Mic2 size={17} /><span><strong>Voice-following</strong> that keeps up</span></div>
        <div><ShieldCheck size={17} /><span><strong>100% local</strong> speech recognition</span></div>
        <div><Clapperboard size={17} /><span><strong>Clean MP4</strong> recordings</span></div>
        <div><Zap size={17} /><span><strong>Ready in</strong> under a minute</span></div>
      </section>

      <section className="features section" id="features">
        <div className="section-heading">
          <span className="kicker">Less managing. More connecting.</span>
          <h2>A teleprompter that gets<br />out of your way.</h2>
          <p>Everything you need to sound prepared—without looking or feeling scripted.</p>
        </div>
        <div className="feature-grid">
          {features.map(({ icon: Icon, number, title, copy, tone }) => (
            <article className={`feature-card ${tone}`} key={title}>
              <div className="feature-top"><span className="feature-icon"><Icon size={23} /></span><span>{number}</span></div>
              <h3>{title}</h3>
              <p>{copy}</p>
              <div className="feature-line" />
            </article>
          ))}
        </div>
      </section>

      <section className="workflow section" id="workflow">
        <div className="workflow-visual">
          <div className="script-card script-back"><span>BRAND STORY · TAKE 02</span></div>
          <div className="script-card script-front">
            <div className="script-card-bar"><FileText size={15} /><span>Product launch</span><i>2:30 min</i></div>
            <p>Great products start with a simple idea: make something <mark>people genuinely want to use.</mark></p>
            <div className="script-progress"><i /></div>
          </div>
          <div className="cursor-bubble"><MousePointer2 size={15} fill="currentColor" /> You</div>
        </div>
        <div className="workflow-copy">
          <span className="kicker">Your new pre-record ritual</span>
          <h2>From blank page<br />to brilliant take.</h2>
          <div className="steps">
            <div><span>1</span><section><h3>Write or generate</h3><p>Paste your script or turn a few talking points into a polished first draft with AI.</p></section></div>
            <div><span>2</span><section><h3>Set your eye-line</h3><p>Place your words near the camera and choose the type size that feels natural.</p></section></div>
            <div><span>3</span><section><h3>Speak. It follows.</h3><p>SimplePrompt listens locally and keeps your next words right where you need them.</p></section></div>
          </div>
        </div>
      </section>

      <section className="privacy section" id="privacy">
        <div className="privacy-copy">
          <span className="privacy-icon"><ShieldCheck size={25} /></span>
          <span className="kicker">Your voice is nobody else's business</span>
          <h2>Private means<br /><em>private.</em></h2>
          <p>Voice recognition happens on your computer. Your recordings, scripts, and transcripts never leave it. No cloud processing. No quiet data collection.</p>
          <div className="privacy-points">
            <span><Check size={15} /> On-device speech recognition</span>
            <span><Check size={15} /> Local script library</span>
            <span><Check size={15} /> No account required</span>
          </div>
        </div>
        <div className="privacy-graphic">
          <div className="privacy-ring ring-outer" />
          <div className="privacy-ring ring-inner" />
          <div className="privacy-core"><ShieldCheck size={38} /><strong>Stays on<br />this device</strong></div>
          <span className="privacy-chip chip-one"><Mic2 size={14} /> Voice</span>
          <span className="privacy-chip chip-two"><FileText size={14} /> Scripts</span>
          <span className="privacy-chip chip-three"><Video size={14} /> Video</span>
        </div>
      </section>

      <section className="download section" id="download">
        <div className="download-noise" />
        <div className="download-copy">
          <span className="kicker">Your next take is the one</span>
          <h2>Sound like yourself.<br />Only <em>better prepared.</em></h2>
          <p>Get SimplePrompt for $1.99 per month and make camera confidence your new default.</p>
          <a className="button button-dark" href="https://apps.microsoft.com/detail/9MT1X5BNTHQS" target="_blank" rel="noreferrer">
            <Download size={19} /> Get SimplePrompt
          </a>
          <small>Windows 10 & 11 · $1.99 per month · No account needed</small>
        </div>
        <WandSparkles className="download-spark spark-one" />
        <WandSparkles className="download-spark spark-two" />
      </section>

      <footer>
        <a className="logo footer-logo" href="#top"><span className="logo-mark"><AudioLines size={18} /></span><span>Simple<span>Prompt</span></span></a>
        <p>Make every word land.</p>
        <div className="footer-links"><a href="#features">Features</a><a href="#privacy">Privacy</a><a href="https://github.com/ReleasedGroup/Prompter/issues">Support</a></div>
        <span className="copyright">© 2026 Released Pty Ltd</span>
      </footer>
    </main>
  );
}
