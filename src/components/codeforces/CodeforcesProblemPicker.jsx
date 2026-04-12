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
 * Modal to browse Codeforces problems from the server catalog (cached API).
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
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[1.5rem] border border-stone-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#081121]">
                <div className="flex items-start justify-between gap-3 border-b border-stone-200 px-5 py-4 dark:border-slate-700">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">
                            Codeforces catalog
                        </p>
                        <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">Pick a problem</h3>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                            Filter by tags, rating, and solved count. Data is cached on the server.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-white text-stone-600 transition hover:border-stone-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        aria-label="Close"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSearch} className="space-y-3 border-b border-stone-100 px-5 py-4 dark:border-slate-800">
                    {warning && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100">
                            {warning}
                        </div>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2">
                        <label className="space-y-1">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Tags (comma, AND)</span>
                            <input
                                value={filters.tags}
                                onChange={(e) => setFilters((f) => ({ ...f, tags: e.target.value }))}
                                placeholder="dp, greedy"
                                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                        </label>
                        <label className="space-y-1">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Search title / id</span>
                            <input
                                value={filters.search}
                                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                                placeholder="e.g. 1885 or xor"
                                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                        </label>
                        <label className="space-y-1">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Min rating</span>
                            <input
                                type="number"
                                value={filters.minRating}
                                onChange={(e) => setFilters((f) => ({ ...f, minRating: e.target.value }))}
                                placeholder="800"
                                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                        </label>
                        <label className="space-y-1">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Max rating</span>
                            <input
                                type="number"
                                value={filters.maxRating}
                                onChange={(e) => setFilters((f) => ({ ...f, maxRating: e.target.value }))}
                                placeholder="2000"
                                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                        </label>
                        <label className="space-y-1">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Min solves</span>
                            <input
                                type="number"
                                value={filters.minSolved}
                                onChange={(e) => setFilters((f) => ({ ...f, minSolved: e.target.value }))}
                                placeholder="0"
                                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                        </label>
                        <label className="space-y-1">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Max solves</span>
                            <input
                                type="number"
                                value={filters.maxSolved}
                                onChange={(e) => setFilters((f) => ({ ...f, maxSolved: e.target.value }))}
                                placeholder="optional"
                                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                        </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                        >
                            {loading ? 'Loading…' : 'Apply filters'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setFilters(defaultFilters);
                                fetchWithFilters(0, false, defaultFilters);
                            }}
                            className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-stone-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            Reset
                        </button>
                    </div>
                </form>

                <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3 sm:px-4">
                    <p className="mb-2 px-2 text-xs text-slate-500 dark:text-slate-400">
                        Showing {rows.length} of {total} matches
                    </p>
                    <ul className="space-y-2">
                        {rows.map((row) => (
                            <li key={row.internalProblemId}>
                                <button
                                    type="button"
                                    onClick={() => onSelect(row.internalProblemId)}
                                    className="w-full rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3 text-left transition hover:border-amber-300 hover:bg-white dark:border-slate-700 dark:bg-[#0d172b] dark:hover:border-amber-700/60"
                                >
                                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                                        <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                                            {row.internalProblemId}
                                        </span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                            {row.rating != null ? `Rating ${row.rating}` : 'Unrated'} · {row.solvedCount.toLocaleString()} solves
                                        </span>
                                    </div>
                                    <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">{row.title}</p>
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {(row.tags || []).slice(0, 8).map((t) => (
                                            <span
                                                key={t}
                                                className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-stone-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-600"
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
                        <p className="px-2 py-8 text-center text-sm text-slate-500">No problems match. Relax filters or try again later.</p>
                    )}
                    {rows.length < total && (
                        <div className="p-4 text-center">
                            <button
                                type="button"
                                onClick={loadMore}
                                disabled={loading}
                                className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-stone-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                {loading ? 'Loading…' : 'Load more'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default CodeforcesProblemPicker;
