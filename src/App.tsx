import React from 'react';
import { AppProvider, useApp } from './store/AppContext';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0d1117', color: '#e2e8f0', flexDirection: 'column', gap: 16, fontFamily: 'system-ui', padding: 24 }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f87171' }}>SmartMeasure CAD — App Error</div>
          <div style={{ fontSize: 13, color: '#94a3b8', maxWidth: 480, textAlign: 'center' }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ marginTop: 8, padding: '10px 24px', borderRadius: 10, background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
            Clear Storage &amp; Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import { ProductFlow } from './screens/ProductFlow';
import { KitchenSteps } from './screens/KitchenSteps';
import { LiveDrawing } from './screens/LiveDrawing';
import { FinalDrawing } from './screens/FinalDrawing';
import { RutujaDrawing } from './screens/RutujaDrawing';
import { ProductViewer } from './screens/ProductViewer';
import { subscribeViewer } from './products/viewerBus';
import type { ProductId } from './products/productTypes';
import type { AppScreen } from './store/types';

const NAV: { id: AppScreen; icon: string; label: string }[] = [
  { id: 'products', icon: '🧩', label: 'Products' },
  { id: 'kitchen-steps', icon: '🍳', label: 'Kitchen' },
];

function Sidebar() {
  const { screen, setScreen, model, geo, logoutEmployee } = useApp();
  return (
    <nav className="flex flex-col border-r"
      style={{ width: 64, background: '#0d1117', borderColor: '#243045', flexShrink: 0 }}>
      {/* Logo */}
      <div className="flex flex-col items-center justify-center py-3 border-b"
        style={{ borderColor: '#243045' }}>
        <span className="text-xl">📐</span>
        <span className="text-xs font-black mt-0.5" style={{ color: '#3b82f6', fontSize: 7.5, letterSpacing: 1 }}>CAD</span>
      </div>

      <div className="flex flex-col flex-1 py-2 gap-1">
        {NAV.map((item) => (
          <button key={item.id} onClick={() => setScreen(item.id)} title={item.label}
            className="relative flex flex-col items-center gap-0.5 py-3 mx-1.5 rounded-xl transition-all"
            style={{
              background: screen === item.id ? '#1a2233' : 'transparent',
              color: screen === item.id ? '#60a5fa' : '#3d4f6a',
              border: screen === item.id ? '1.5px solid #243045' : '1.5px solid transparent',
            }}>
            <span className="text-lg">{item.icon}</span>
            <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 0.5 }}>{item.label}</span>
            {item.id === 'kitchen-steps' && model.completedSteps.length > 0 && (
              <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                style={{ background: '#3b82f6', color: '#fff', fontSize: 7 }}>
                {model.completedSteps.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Completion ring */}
      <div className="pb-4 px-2">
        <div className="rounded-xl py-2 px-1 flex flex-col items-center gap-1"
          style={{ background: '#1a2233' }}>
          <svg width={36} height={36} viewBox="0 0 36 36">
            <circle cx={18} cy={18} r={14} fill="none" stroke="#1e2535" strokeWidth={4} />
            <circle cx={18} cy={18} r={14} fill="none" stroke="#3b82f6" strokeWidth={4}
              strokeDasharray={`${(geo.completionPercent / 100) * 88} 88`}
              strokeLinecap="round" transform="rotate(-90 18 18)" />
            <text x={18} y={18} textAnchor="middle" dominantBaseline="middle"
              fontSize={7} fontWeight={700} fontFamily="JetBrains Mono, monospace" fill="#60a5fa">
              {geo.completionPercent}
            </text>
          </svg>
          <span style={{ color: '#3d4f6a', fontSize: 7.5, fontWeight: 600 }}>% done</span>
        </div>
        <button
          onClick={logoutEmployee}
          className="mt-2 w-full rounded-lg px-2 py-1.5 text-[9px] font-bold uppercase tracking-wide"
          style={{ background: '#1e2535', color: '#94a3b8', border: '1px solid #243045' }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}

function BottomNav() {
  const { screen, setScreen } = useApp();
  return (
    <nav className="flex border-t lg:hidden"
      style={{ background: '#0d1117', borderColor: '#243045', flexShrink: 0 }}>
      {NAV.map((item) => (
        <button key={item.id} onClick={() => setScreen(item.id)}
          className="flex-1 flex flex-col items-center gap-0.5 py-2"
          style={{ color: screen === item.id ? '#60a5fa' : '#3d4f6a' }}>
          <span className="text-xl">{item.icon}</span>
          <span className="text-xs font-semibold" style={{ fontSize: 9.5 }}>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function AppHeader() {
  const { model, screen } = useApp();
  return (
    <header className="flex items-center gap-3 px-4 border-b lg:hidden"
      style={{ background: '#0d1117', borderColor: '#243045', height: 50, flexShrink: 0 }}>
      <span className="text-sm font-black tracking-tight" style={{ color: '#e2e8f0' }}>
        SmartMeasure <span style={{ color: '#3b82f6' }}>CAD</span>
      </span>
      <span className="text-xs ml-auto truncate" style={{ color: '#4a5f7a', maxWidth: 160 }}>
        {model.project.clientName || 'New Project'}
      </span>
    </header>
  );
}

function DesktopHeader() {
  const { model, screen, geo, logoutEmployee } = useApp();
  const screenLabel = NAV.find((n) => n.id === screen)?.label ?? screen;
  return (
    <header className="hidden lg:flex items-center gap-4 px-5 border-b"
      style={{ background: '#0d1117', borderColor: '#243045', height: 50, flexShrink: 0 }}>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-black tracking-tight" style={{ color: '#e2e8f0' }}>
          SmartMeasure <span style={{ color: '#3b82f6' }}>CAD</span>
        </span>
        <span className="text-xs px-2 py-0.5 rounded font-mono font-bold"
          style={{ background: '#1a2233', color: '#3d4f6a' }}>v1.0-PROTO</span>
      </div>
      <div className="h-4 w-px" style={{ background: '#243045' }} />
      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#3d4f6a' }}>{screenLabel}</span>

      <div className="ml-auto flex items-center gap-4">
        <span className="text-xs font-mono" style={{ color: '#4a5f7a' }}>
          {model.project.clientName || 'New Project'} · {model.project.projectId}
        </span>
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-20 rounded-full overflow-hidden" style={{ background: '#1a2233' }}>
            <div className="h-full rounded-full" style={{ width: `${geo.completionPercent}%`, background: '#3b82f6' }} />
          </div>
          <span className="text-xs font-mono font-bold" style={{ color: '#60a5fa' }}>{geo.completionPercent}%</span>
        </div>
        <button
          onClick={logoutEmployee}
          className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide"
          style={{ background: '#1e2535', color: '#94a3b8', border: '1px solid #243045' }}
        >
          Logout
        </button>
      </div>
    </header>
  );
}

function LoginScreen() {
  const { loginEmployee, model } = useApp();
  const [value, setValue] = React.useState(model.employeeName || '');

  return (
    <div className="flex h-screen items-center justify-center px-4" style={{ background: '#0d1117' }}>
      <div className="w-full max-w-md rounded-2xl border p-6" style={{ background: '#111827', borderColor: '#243045' }}>
        <div className="mb-6 flex items-center gap-3">
          <span className="text-3xl">📐</span>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: '#60a5fa' }}>SmartMeasure</div>
            <div className="text-2xl font-black" style={{ color: '#e2e8f0' }}>CAD</div>
          </div>
        </div>

        <div className="mb-4 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: '#64748b' }}>
          Employee Login
        </div>

        <label className="mb-2 block text-xs font-semibold uppercase" style={{ color: '#94a3b8' }}>
          Employee Name
        </label>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter name"
          className="w-full rounded-xl px-4 py-3 text-base outline-none"
          style={{ background: '#1e2535', border: '1.5px solid #2a3347', color: '#e2e8f0' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) loginEmployee(value);
          }}
        />

        <button
          onClick={() => loginEmployee(value)}
          disabled={!value.trim()}
          className="mt-5 w-full rounded-xl py-3 text-sm font-bold uppercase tracking-wide disabled:opacity-50"
          style={{ background: '#3b82f6', color: '#fff' }}
        >
          Continue to Products
        </button>

        <div className="mt-5 text-center text-[11px]" style={{ color: '#475569' }}>
          Site measurements auto-save locally and remain available for recovery.
        </div>
      </div>
    </div>
  );
}

function Shell() {
  const { screen, model } = useApp();
  const isFinal = screen === 'final';

  if (!model.isLoggedIn) {
    return <LoginScreen />;
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#0d1117' }}>
      {!isFinal && <AppHeader />}
      {!isFinal && <DesktopHeader />}

      <div className="flex flex-1 overflow-hidden">
        {!isFinal && (
          <div className="hidden lg:flex">
            <Sidebar />
          </div>
        )}
        <main className="flex-1 overflow-hidden flex flex-col">
          {(screen === 'products' || screen === 'demos') && <ProductFlow />}
          {screen === 'kitchen-steps' && <KitchenSteps />}
          {screen === 'drawing' && <LiveDrawing />}
          {screen === 'final' && <FinalDrawing />}
        </main>
      </div>

      {!isFinal && <BottomNav />}
    </div>
  );
}

// Rutuja demo event bus (simple module-level pub/sub so the Project screen can trigger it)
const rutujaListeners: Set<(v: boolean) => void> = new Set();
export function openRutujaDemo() { rutujaListeners.forEach(fn => fn(true)); }

export default function App() {
  const [showRutuja, setShowRutuja] = React.useState(false);
  const [viewerState, setViewerState] = React.useState<{ id: ProductId; tab: string } | null>(null);

  React.useEffect(() => {
    rutujaListeners.add(setShowRutuja);
    return () => { rutujaListeners.delete(setShowRutuja); };
  }, []);

  React.useEffect(() => {
    const unsub = subscribeViewer((state) => {
      setViewerState({ id: state.id as ProductId, tab: state.tab });
    });
    return unsub;
  }, []);

  if (showRutuja) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <RutujaDrawing onBack={() => setShowRutuja(false)} />
      </div>
    );
  }

  if (viewerState) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <ProductViewer
          productId={viewerState.id}
          initialTab={viewerState.tab as 'measurements' | 'drawing' | 'cutlist'}
          onBack={() => setViewerState(null)}
        />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AppProvider>
        <Shell />
      </AppProvider>
    </ErrorBoundary>
  );
}
