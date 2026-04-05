/* eslint-disable react/prop-types */
import { useMemo, useState } from 'react';
import axios from 'axios';
import { Link, useSearchParams } from 'react-router';
import toast from 'react-hot-toast';
import { LANGUAGE_OPTIONS, DEFAULT_LANGUAGE } from '../components/Workspace/languages';

function encodeSharePayload(payload) {
    try {
        return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    } catch {
        return '';
    }
}

function decodeSharePayload(payload) {
    try {
        return JSON.parse(decodeURIComponent(escape(atob(payload))));
    } catch {
        return null;
    }
}

function InsightCard({ label, value, tone = 'default' }) {
    const toneClasses = {
        default: 'border-stone-200 bg-white dark:border-slate-800 dark:bg-slate-900',
        blue: 'border-blue-200 bg-blue-50/80 dark:border-blue-800/40 dark:bg-blue-950/20',
        emerald: 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-800/40 dark:bg-emerald-950/20',
        amber: 'border-amber-200 bg-amber-50/80 dark:border-amber-800/40 dark:bg-amber-950/20',
    };

    return (
        <div className={`rounded-3xl border p-5 shadow-sm ${toneClasses[tone]}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">{value || 'Not available'}</p>
        </div>
    );
}

function SolutionAnalyzer() {
    const serverUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();
    const [searchParams, setSearchParams] = useSearchParams();
    const sharedState = useMemo(() => decodeSharePayload(searchParams.get('share') || ''), [searchParams]);
    const [language, setLanguage] = useState(sharedState?.language || DEFAULT_LANGUAGE);
    const [code, setCode] = useState(sharedState?.code || '');
    const [prompt, setPrompt] = useState(sharedState?.prompt || '');
    const [analysis, setAnalysis] = useState(sharedState?.analysis || null);
    const [isLoading, setIsLoading] = useState(false);

    const handleAnalyse = async () => {
        if (!code.trim()) {
            toast.error('Paste a solution first.');
            return;
        }

        setIsLoading(true);
        try {
            const response = await axios.post(`${serverUrl}/api/ai/review`, {
                code,
                language,
                problem: {
                    title: 'Standalone solution analysis',
                    prompt: prompt || 'No specific problem statement provided.',
                },
            });

            const nextAnalysis = response.data;
            setAnalysis(nextAnalysis);
            const share = encodeSharePayload({ code, language, prompt, analysis: nextAnalysis });
            if (share) {
                setSearchParams({ share });
            }
            toast.success('Analysis ready');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to analyse solution');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyShare = async () => {
        const share = searchParams.get('share');
        if (!share) {
            toast.error('Run an analysis first.');
            return;
        }

        await navigator.clipboard.writeText(window.location.href);
        toast.success('Shareable analysis link copied');
    };

    return (
        <div className="min-h-screen bg-stone-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-white sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl space-y-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-600 dark:text-amber-400">Standalone Tool</p>
                        <h1 className="mt-2 text-4xl font-bold tracking-tight">Solution Analyser</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-400">
                            Paste any DSA solution, inspect its complexity and risks, and generate a shareable analysis link without opening a room.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={handleCopyShare}
                            className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-stone-300 hover:bg-stone-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                        >
                            Share your analysis
                        </button>
                        <Link
                            to="/"
                            className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                        >
                            Back to ForkSpace
                        </Link>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                    <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
                            <label className="space-y-2">
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Language</span>
                                <select
                                    value={language}
                                    onChange={(event) => setLanguage(event.target.value)}
                                    className="w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                >
                                    {Object.entries(LANGUAGE_OPTIONS).map(([key, value]) => (
                                        <option key={key} value={key}>{value.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="space-y-2">
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Problem context</span>
                                <input
                                    value={prompt}
                                    onChange={(event) => setPrompt(event.target.value)}
                                    placeholder="Optional: describe the problem or intended approach"
                                    className="w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                />
                            </label>
                        </div>
                        <label className="mt-5 block space-y-2">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Solution</span>
                            <textarea
                                value={code}
                                onChange={(event) => setCode(event.target.value)}
                                placeholder="// Paste any DSA solution here"
                                className="min-h-[460px] w-full rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-4 font-mono text-sm text-slate-900 outline-none transition focus:border-amber-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            />
                        </label>
                        <button
                            type="button"
                            onClick={handleAnalyse}
                            disabled={isLoading}
                            className="mt-5 inline-flex items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                        >
                            {isLoading ? 'Analysing...' : 'Analyse solution'}
                        </button>
                    </section>

                    <section className="space-y-4">
                        {analysis ? (
                            <>
                                <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                    <p className="text-sm leading-7 text-slate-700 dark:text-slate-300">{analysis.summary}</p>
                                    {analysis.complexity_reasoning ? (
                                        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-400">{analysis.complexity_reasoning}</p>
                                    ) : null}
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <InsightCard label="Time Complexity" value={analysis.time_complexity} tone="blue" />
                                    <InsightCard label="Space Complexity" value={analysis.space_complexity} tone="emerald" />
                                </div>
                                {analysis.bugs?.length > 0 ? (
                                    <div className="rounded-[2rem] border border-rose-200 bg-rose-50/80 p-6 shadow-sm dark:border-rose-800/40 dark:bg-rose-950/20">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-700 dark:text-rose-300">Bugs and missed edge cases</p>
                                        <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-7 text-rose-900 dark:text-rose-100">
                                            {analysis.bugs.slice(0, 3).map((bug, index) => <li key={`${bug}-${index}`}>{bug}</li>)}
                                        </ul>
                                    </div>
                                ) : null}
                                {analysis.optimization_suggestion ? (
                                    <div className="rounded-[2rem] border border-amber-200 bg-amber-50/80 p-6 shadow-sm dark:border-amber-800/40 dark:bg-amber-950/20">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">One concrete optimization</p>
                                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                                            <div className="rounded-2xl bg-white/80 p-4 dark:bg-slate-900/50">
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Before</p>
                                                <p className="mt-2 text-sm leading-7 text-slate-800 dark:text-slate-200">{analysis.optimization_suggestion.before}</p>
                                            </div>
                                            <div className="rounded-2xl bg-white/80 p-4 dark:bg-slate-900/50">
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">After</p>
                                                <p className="mt-2 text-sm leading-7 text-slate-800 dark:text-slate-200">{analysis.optimization_suggestion.after}</p>
                                            </div>
                                        </div>
                                        <p className="mt-4 text-sm leading-7 text-amber-900 dark:text-amber-100">{analysis.optimization_suggestion.benefit}</p>
                                    </div>
                                ) : null}
                            </>
                        ) : (
                            <div className="rounded-[2rem] border border-dashed border-stone-300 bg-white/70 p-8 text-sm leading-7 text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                                Run an analysis to get complexity, missed edge cases, and a shareable summary card.
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}

export default SolutionAnalyzer;
