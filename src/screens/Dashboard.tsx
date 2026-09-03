import React from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area, Cell,
} from 'recharts';
import { getAdminToken, type SessionUser } from '../auth/authClient';

// ─────────────────────────────────────────────────────────────────────────────
// Manager/CEO KPI Dashboard — everything on this screen requires an admin
// session (validated server-side by every /api/dashboard/* route via
// requireAdmin); this component never receives or trusts data for a role
// other than manager/ceo.
// ─────────────────────────────────────────────────────────────────────────────

const BG = '#0d1117';
const CARD_BG = '#111827';
const BORDER = '#243045';
const TEXT = '#e2e8f0';
const MUTED = '#64748b';
const ACCENT = '#7c3aed';

const SERIES_COLORS = ['#3b82f6', '#7c3aed', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#f97316', '#a855f7', '#14b8a6', '#eab308'];

type RangePreset = '7d' | '30d' | '90d' | 'all';

function rangeToDates(preset: RangePreset): { from: string; to: string } {
  const to = new Date();
  if (preset === 'all') return { from: new Date(2020, 0, 1).toISOString(), to: to.toISOString() };
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

interface SummaryData {
  totalDrawings: number;
  activeEmployees: number;
  mostActiveEmployee: { id: string; name: string; count: number } | null;
  mostMeasuredProduct: { product_name: string; count: number } | null;
}

interface ByEmployeeProductRow {
  employee_id: string;
  employee_name: string;
  product_name: string;
  count: number;
}

interface ByProductRow {
  product_name: string;
  count: number;
}

interface TimelineRow {
  bucket: string;
  count: number;
}

async function fetchAdmin<T>(path: string): Promise<T | null> {
  const token = getAdminToken();
  if (!token) return null;
  try {
    const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function Dashboard({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [preset, setPreset] = React.useState<RangePreset>('30d');
  const [summary, setSummary] = React.useState<SummaryData | null>(null);
  const [byEmployeeProduct, setByEmployeeProduct] = React.useState<ByEmployeeProductRow[]>([]);
  const [byProduct, setByProduct] = React.useState<ByProductRow[]>([]);
  const [timeline, setTimeline] = React.useState<TimelineRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedEmployee, setSelectedEmployee] = React.useState<string | null>(null);
  const [sortBy, setSortBy] = React.useState<'total' | 'name'>('total');

  const { from, to } = React.useMemo(() => rangeToDates(preset), [preset]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    Promise.all([
      fetchAdmin<SummaryData>(`/api/dashboard/summary${qs}`),
      fetchAdmin<{ rows: ByEmployeeProductRow[] }>(`/api/dashboard/by-employee-product${qs}`),
      fetchAdmin<{ rows: ByProductRow[] }>(`/api/dashboard/by-product${qs}`),
      fetchAdmin<{ rows: TimelineRow[] }>(`/api/dashboard/timeline${qs}&granularity=day`),
    ]).then(([s, bep, bp, tl]) => {
      if (cancelled) return;
      setSummary(s);
      setByEmployeeProduct(bep?.rows ?? []);
      setByProduct(bp?.rows ?? []);
      setTimeline(tl?.rows ?? []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [from, to]);

  // Pivot the flat employee×product rows into a matrix: one row per
  // employee, one column per product that appears anywhere in the data.
  const products = React.useMemo(() => {
    const set = new Set<string>();
    byEmployeeProduct.forEach((r) => set.add(r.product_name));
    return Array.from(set).sort();
  }, [byEmployeeProduct]);

  const employeeRows = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; counts: Record<string, number>; total: number }>();
    for (const r of byEmployeeProduct) {
      if (!map.has(r.employee_id)) map.set(r.employee_id, { id: r.employee_id, name: r.employee_name, counts: {}, total: 0 });
      const entry = map.get(r.employee_id)!;
      entry.counts[r.product_name] = r.count;
      entry.total += r.count;
    }
    const rows = Array.from(map.values());
    rows.sort((a, b) => (sortBy === 'total' ? b.total - a.total : a.name.localeCompare(b.name)));
    return rows;
  }, [byEmployeeProduct, sortBy]);

  const stackedChartData = React.useMemo(
    () => employeeRows.map((r) => ({ name: r.name, ...r.counts })),
    [employeeRows],
  );

  const timelineChartData = React.useMemo(
    () => timeline.map((t) => ({ date: new Date(t.bucket).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), count: t.count })),
    [timeline],
  );

  const drillDownRows = selectedEmployee
    ? byEmployeeProduct.filter((r) => r.employee_id === selectedEmployee)
    : [];

  return (
    <div className="h-screen overflow-y-auto" style={{ background: BG, color: TEXT }}>
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 px-5 py-4 border-b" style={{ background: BG, borderColor: BORDER }}>
        <span className="text-2xl">📊</span>
        <div>
          <div className="text-sm font-black">SmartMeasure <span style={{ color: ACCENT }}>KPI Dashboard</span></div>
          <div className="text-[11px]" style={{ color: MUTED }}>{user.name} · {user.role.toUpperCase()}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {(['7d', '30d', '90d', 'all'] as RangePreset[]).map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase"
              style={{ background: preset === p ? ACCENT : '#1e2535', color: preset === p ? '#fff' : MUTED }}
            >
              {p === 'all' ? 'All Time' : `Last ${p}`}
            </button>
          ))}
          <button
            onClick={onLogout}
            className="ml-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase"
            style={{ background: '#1e2535', color: MUTED, border: `1px solid ${BORDER}` }}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="p-5 flex flex-col gap-6">
        {loading && <div className="text-xs" style={{ color: MUTED }}>Loading dashboard…</div>}

        {/* KPI summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Total Drawings" value={summary?.totalDrawings ?? '—'} icon="📐" />
          <KpiCard label="Active Employees" value={summary?.activeEmployees ?? '—'} icon="👥" />
          <KpiCard
            label="Most Active Employee"
            value={summary?.mostActiveEmployee ? `${summary.mostActiveEmployee.name}` : '—'}
            sub={summary?.mostActiveEmployee ? `${summary.mostActiveEmployee.count} drawings` : undefined}
            icon="🏆"
          />
          <KpiCard
            label="Most-Measured Product"
            value={summary?.mostMeasuredProduct?.product_name ?? '—'}
            sub={summary?.mostMeasuredProduct ? `${summary.mostMeasuredProduct.count} drawings` : undefined}
            icon="📦"
          />
        </div>

        {/* Timeline */}
        <ChartCard title="Drawings Generated Over Time">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={timelineChartData}>
              <CartesianGrid stroke="#1e2535" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: MUTED, fontSize: 10 }} stroke={BORDER} />
              <YAxis tick={{ fill: MUTED, fontSize: 10 }} stroke={BORDER} allowDecimals={false} />
              <Tooltip contentStyle={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="count" stroke={ACCENT} fill={ACCENT} fillOpacity={0.25} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Stacked bar: per-employee product mix */}
          <ChartCard title="Per-Employee Product Mix">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stackedChartData} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid stroke="#1e2535" strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fill: MUTED, fontSize: 10 }} stroke={BORDER} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: TEXT, fontSize: 11 }} stroke={BORDER} width={100} />
                <Tooltip contentStyle={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {products.map((p, i) => (
                  <Bar key={p} dataKey={p} stackId="a" fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Product totals */}
          <ChartCard title="Total Drawings per Product (Company-wide)">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byProduct}>
                <CartesianGrid stroke="#1e2535" strokeDasharray="3 3" />
                <XAxis dataKey="product_name" tick={{ fill: MUTED, fontSize: 9 }} stroke={BORDER} angle={-30} textAnchor="end" height={70} interval={0} />
                <YAxis tick={{ fill: MUTED, fontSize: 10 }} stroke={BORDER} allowDecimals={false} />
                <Tooltip contentStyle={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {byProduct.map((_, i) => <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Leaderboard */}
        <ChartCard title="Employee Leaderboard">
          <ResponsiveContainer width="100%" height={Math.max(160, employeeRows.length * 34)}>
            <BarChart data={employeeRows.map((r) => ({ name: r.name, total: r.total }))} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid stroke="#1e2535" strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fill: MUTED, fontSize: 10 }} stroke={BORDER} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: TEXT, fontSize: 11 }} stroke={BORDER} width={100} />
              <Tooltip contentStyle={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="total" fill={ACCENT} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Per-employee × per-product matrix table */}
        <div className="rounded-2xl border p-4" style={{ background: CARD_BG, borderColor: BORDER }}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold">Employee × Product Breakdown</div>
            <div className="flex items-center gap-2 text-[10px]" style={{ color: MUTED }}>
              Sort by:
              <button onClick={() => setSortBy('total')} className="px-2 py-1 rounded" style={{ background: sortBy === 'total' ? '#1e2535' : 'transparent', color: sortBy === 'total' ? TEXT : MUTED }}>Total ↓</button>
              <button onClick={() => setSortBy('name')} className="px-2 py-1 rounded" style={{ background: sortBy === 'name' ? '#1e2535' : 'transparent', color: sortBy === 'name' ? TEXT : MUTED }}>Name A–Z</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <th className="text-left py-2 pr-4" style={{ color: MUTED }}>Employee</th>
                  {products.map((p) => (
                    <th key={p} className="text-right py-2 px-3" style={{ color: MUTED, fontWeight: 600 }}>{p}</th>
                  ))}
                  <th className="text-right py-2 pl-3" style={{ color: MUTED }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {employeeRows.map((row) => {
                  const topProduct = Object.entries(row.counts).sort((a, b) => b[1] - a[1])[0]?.[0];
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedEmployee(row.id === selectedEmployee ? null : row.id)}
                      className="cursor-pointer"
                      style={{ borderBottom: `1px solid #1a2233`, background: selectedEmployee === row.id ? '#132038' : 'transparent' }}
                    >
                      <td className="py-2 pr-4 font-semibold">{row.name} <span style={{ color: MUTED, fontWeight: 400 }}>({row.id})</span></td>
                      {products.map((p) => (
                        <td key={p} className="text-right py-2 px-3" style={{ color: p === topProduct ? '#4ade80' : TEXT, fontWeight: p === topProduct ? 700 : 400 }}>
                          {row.counts[p] ?? 0}
                        </td>
                      ))}
                      <td className="text-right py-2 pl-3 font-bold">{row.total}</td>
                    </tr>
                  );
                })}
                {employeeRows.length === 0 && !loading && (
                  <tr><td colSpan={products.length + 2} className="text-center py-4" style={{ color: MUTED }}>No drawings logged in this range.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-[10px]" style={{ color: MUTED }}>Click a row to drill into that employee's own history below.</div>
        </div>

        {selectedEmployee && (
          <div className="rounded-2xl border p-4" style={{ background: CARD_BG, borderColor: BORDER }}>
            <div className="text-sm font-bold mb-2">
              Drill-down — {employeeRows.find((r) => r.id === selectedEmployee)?.name}
            </div>
            <div className="flex flex-col gap-1.5">
              {drillDownRows.sort((a, b) => b.count - a.count).map((r) => (
                <div key={r.product_name} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg" style={{ background: '#0f172a' }}>
                  <span>{r.product_name}</span>
                  <span className="font-bold">{r.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function KpiCard({ label, value, sub, icon }: { label: string; value: React.ReactNode; sub?: string; icon: string }) {
  return (
    <div className="rounded-2xl border p-4" style={{ background: CARD_BG, borderColor: BORDER }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: MUTED }}>{label}</span>
      </div>
      <div className="text-xl font-black truncate" title={typeof value === 'string' ? value : undefined}>{value}</div>
      {sub && <div className="text-[10px] mt-0.5" style={{ color: MUTED }}>{sub}</div>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-4" style={{ background: CARD_BG, borderColor: BORDER }}>
      <div className="text-sm font-bold mb-3">{title}</div>
      {children}
    </div>
  );
}
