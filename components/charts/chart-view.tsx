"use client";

import type { ChartResult } from "@/lib/crm/chart-query";
import type { ChartType } from "@/lib/crm/types";

const SERIES = ["#4f46e5", "#111827", "#0f766e", "#b45309", "#64748b"];

function color(i: number) {
  return SERIES[i % SERIES.length]!;
}

function maxValue(result: ChartResult) {
  let m = 0;
  for (const s of result.series) for (const v of s.values) if (v > m) m = v;
  return m || 1;
}

function formatNum(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1000)}k`;
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

export function ChartView({
  result,
  chartType,
  height = 280,
}: {
  result: ChartResult;
  chartType: ChartType;
  height?: number;
}) {
  if (result.error) {
    return <p className="px-4 py-10 text-center text-sm text-muted">{result.error}</p>;
  }
  if (!result.labels.length) {
    return <p className="px-4 py-10 text-center text-sm text-muted">No records match this chart yet.</p>;
  }
  if (chartType === "table") return <ChartTable result={result} />;
  if (chartType === "pie" || chartType === "donut") return <PieView result={result} donut={chartType === "donut"} />;
  return <CartesianView result={result} kind={chartType} height={height} />;
}

function Legend({ names }: { names: string[] }) {
  if (names.length < 2) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-3 px-1">
      {names.map((n, i) => (
        <span key={n} className="inline-flex items-center gap-1.5 text-[11px] text-muted">
          <span className="inline-block size-2 rounded-sm" style={{ background: color(i) }} />
          {n}
        </span>
      ))}
    </div>
  );
}

function CartesianView({
  result,
  kind,
  height,
}: {
  result: ChartResult;
  kind: "bar" | "line" | "area";
  height: number;
}) {
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 36;
  const w = Math.max(360, result.labels.length * 56);
  const innerW = w - padL - padR;
  const innerH = height - padT - padB;
  const max = maxValue(result);
  const n = result.labels.length;
  const groupW = innerW / n;
  const seriesCount = result.series.length;
  const barW = Math.min(22, (groupW * 0.7) / seriesCount);

  const yFor = (v: number) => padT + innerH - (v / max) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => p * max);

  return (
    <div>
      <Legend names={result.series.map((s) => s.name)} />
      <div className="overflow-x-auto">
        <svg width={w} height={height} role="img" aria-label={result.title}>
          {ticks.map((t) => {
            const y = yFor(t);
            return (
              <g key={t}>
                <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="#eceef3" strokeWidth={1} />
                <text x={padL - 6} y={y + 3} textAnchor="end" fill="#667085" fontSize={10}>
                  {formatNum(t)}
                </text>
              </g>
            );
          })}
          {result.labels.map((label, i) => {
            const cx = padL + groupW * i + groupW / 2;
            return (
              <text key={`${label}-${i}`} x={cx} y={height - 8} textAnchor="middle" fill="#667085" fontSize={10}>
                {label.length > 12 ? `${label.slice(0, 11)}…` : label}
              </text>
            );
          })}
          {kind === "bar"
            ? result.series.map((s, si) =>
                s.values.map((v, i) => {
                  const cx = padL + groupW * i + groupW / 2;
                  const x = cx - (seriesCount * barW) / 2 + si * barW;
                  const y = yFor(v);
                  const h = Math.max(0, padT + innerH - y);
                  return <rect key={`${s.name}-${i}`} x={x} y={y} width={barW - 2} height={h} fill={color(si)} rx={2} />;
                }),
              )
            : result.series.map((s, si) => {
                const pts = s.values.map((v, i) => {
                  const x = padL + groupW * i + groupW / 2;
                  return `${x},${yFor(v)}`;
                });
                const line = pts.join(" ");
                const area = `${padL + groupW / 2},${padT + innerH} ${line} ${padL + groupW * (n - 1) + groupW / 2},${padT + innerH}`;
                return (
                  <g key={s.name}>
                    {kind === "area" ? <polygon points={area} fill={color(si)} opacity={0.12} /> : null}
                    <polyline points={line} fill="none" stroke={color(si)} strokeWidth={2} strokeLinejoin="round" />
                    {s.values.map((v, i) => (
                      <circle key={i} cx={padL + groupW * i + groupW / 2} cy={yFor(v)} r={3} fill={color(si)} />
                    ))}
                  </g>
                );
              })}
        </svg>
      </div>
    </div>
  );
}

function PieView({ result, donut }: { result: ChartResult; donut: boolean }) {
  const values = result.series[0]?.values ?? [];
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const r = 84;
  const inner = donut ? 48 : 0;
  let angle = -Math.PI / 2;
  const slices = result.labels.map((label, i) => {
    const v = values[i] ?? 0;
    const sweep = (v / total) * Math.PI * 2;
    const a1 = angle;
    const a2 = angle + sweep;
    angle = a2;
    return { label, v, a1, a2, fill: color(i) };
  });

  function arc(a1: number, a2: number, radius: number) {
    const x1 = cx + radius * Math.cos(a1);
    const y1 = cy + radius * Math.sin(a1);
    const x2 = cx + radius * Math.cos(a2);
    const y2 = cy + radius * Math.sin(a2);
    const large = a2 - a1 > Math.PI ? 1 : 0;
    return { x1, y1, x2, y2, large };
  }

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg width={size} height={size} role="img" aria-label={result.title}>
        {slices.map((s, i) => {
          if (s.v <= 0) return null;
          const outer = arc(s.a1, s.a2, r);
          if (!inner) {
            return (
              <path
                key={i}
                d={`M ${cx} ${cy} L ${outer.x1} ${outer.y1} A ${r} ${r} 0 ${outer.large} 1 ${outer.x2} ${outer.y2} Z`}
                fill={s.fill}
              />
            );
          }
          return (
            <path
              key={i}
              d={`M ${outer.x1} ${outer.y1} A ${r} ${r} 0 ${outer.large} 1 ${outer.x2} ${outer.y2} L ${cx + inner * Math.cos(s.a2)} ${cy + inner * Math.sin(s.a2)} A ${inner} ${inner} 0 ${outer.large} 0 ${cx + inner * Math.cos(s.a1)} ${cy + inner * Math.sin(s.a1)} Z`}
              fill={s.fill}
            />
          );
        })}
        {donut ? (
          <text x={cx} y={cy + 4} textAnchor="middle" fill="#111827" fontSize={14} fontWeight={650}>
            {formatNum(total)}
          </text>
        ) : null}
      </svg>
      <div className="min-w-[160px] space-y-1.5">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-4 text-[12px]">
            <span className="inline-flex items-center gap-1.5 text-ink">
              <span className="inline-block size-2 rounded-sm" style={{ background: s.fill }} />
              {s.label}
            </span>
            <span className="tabular-nums text-muted">{formatNum(s.v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartTable({ result }: { result: ChartResult }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[12px]">
        <thead>
          <tr className="border-b border-border-soft text-[11px] uppercase tracking-wide text-muted">
            <th className="py-2 pr-3 font-semibold">{result.dimensionLabel}</th>
            {result.series.map((s) => (
              <th key={s.name} className="py-2 pr-3 font-semibold">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row) => (
            <tr key={row.label} className="border-b border-[#f0f1f5]">
              <td className="py-1.5 pr-3 font-medium text-ink">{row.label}</td>
              {result.series.map((s) => (
                <td key={s.name} className="py-1.5 pr-3 tabular-nums text-muted">
                  {formatNum(row.values[s.name] ?? 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
