/* eslint-disable react/prop-types */
/**
 * Visual dashboard for Session Intelligence report data (embedded + share page).
 * Presentational only — same fields as API report object.
 */

function clampScore(value) {
    const n = Number(value);
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
}

/** Remove duplicate lines while preserving order (backend can repeat filler lines). */
function dedupeStrings(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    for (const item of list) {
        const s = typeof item === 'string' ? item.trim() : String(item ?? '').trim();
        if (!s || seen.has(s)) continue;
        seen.add(s);
        out.push(s);
    }
    return out;
}

function ScoreRing({ score, className = '' }) {
    const n = clampScore(score);
    const r = 44;
    const c = 2 * Math.PI * r;
    const offset = c - (n / 100) * c;

    return (
        <div className={`relative flex shrink-0 items-center justify-center ${className}`}>
            <svg viewBox="0 0 112 112" className="h-28 w-28 sm:h-32 sm:w-32" aria-hidden>
                <circle
                    cx="56"
                    cy="56"
                    r={r}
                    fill="none"
                    className="stroke-gray-200/90 dark:stroke-slate-700"
                    strokeWidth="10"
                />
                <circle
                    cx="56"
                    cy="56"
                    r={r}
                    fill="none"
                    className="stroke-amber-500 drop-shadow-[0_0_12px_rgba(245,158,11,0.45)]"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={c}
                    strokeDashoffset={offset}
                    transform="rotate(-90 56 56)"
                />
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-white sm:text-4xl">
                    {n}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                    score
                </span>
            </div>
        </div>
    );
}

function SectionDivider({ label }) {
    return (
        <div className="flex items-center gap-3 py-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-slate-700" />
            {label ? (
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                    {label}
                </span>
            ) : null}
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-slate-700" />
        </div>
    );
}

export default function SessionIntelligenceReportDashboard({
    report,
    title = 'Practice session',
    subtitle = 'Based on runs, checklist, and reviews in this session.',
    variant = 'embedded',
}) {
    if (!report) return null;

    const pad = variant === 'standalone' ? 'p-6 sm:p-8' : 'p-4 sm:p-5';
    const shell =
        variant === 'standalone'
            ? 'overflow-hidden rounded-[1.35rem] border border-gray-200/90 bg-white/90 shadow-[0_4px_40px_-12px_rgba(15,23,42,0.2),0_0_0_1px_rgba(251,191,36,0.12)] dark:border-slate-700/90 dark:bg-slate-950/50 dark:shadow-[0_4px_48px_-16px_rgba(0,0,0,0.65),0_0_0_1px_rgba(251,191,36,0.08)]'
            : 'overflow-hidden rounded-[1.15rem] border-0 bg-transparent shadow-none ring-0';

    const strongest = dedupeStrings(report.strongestSignals);
    const gaps = dedupeStrings(report.biggestGaps);
    const steps = dedupeStrings(report.nextSteps);
    const targets = dedupeStrings(report.nextPracticeTargets);

    return (
        <div className={`${shell} ${pad} space-y-1`}>
            {/* Score hero */}
            <div className="relative overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50/95 via-white to-orange-50/50 px-5 py-7 shadow-sm dark:border-amber-900/45 dark:from-amber-950/55 dark:via-slate-900/85 dark:to-slate-950/90 sm:px-7 sm:py-8">
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-400/15 blur-3xl dark:bg-amber-500/10" />
                <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-orange-300/10 blur-3xl dark:bg-orange-500/5" />
                <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-800/90 dark:text-amber-300/90">
                            Session score
                        </p>
                        <h2 className="text-xl font-bold leading-tight tracking-tight text-gray-900 dark:text-white sm:text-2xl">
                            {title}
                        </h2>
                        <p className="max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-400">{subtitle}</p>
                    </div>
                    <ScoreRing score={report.sessionScore} />
                </div>
            </div>

            {/* Insight — blue */}
            <div className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/95 to-white p-5 shadow-sm dark:border-sky-900/45 dark:from-sky-950/40 dark:to-slate-900/70">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-800 dark:text-sky-300">
                    How you think
                </p>
                <p className="mt-3 line-clamp-4 text-sm font-medium leading-relaxed text-sky-950 dark:text-sky-50">
                    {report.howYouThink || '—'}
                </p>
            </div>

            <SectionDivider label="Signals & gaps" />

            <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
                {/* Strengths — green */}
                <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-5 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:text-emerald-300">
                        Strongest signals
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        {strongest.length ? (
                            strongest.map((s, i) => (
                                <span
                                    key={i}
                                    className="inline-flex max-w-full items-start gap-2 rounded-xl border border-emerald-200/90 bg-white/90 px-3 py-2.5 text-xs font-medium leading-snug text-emerald-950 shadow-sm dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-50"
                                >
                                    <svg
                                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2.5}
                                        aria-hidden
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>{s}</span>
                                </span>
                            ))
                        ) : (
                            <p className="text-xs text-gray-500 dark:text-gray-400">No signals listed.</p>
                        )}
                    </div>
                </div>

                {/* Gaps — amber / orange */}
                <div className="rounded-2xl border border-amber-200/90 bg-amber-50/50 p-5 shadow-sm dark:border-amber-900/45 dark:bg-amber-950/25">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-900 dark:text-amber-300">
                        Biggest gaps
                    </p>
                    <div className="mt-4 space-y-2.5">
                        {gaps.length ? (
                            gaps.map((g, i) => (
                                <div
                                    key={i}
                                    className="flex gap-3 rounded-xl border border-orange-200/80 bg-white/90 px-3.5 py-3 shadow-sm dark:border-orange-900/40 dark:bg-orange-950/30"
                                >
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-950/70 dark:text-orange-200">
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                    <p className="min-w-0 text-sm font-medium leading-snug text-orange-950 dark:text-orange-50">{g}</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-gray-500 dark:text-gray-400">No gaps listed.</p>
                        )}
                    </div>
                </div>
            </div>

            <SectionDivider label="Next" />

            {/* Next steps — blue action */}
            <div className="rounded-2xl border border-blue-200/75 bg-blue-50/45 p-5 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/25">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-900 dark:text-blue-300">
                    Next steps
                </p>
                <ol className="mt-4 space-y-2.5">
                    {steps.length ? (
                        steps.map((s, i) => (
                            <li
                                key={i}
                                className="flex gap-3 rounded-xl border border-blue-200/60 bg-white/90 px-3.5 py-3 text-sm font-medium leading-snug text-blue-950 shadow-sm dark:border-blue-900/35 dark:bg-slate-900/50 dark:text-blue-50"
                            >
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white dark:bg-blue-700">
                                    {i + 1}
                                </span>
                                <span className="min-w-0 pt-0.5">{s}</span>
                            </li>
                        ))
                    ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400">No next steps listed.</p>
                    )}
                </ol>
            </div>

            {/* Practice targets */}
            <div className="rounded-2xl border border-violet-200/70 bg-violet-50/40 p-5 shadow-sm dark:border-violet-900/40 dark:bg-violet-950/20">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-900 dark:text-violet-300">
                    Next practice targets
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                    {targets.length ? (
                        targets.map((t, i) => (
                            <span
                                key={i}
                                className="inline-flex items-center rounded-full border border-violet-200/90 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-violet-950 shadow-sm dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-100"
                            >
                                {t}
                            </span>
                        ))
                    ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400">No targets listed.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
