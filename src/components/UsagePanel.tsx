import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useUsageSummary, useUsageDetails } from "../hooks/useProviders";
import { useWebSocket } from "../hooks/useWebSocket";

type Period = "today" | "week" | "month";

const PIE_COLORS = [
  "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6", "#06b6d4",
];

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function DonutChart({ entries, total }: { entries: [string, number][]; total: number }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 80;
  const innerR = 50;

  let cumAngle = -Math.PI / 2;
  const slices = entries.map(([name, value], i) => {
    const fraction = total > 0 ? value / total : 0;
    const angle = fraction * 2 * Math.PI;
    const startAngle = cumAngle;
    const endAngle = cumAngle + angle;
    cumAngle = endAngle;

    const largeArc = angle > Math.PI ? 1 : 0;
    const x1o = cx + outerR * Math.cos(startAngle);
    const y1o = cy + outerR * Math.sin(startAngle);
    const x2o = cx + outerR * Math.cos(endAngle);
    const y2o = cy + outerR * Math.sin(endAngle);
    const x1i = cx + innerR * Math.cos(endAngle);
    const y1i = cy + innerR * Math.sin(endAngle);
    const x2i = cx + innerR * Math.cos(startAngle);
    const y2i = cy + innerR * Math.sin(startAngle);

    const d = fraction > 0.001
      ? `M ${x1o} ${y1o} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2i} ${y2i} Z`
      : "";

    return { name, value, fraction, d, color: PIE_COLORS[i % PIE_COLORS.length] };
  });

  const hoveredSlice = hovered !== null ? slices[hovered] : null;

  return (
    <div className="flex items-center gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {slices.map((s, i) => s.d && (
            <path
              key={i}
              d={s.d}
              fill={s.color}
              opacity={hovered !== null && hovered !== i ? 0.4 : 1}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              className="cursor-pointer transition-opacity duration-150"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {hoveredSlice ? (
            <>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 max-w-[80px] truncate text-center">{hoveredSlice.name}</span>
              <span className="text-sm font-bold font-mono text-gray-900 dark:text-gray-100">{(hoveredSlice.fraction * 100).toFixed(1)}%</span>
              <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">{formatTokens(hoveredSlice.value)}</span>
            </>
          ) : (
            <>
              <span className="text-lg font-bold font-mono text-gray-900 dark:text-gray-100">{formatTokens(total)}</span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500">Total</span>
            </>
          )}
        </div>
      </div>
      <div className="flex-1 space-y-1.5">
        {slices.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-xs cursor-pointer"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className={`flex-1 truncate ${hovered === i ? "text-gray-900 dark:text-gray-100 font-medium" : "text-gray-500 dark:text-gray-400"}`}>
              {s.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function TrendLine({ details, period }: { details: { timestamp: number; promptTokens: number; completionTokens: number }[]; period: Period }) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState<number | null>(null);

  const buckets = useMemo(() => {
    const now = new Date();
    let startTs: number;
    let bucketCount: number;
    let bucketMs: number;
    let labels: string[];

    if (period === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      startTs = start.getTime();
      bucketCount = 24;
      bucketMs = 3600_000;
      labels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);
    } else if (period === "week") {
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
      startTs = monday.getTime();
      bucketCount = 7;
      bucketMs = 86400_000;
      const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      labels = dayLabels.map((d, i) => {
        const date = new Date(monday.getTime() + i * 86400_000);
        return `${d} ${date.getDate()}/${date.getMonth() + 1}`;
      });
    } else {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      startTs = firstDay.getTime();
      bucketCount = getDaysInMonth(now.getFullYear(), now.getMonth());
      bucketMs = 86400_000;
      labels = Array.from({ length: bucketCount }, (_, i) => `${i + 1}`);
    }

    const result: { ts: number; prompt: number; completion: number; label: string }[] = Array.from(
      { length: bucketCount },
      (_, i) => ({ ts: startTs + i * bucketMs, prompt: 0, completion: 0, label: labels[i] })
    );

    for (const d of details) {
      const idx = Math.floor((d.timestamp - startTs) / bucketMs);
      if (idx >= 0 && idx < bucketCount) {
        result[idx].prompt += d.promptTokens;
        result[idx].completion += d.completionTokens;
      }
    }
    return result;
  }, [details, period]);

  if (buckets.length === 0) return null;

  const w = 600;
  const h = 180;
  const padL = 50;
  const padR = 16;
  const padT = 12;
  const padB = 36;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const totals = buckets.map((b) => b.prompt + b.completion);
  const maxVal = Math.max(...totals, 1);

  const points = buckets.map((b, i) => {
    const x = buckets.length === 1 ? padL + chartW / 2 : padL + (i / (buckets.length - 1)) * chartW;
    const total = b.prompt + b.completion;
    const y = padT + chartH - (total / maxVal) * chartH;
    return { x, y, ...b, total };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = linePath + ` L ${points[points.length - 1].x} ${padT + chartH} L ${points[0].x} ${padT + chartH} Z`;

  const promptLine = points.map((p, i) => {
    const y = padT + chartH - (p.prompt / maxVal) * chartH;
    return `${i === 0 ? "M" : "L"} ${p.x} ${y}`;
  }).join(" ");

  const compLine = points.map((p, i) => {
    const y = padT + chartH - (p.completion / maxVal) * chartH;
    return `${i === 0 ? "M" : "L"} ${p.x} ${y}`;
  }).join(" ");

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((frac) => ({
    y: padT + chartH - frac * chartH,
    label: formatTokens(maxVal * frac),
  }));

  const hoveredPt = hovered !== null ? points[hovered] : null;

  return (
    <div className="relative">
      <svg
        width="100%"
        viewBox={`0 0 ${w} ${h}`}
        className="overflow-visible"
        onMouseLeave={() => setHovered(null)}
      >
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={padL} y1={g.y} x2={w - padR} y2={g.y} className="stroke-gray-200 dark:stroke-gray-700" strokeWidth={1} />
            <text x={padL - 8} y={g.y + 4} textAnchor="end" className="fill-gray-300 dark:fill-gray-600" fontSize={10} fontFamily="monospace">
              {g.label}
            </text>
          </g>
        ))}

        <text x={12} y={padT + chartH / 2} textAnchor="middle" className="fill-gray-400 dark:fill-gray-500" fontSize={10} transform={`rotate(-90, 12, ${padT + chartH / 2})`}>
          Tokens
        </text>

        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#areaGrad)" />
        <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={promptLine} fill="none" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="4 3" strokeLinejoin="round" opacity={0.7} />
        <path d={compLine} fill="none" stroke="#818cf8" strokeWidth={1.5} strokeDasharray="4 3" strokeLinejoin="round" opacity={0.7} />

        {points.map((p, i) => (
          <rect
            key={i}
            x={p.x - (chartW / buckets.length / 2)}
            y={padT}
            width={chartW / buckets.length}
            height={chartH}
            fill="transparent"
            onMouseEnter={() => setHovered(i)}
            className="cursor-crosshair"
          />
        ))}

        {hoveredPt && (
          <>
            <line x1={hoveredPt.x} y1={padT} x2={hoveredPt.x} y2={padT + chartH} className="stroke-gray-400 dark:stroke-gray-500" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={hoveredPt.x} cy={hoveredPt.y} r={4} fill="#3b82f6" stroke="white" strokeWidth={2} className="dark:stroke-gray-800" />
          </>
        )}

        {points.map((p, i) => {
          const step = period === "today" ? 3 : period === "month" ? Math.ceil(buckets.length / 10) : 1;
          if (i % step === 0 || i === buckets.length - 1) {
            return (
              <text key={i} x={p.x} y={padT + chartH + 16} textAnchor="middle" className="fill-gray-300 dark:fill-gray-600" fontSize={9} fontFamily="monospace">
                {p.label}
              </text>
            );
          }
          return null;
        })}

        <text x={padL + chartW / 2} y={h - 2} textAnchor="middle" className="fill-gray-400 dark:fill-gray-500" fontSize={10}>
          {t("usage.time")}
        </text>
      </svg>

      {hoveredPt && (
        <div className="absolute top-0 left-0 pointer-events-none" style={{ transform: `translate(${hoveredPt.x + 8}px, ${hoveredPt.y - 10}px)` }}>
          <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-xs whitespace-nowrap">
            <div className="font-mono text-gray-900 dark:text-gray-100 font-medium">{formatTokens(hoveredPt.total)} tokens</div>
            <div className="text-gray-400 dark:text-gray-500 mt-0.5">
              <span className="text-blue-500">{formatTokens(hoveredPt.prompt)}</span> prompt +{" "}
              <span className="text-indigo-500">{formatTokens(hoveredPt.completion)}</span> completion
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-5 mt-2 text-[11px] text-gray-400 dark:text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-blue-500 rounded" /> Total</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-blue-400 rounded" style={{ borderTop: "1.5px dashed #60a5fa", height: 0 }} /> Prompt</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-indigo-400 rounded" style={{ borderTop: "1.5px dashed #818cf8", height: 0 }} /> Completion</span>
      </div>
    </div>
  );
}

export default function UsagePanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>("today");
  const { data: summary, isFetching: fetchingSummary } = useUsageSummary(period);
  const { data: details = [], isFetching: fetchingDetails } = useUsageDetails(200);
  const { subscribe } = useWebSocket();

  // Real-time usage updates via WebSocket
  const [wsSummary, setWsSummary] = useState<typeof summary>(undefined);
  useEffect(() => {
    const unsub = subscribe("usage_update", (data) => {
      setWsSummary(data as typeof summary);
    });
    return unsub;
  }, [subscribe]);

  // Use WS data when viewing "today", otherwise use REST data
  const effectiveSummary = (period === "today" && wsSummary) ? wsSummary : summary;

  function handleRefresh() {
    qc.invalidateQueries({ queryKey: ["usage"] });
  }

  const providerEntries = Object.entries(effectiveSummary?.byProvider ?? {}).sort((a, b) => b[1] - a[1]);
  const modelEntries = Object.entries(effectiveSummary?.byModel ?? {}).sort((a, b) => b[1] - a[1]);

  function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString();
  }

  const isFetching = fetchingSummary || fetchingDetails;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {(["today", "week", "month"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
              period === p
                ? "bg-blue-600 text-white shadow-sm shadow-blue-200 dark:shadow-blue-900/50"
                : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:border-gray-500"
            }`}
          >
            {t(`usage.${p}`)}
          </button>
        ))}
        <button
          onClick={handleRefresh}
          disabled={isFetching}
          className="ml-auto p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          title={t("common.refresh")}
        >
          <svg
            className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="border border-gray-100 dark:border-gray-700 rounded-2xl p-5 bg-white/80 dark:bg-gray-800/80 text-center">
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-mono">
            {(effectiveSummary?.totalTokens ?? 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{t("usage.total_tokens")}</p>
        </div>
        <div className="border border-gray-100 dark:border-gray-700 rounded-2xl p-5 bg-white/80 dark:bg-gray-800/80 text-center">
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 font-mono">
            {(effectiveSummary?.totalPromptTokens ?? 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{t("usage.prompt_tokens")}</p>
        </div>
        <div className="border border-gray-100 dark:border-gray-700 rounded-2xl p-5 bg-white/80 dark:bg-gray-800/80 text-center">
          <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 font-mono">
            {(effectiveSummary?.totalCompletionTokens ?? 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{t("usage.completion_tokens")}</p>
        </div>
        <div className="border border-gray-100 dark:border-gray-700 rounded-2xl p-5 bg-white/80 dark:bg-gray-800/80 text-center">
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
            {(effectiveSummary?.requestCount ?? 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{t("usage.request_count")}</p>
        </div>
      </div>

      {providerEntries.length === 0 && modelEntries.length === 0 && details.length === 0 && (
        <div className="border border-gray-100 dark:border-gray-700 rounded-2xl p-8 bg-white/80 dark:bg-gray-800/80 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">{t("usage.no_data_hint")}</p>
        </div>
      )}

      {details.length > 0 && (
        <div className="border border-gray-100 dark:border-gray-700 rounded-2xl p-5 bg-white/80 dark:bg-gray-800/80">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">{t("usage.trend")}</h3>
          <TrendLine details={details} period={period} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {providerEntries.length > 0 && (
          <div className="border border-gray-100 dark:border-gray-700 rounded-2xl p-5 bg-white/80 dark:bg-gray-800/80">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">{t("usage.provider_ratio")}</h3>
            <DonutChart entries={providerEntries} total={effectiveSummary?.totalTokens ?? 0} />
          </div>
        )}

        {modelEntries.length > 0 && (
          <div className="border border-gray-100 dark:border-gray-700 rounded-2xl p-5 bg-white/80 dark:bg-gray-800/80">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">{t("usage.model_ratio")}</h3>
            <DonutChart entries={modelEntries.slice(0, 8)} total={effectiveSummary?.totalTokens ?? 0} />
          </div>
        )}
      </div>

      {details.length > 0 && (
        <div className="border border-gray-100 dark:border-gray-700 rounded-2xl bg-white/80 dark:bg-gray-800/80 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t("usage.recent_details")}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs">
                  <th className="text-left px-4 py-3 font-medium">{t("usage.time")}</th>
                  <th className="text-left px-4 py-3 font-medium">{t("usage.provider")}</th>
                  <th className="text-left px-4 py-3 font-medium">{t("usage.model")}</th>
                  <th className="text-right px-4 py-3 font-medium">{t("usage.prompt")}</th>
                  <th className="text-right px-4 py-3 font-medium">{t("usage.completion")}</th>
                  <th className="text-right px-4 py-3 font-medium">{t("usage.total")}</th>
                </tr>
              </thead>
              <tbody>
                {details.map((r, i) => (
                  <tr
                    key={i}
                    className={`border-t border-gray-50 dark:border-gray-700/50 ${i % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50/50 dark:bg-gray-800/50"}`}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500 dark:text-gray-400">
                      {formatTime(r.timestamp)}
                    </td>
                    <td className="px-4 py-2.5 text-xs dark:text-gray-300">{r.providerName}</td>
                    <td className="px-4 py-2.5 font-mono text-xs dark:text-gray-300">{r.model}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs dark:text-gray-300">{r.promptTokens}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs dark:text-gray-300">{r.completionTokens}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs font-medium dark:text-gray-300">
                      {r.totalTokens}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
