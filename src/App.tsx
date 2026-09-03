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
import {
  employeeLogin, adminLogin, fetchMe, logout as apiLogout,
  getEmployeeToken, setEmployeeToken, clearEmployeeToken,
  getAdminToken, setAdminToken, clearAdminToken,
  getLastLogin, setLastLogin as persistLastLogin, clearLastLogin,
  type LastLogin, type SessionUser,
} from './auth/authClient';
import { Dashboard } from './screens/Dashboard';

const NAV: { id: AppScreen; icon: string; label: string }[] = [
  { id: 'products', icon: '🧩', label: 'Products' },
  { id: 'kitchen-steps', icon: '🍳', label: 'Kitchen' },
];

function Sidebar({ onLogout }: { onLogout: () => void }) {
  const { screen, setScreen, model, geo } = useApp();
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
          onClick={onLogout}
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
  // Shrunk from 50px/text-sm — on a phone this bar plus the product bar
  // and tab row were together eating too much vertical space, leaving too
  // little room for the actual drawing underneath.
  return (
    <header className="flex items-center gap-3 px-3 border-b lg:hidden"
      style={{ background: '#0d1117', borderColor: '#243045', height: 36, flexShrink: 0 }}>
      <span className="text-xs font-black tracking-tight" style={{ color: '#e2e8f0' }}>
        SmartMeasure <span style={{ color: '#3b82f6' }}>CAD</span>
      </span>
      <span className="text-[10px] ml-auto truncate" style={{ color: '#4a5f7a', maxWidth: 140 }}>
        {model.project.clientName || 'New Project'}
      </span>
    </header>
  );
}

function DesktopHeader({ onLogout }: { onLogout: () => void }) {
  const { model, screen, geo } = useApp();
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
          onClick={onLogout}
          className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide"
          style={{ background: '#1e2535', color: '#94a3b8', border: '1px solid #243045' }}
        >
          Logout
        </button>
      </div>
    </header>
  );
}

