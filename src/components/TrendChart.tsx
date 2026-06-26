"use client";

// Dependency-free SVG line chart for posture trends. Scales to its container width via viewBox.
export function TrendChart({
  points,
  label,
  suffix = "",
  color = "rgb(var(--brand-500))",
}: {
  points: number[];
  label: string;
  suffix?: string;
  color?: string;
}) {
  const w = 300;
  const h = 80;
  const pad = 6;
  const n = points.length;
  const max = Math.max(1, ...points);
  const min = Math.min(0, ...points);
  const range = max - min || 1;

  const x = (i: number) => (n <= 1 ? pad : pad + (i * (w - 2 * pad)) / (n - 1));
  const y = (v: number) => h - pad - ((v - min) / range) * (h - 2 * pad);

  const line = points.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = n > 1 ? `${x(0)},${h - pad} ${line} ${x(n - 1)},${h - pad}` : "";
  const latest = points[n - 1] ?? 0;
  const first = points[0] ?? 0;
  const delta = latest - first;

  return (
    <div className="stat-card">
      <div className="flex items-baseline justify-between">
        <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
        <div className="text-sm font-semibold text-slate-200">
          {latest}
          {suffix}
          {n > 1 && (
            <span className={`ml-2 text-xs ${delta > 0 ? "text-emerald-300" : delta < 0 ? "text-red-400" : "text-slate-500"}`}>
              {delta > 0 ? "▲" : delta < 0 ? "▼" : "■"} {Math.abs(delta)}
              {suffix}
            </span>
          )}
        </div>
      </div>
      {n <= 1 ? (
        <div className="mt-3 text-xs text-slate-500">Not enough history yet — trends appear after a few daily snapshots.</div>
      ) : (
        <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-20 w-full" preserveAspectRatio="none">
          <polygon points={area} fill={color} opacity={0.12} />
          <polyline points={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}
