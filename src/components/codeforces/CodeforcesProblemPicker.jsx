/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

const defaultFilters = {
    tags: '',
    minRating: '',
    maxRating: '',
    minSolved: '',
    maxSolved: '',
    search: '',
};

/**
 * Large modal to browse Codeforces problems from the server catalog (cached API).
 */
function CodeforcesProblemPicker({ isOpen, onClose, onSelect, serverUrl }) {
    const [filters, setFilters] = useState(defaultFilters);
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(false);
    const [warning, setWarning] = useState('');
    const limit = 40;

    const fetchWithFilters = useCallback(
        async (nextOffset, append, filterValues) => {
            const f = filterValues || filters;
            setLoading(true);
            setWarning('');
            try {
                const params = new URLSearchParams();
                if (f.tags.trim()) params.set('tags', f.tags.trim());
                if (f.minRating.trim()) params.set('minRating', f.minRating.trim());
                if (f.maxRating.trim()) params.set('maxRating', f.maxRating.trim());
                if (f.minSolved.trim()) params.set('minSolved', f.minSolved.trim());
                if (f.maxSolved.trim()) params.set('maxSolved', f.maxSolved.trim());
                if (f.search.trim()) params.set('search', f.search.trim());
                params.set('limit', String(limit));
                params.set('offset', String(nextOffset));

                const { data } = await axios.get(
                    `${serverUrl}/api/codeforces/problems?${params.toString()}`,
                );
                setTotal(typeof data.total === 'number' ? data.total : 0);
                setOffset(nextOffset);
                if (append) {
                    setRows((prev) => [...prev, ...(data.rows || [])]);
                } else {
                    setRows(data.rows || []);
                }
                if (data.warning) {
                    setWarning(data.warning);
                }
            } catch (error) {
                setWarning(error.response?.data?.error || error.message || 'Failed to load catalog');
            } finally {
                setLoading(false);
            }
        },
        [filters, limit, serverUrl],
    );

    useEffect(() => {
        if (!isOpen) return;
        fetchWithFilters(0, false);
    }, [isOpen, fetchWithFilters]);

    if (!isOpen) return null;

    const handleSearch = (event) => {
        event.preventDefault();
        fetchWithFilters(0, false);
    };

    const loadMore = () => {
        if (loading || rows.length >= total) return;
        fetchWithFilters(offset + limit, true);
    };

    return (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/65 p-2 backdrop-blur-md sm:p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="cf-picker-title"
                className="flex h-[min(92vh,920px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-[0_24px_80px_-24px_rgba(15,23,42,0.45)] ring-1 ring-black/5 dark:border-slate-700/90 dark:bg-[#060d18] dark:shadow-[0_32px_100px_-32px_rgba(0,0,0,0.85)] dark:ring-white/5"
            >
                {/* Title bar — fixed height */}
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-stone-200/90 px-5 py-4 sm:px-7 sm:py-5 dark:border-slate-700/80">
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                            Codeforces catalog
                        </p>
                        <h3
                            id="cf-picker-title"
                            className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl"
                        >
                            Pick a problem
                        </h3>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                            Filter by tags, rating, and solves. Data is cached on the server — scroll results while filters stay visible.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-white text-stone-600 transition hover:border-stone-300 hover:bg-stone-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        aria-label="Close"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Scroll region: sticky filters + results */}
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                    {warning && (
                        <div className="mx-5 mt-4 rounded-xl border border-amber-200 bg-amber-50/95 px-4 py-3 text-sm text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/35 dark:text-amber-100 sm:mx-7">
                            {warning}
                        </div>
                    )}

                    <div className="sticky top-0 z-10 border-b border-stone-200/90 bg-white/95 px-5 py-4 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.15)] backdrop-blur-md dark:border-slate-700/80 dark:bg-[#060d18]/95 sm:px-7">
                        <form onSubmit={handleSearch} className="space-y-4">
                            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                                <label className="space-y-1.5 lg:col-span-2">
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                        Tags (comma, AND)
                                    </span>
                                    <input
                                        value={filters.tags}
                                        onChange={(e) => setFilters((f) => ({ ...f, tags: e.target.value }))}
                                        placeholder="dp, greedy"
                                        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                                    />
                                </label>
                                <label className="space-y-1.5 lg:col-span-2">
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                        Search title / id
                                    </span>
                                    <input
                                        value={filters.search}
                                        onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                                        placeholder="e.g. 1885 or xor"
                                        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                                    />
                                </label>
                                <label className="space-y-1.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                        Min rating
                                    </span>
                                    <input
                                        type="number"
                                        value={filters.minRating}
                                        onChange={(e) => setFilters((f) => ({ ...f, minRating: e.target.value }))}
                                        placeholder="800"
                                        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                                    />
                                </label>
                                <label className="space-y-1.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                        Max rating
                                    </span>
                                    <input
                                        type="number"
                                        value={filters.maxRating}
                                        onChange={(e) => setFilters((f) => ({ ...f, maxRating: e.target.value }))}
                                        placeholder="2000"
                                        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                                    />
                                </label>
                                <label className="space-y-1.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                        Min solves
                                    </span>
                                    <input
                                        type="number"
                                        value={filters.minSolved}
                                        onChange={(e) => setFilters((f) => ({ ...f, minSolved: e.target.value }))}
                                        placeholder="0"
                                        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                                    />
                                </label>
                                <label className="space-y-1.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                        Max solves
                                    </span>
                                    <input
                                        type="number"
                                        value={filters.maxSolved}
                                        onChange={(e) => setFilters((f) => ({ ...f, maxSolved: e.target.value }))}
                                        placeholder="optional"
                                        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                                    />
                                </label>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400"
                                >
                                    {loading ? 'Loading…' : 'Apply filters'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFilters(defaultFilters);
                                        fetchWithFilters(0, false, defaultFilters);
                                    }}
                                    className="rounded-xl border border-stone-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-stone-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    Reset
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="px-5 py-5 sm:px-7 sm:py-6">
                        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                <span className="tabular-nums text-slate-900 dark:text-white">{rows.length}</span>
                                <span className="text-slate-500 dark:text-slate-500"> of </span>
                                <span className="tabular-nums text-slate-900 dark:text-white">{total}</span>
                                <span className="text-slate-500 dark:text-slate-500"> matches</span>
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-500">Click a card to select</p>
                        </div>

                        <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2 xl:grid-cols-2">
                            {rows.map((row) => (
                                <li key={row.internalProblemId}>
                                    <button
                                        type="button"
                                        onClick={() => onSelect(row.internalProblemId)}
                                        className="group flex h-full w-full flex-col rounded-2xl border border-stone-200/90 bg-stone-50/90 px-4 py-3 text-left transition hover:border-amber-400/80 hover:bg-white hover:shadow-md dark:border-slate-700/90 dark:bg-[#0c1629] dark:hover:border-amber-600/50 dark:hover:bg-[#0f1e35]"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                                                {row.internalProblemId}
                                            </span>
                                            <span className="shrink-0 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                                {row.rating != null ? `${row.rating}` : '—'} · {row.solvedCount.toLocaleString()} solves
                                            </span>
                                        </div>
                                        <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-slate-800 dark:text-slate-100">
                                            {row.title}
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {(row.tags || []).slice(0, 6).map((t) => (
                                                <span
                                                    key={t}
                                                    className="rounded-md bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-stone-200/90 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-600"
                                                >
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>

                        {rows.length === 0 && !loading && (
                            <p className="py-16 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                                No problems match. Relax filters or try again later.
                            </p>
                        )}

                        {rows.length < total && (
                            <div className="mt-6 flex justify-center pb-2">
                                <button
                                    type="button"
                                    onClick={loadMore}
                                    disabled={loading}
                                    className="rounded-xl border border-stone-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-stone-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                                >
                                    {loading ? 'Loading…' : 'Load more'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CodeforcesProblemPicker;