function LoginScreen({ onOpenAdminLogin, onLoginSuccess }: { onOpenAdminLogin: () => void; onLoginSuccess: () => void }) {
  const { loginEmployee } = useApp();
  const [value, setValue] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastLogin, setLastLoginState] = React.useState<LastLogin | null>(() => getLastLogin());

  const doLogin = React.useCallback(async (id: string) => {
    const trimmed = id.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    const result = await employeeLogin(trimmed);
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setEmployeeToken(result.data.token);
    persistLastLogin({ id: result.data.id, name: result.data.name });
    setLastLoginState({ id: result.data.id, name: result.data.name });
    loginEmployee(result.data.id, result.data.name);
    onLoginSuccess();
  }, [busy, loginEmployee, onLoginSuccess]);

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

        {lastLogin && (
          <button
            onClick={() => doLogin(lastLogin.id)}
            disabled={busy}
            className="mb-4 w-full rounded-xl px-4 py-3 text-left disabled:opacity-60"
            style={{ background: '#132038', border: '1.5px solid #1e3a5f' }}
          >
            <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#60a5fa' }}>Continue as</div>
            <div className="text-sm font-bold mt-0.5" style={{ color: '#e2e8f0' }}>{lastLogin.name} <span style={{ color: '#4a5f7a' }}>({lastLogin.id})</span></div>
          </button>
        )}
        {lastLogin && (
          <button
            onClick={() => { clearLastLogin(); setLastLoginState(null); }}
            className="mb-4 text-[11px] underline"
            style={{ color: '#475569' }}
          >
            Not you? Use a different ID
          </button>
        )}

        <label className="mb-2 block text-xs font-semibold uppercase" style={{ color: '#94a3b8' }}>
          Employee ID
        </label>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. E101"
          disabled={busy}
          className="w-full rounded-xl px-4 py-3 text-base outline-none disabled:opacity-60"
          style={{ background: '#1e2535', border: '1.5px solid #2a3347', color: '#e2e8f0' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') doLogin(value);
          }}
        />

        {error && (
          <div className="mt-3 rounded-lg border px-3 py-2 text-xs" style={{ background: '#3b0d0d', color: '#fca5a5', borderColor: '#7f1d1d' }}>
            ⚠ {error}
          </div>
        )}

        <button
          onClick={() => doLogin(value)}
          disabled={!value.trim() || busy}
          className="mt-5 w-full rounded-xl py-3 text-sm font-bold uppercase tracking-wide disabled:opacity-50"
          style={{ background: '#3b82f6', color: '#fff' }}
        >
          {busy ? 'Signing in…' : 'Continue to Products'}
        </button>

        <div className="mt-5 text-center text-[11px]" style={{ color: '#475569' }}>
          Site measurements auto-save locally and remain available for recovery.
        </div>

        <div className="mt-4 pt-4 border-t text-center" style={{ borderColor: '#1e2535' }}>
          <button
            onClick={onOpenAdminLogin}
            className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: '#7c9cff' }}
          >
            Employee KPI / Performance Report →
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminLoginScreen({ onBack, onSuccess }: { onBack: () => void; onSuccess: (user: SessionUser) => void }) {
  const [email, setEmail] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const doLogin = React.useCallback(async () => {
    if (!email.trim() || !pin.trim() || busy) return;
    setBusy(true);
    setError(null);
    const result = await adminLogin(email.trim(), pin.trim());
    setBusy(false);
    // Generic error message regardless of which field was wrong, per spec.
    if (!result.ok) { setError('Invalid credentials.'); return; }
    setAdminToken(result.data.token);
    onSuccess({ id: result.data.id, name: result.data.name, role: result.data.role as SessionUser['role'], email: result.data.email });
  }, [email, pin, busy, onSuccess]);

  return (
    <div className="flex h-screen items-center justify-center px-4" style={{ background: '#0d1117' }}>
      <div className="w-full max-w-md rounded-2xl border p-6" style={{ background: '#111827', borderColor: '#243045' }}>
        <div className="mb-6 flex items-center gap-3">
          <span className="text-3xl">📊</span>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: '#a78bfa' }}>SmartMeasure</div>
            <div className="text-2xl font-black" style={{ color: '#e2e8f0' }}>KPI Dashboard</div>
          </div>
        </div>

        <div className="mb-4 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: '#64748b' }}>
          Manager / CEO Login
        </div>

        <label className="mb-2 block text-xs font-semibold uppercase" style={{ color: '#94a3b8' }}>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="you@company.com"
          disabled={busy}
          className="w-full rounded-xl px-4 py-3 text-base outline-none disabled:opacity-60"
          style={{ background: '#1e2535', border: '1.5px solid #2a3347', color: '#e2e8f0' }}
        />

        <label className="mb-2 mt-4 block text-xs font-semibold uppercase" style={{ color: '#94a3b8' }}>PIN</label>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          type="password"
          placeholder="Access PIN"
          disabled={busy}
          className="w-full rounded-xl px-4 py-3 text-base outline-none disabled:opacity-60"
          style={{ background: '#1e2535', border: '1.5px solid #2a3347', color: '#e2e8f0' }}
          onKeyDown={(e) => { if (e.key === 'Enter') doLogin(); }}
        />

        {error && (
          <div className="mt-3 rounded-lg border px-3 py-2 text-xs" style={{ background: '#3b0d0d', color: '#fca5a5', borderColor: '#7f1d1d' }}>
            ⚠ {error}
          </div>
        )}

        <button
          onClick={doLogin}
          disabled={!email.trim() || !pin.trim() || busy}
          className="mt-5 w-full rounded-xl py-3 text-sm font-bold uppercase tracking-wide disabled:opacity-50"
          style={{ background: '#7c3aed', color: '#fff' }}
        >
          {busy ? 'Signing in…' : 'View Dashboard'}
        </button>

        <div className="mt-4 pt-4 border-t text-center" style={{ borderColor: '#1e2535' }}>
          <button onClick={onBack} className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#475569' }}>
            ← Back to Employee Login
          </button>
        </div>
      </div>
    </div>
  );
}

/** Which top-level auth surface is showing before the employee app or the
 * dashboard takes over. 'checking' is the brief window where a stored
 * session token is being validated server-side on load — kept as its own
 * state (not just a boolean) so the login screen never flashes for an
 * already-logged-in employee/admin on a normal reload. */
type AuthView = 'checking' | 'employee-login' | 'admin-login' | 'employee-app' | 'dashboard';

function Shell() {
  const { screen, model, loginEmployee, logoutEmployee } = useApp();
  const isFinal = screen === 'final';

  const [authView, setAuthView] = React.useState<AuthView>('checking');
  const [adminUser, setAdminUser] = React.useState<SessionUser | null>(null);

  // On every app load: check for a stored employee session token first (an
  // employee session takes priority since it's the primary, most-used
  // flow), then an admin token, validating each server-side via
  // /api/auth/me before trusting it — never taking a client-stored value
  // at face value. An invalid/expired token is cleared and the login
  // screen shows instead.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const empToken = getEmployeeToken();
      if (empToken) {
        const result = await fetchMe(empToken);
        if (cancelled) return;
        if (result.ok && result.data.user.role === 'employee') {
          loginEmployee(result.data.user.id, result.data.user.name);
          setAuthView('employee-app');
          return;
        }
        clearEmployeeToken();
      }
      const adminToken = getAdminToken();
      if (adminToken) {
        const result = await fetchMe(adminToken);
        if (cancelled) return;
        if (result.ok && (result.data.user.role === 'manager' || result.data.user.role === 'ceo')) {
          setAdminUser(result.data.user);
          setAuthView('dashboard');
          return;
        }
        clearAdminToken();
      }
      if (!cancelled) setAuthView('employee-login');
    })();
    return () => { cancelled = true; };
    // Intentionally runs once on mount only — loginEmployee is a stable
    // useCallback from AppContext, re-running this on every model change
    // would re-validate the token on every keystroke elsewhere in the app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEmployeeLogout = React.useCallback(() => {
    const token = getEmployeeToken();
    if (token) apiLogout(token);
    clearEmployeeToken();
    logoutEmployee();
    setAuthView('employee-login');
  }, [logoutEmployee]);

  const handleAdminLogout = React.useCallback(() => {
    const token = getAdminToken();
    if (token) apiLogout(token);
    clearAdminToken();
    setAdminUser(null);
    setAuthView('employee-login');
  }, []);

  if (authView === 'checking') {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: '#0d1117', color: '#475569' }}>
        <div className="text-xs font-bold uppercase tracking-widest">Loading…</div>
      </div>
    );
  }

  if (authView === 'admin-login') {
    return (
      <AdminLoginScreen
        onBack={() => setAuthView('employee-login')}
        onSuccess={(user) => { setAdminUser(user); setAuthView('dashboard'); }}
      />
    );
  }

  if (authView === 'dashboard' && adminUser) {
    return <Dashboard user={adminUser} onLogout={handleAdminLogout} />;
  }

  if (authView !== 'employee-app' || !model.isLoggedIn) {
    return (
      <LoginScreen
        onOpenAdminLogin={() => setAuthView('admin-login')}
        onLoginSuccess={() => setAuthView('employee-app')}
      />
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#0d1117' }}>
      {!isFinal && <AppHeader />}
      {!isFinal && <DesktopHeader onLogout={handleEmployeeLogout} />}

      <div className="flex flex-1 overflow-hidden">
        {!isFinal && (
          <div className="hidden lg:flex">
            <Sidebar onLogout={handleEmployeeLogout} />
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
