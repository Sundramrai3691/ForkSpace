/* eslint-disable react/prop-types */
import axios from 'axios';
import User from '../common/User';
import { Link, useLocation, Navigate, useNavigate } from 'react-router';
import toast from 'react-hot-toast';
import { useEffect, useState } from 'react';

const PLATFORM_OPTIONS = [
    { value: 'codeforces', label: 'Codeforces' },
    { value: 'custom', label: 'Custom / Other' },
    { value: 'leetcode', label: 'LeetCode (discussion)' },
    { value: 'atcoder', label: 'AtCoder' },
    { value: 'other', label: 'Other' },
];

function formatProblemTitle(platform, problemCode, currentTitle) {
    if (currentTitle && currentTitle !== 'Untitled Practice Problem') {
        return currentTitle;
    }

    if (!problemCode.trim()) {
        return currentTitle || 'Untitled Practice Problem';
    }

    const platformLabel = PLATFORM_OPTIONS.find((option) => option.value === platform)?.label || 'Practice';
    return `${platformLabel} ${problemCode.trim()}`;
}

function shouldResetImportedSource(sourceUrl = '') {
    try {
        const parsedUrl = new URL(sourceUrl);
        return ['codeforces.com', 'm1.codeforces.com', 'leetcode.com'].includes(parsedUrl.hostname);
    } catch {
        return false;
    }
}



function Sidebar({ users = [], roomId, roomState, socketRef }) {
    const location = useLocation();
    const navigate = useNavigate();
    const serverUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();
    const [isImporting, setIsImporting] = useState(false);
    const [importNotice, setImportNotice] = useState('');
    const [problemDraft, setProblemDraft] = useState({
        platform: 'codeforces',
        problemCode: '',
        problemUrl: '',
        sourceUrl: '',
        title: '',
        prompt: '',
        sampleInput: '',
        sampleOutput: '',
        samples: [],
    });

    const hasJoinState = Boolean(location.state);

    useEffect(() => {
        setProblemDraft({
            platform: roomState?.problem?.platform || 'codeforces',
            problemCode: roomState?.problem?.problemCode || '',
            problemUrl: roomState?.problem?.problemUrl || '',
            sourceUrl: roomState?.problem?.sourceUrl || '',
            title: roomState?.problem?.title || '',
            prompt: roomState?.problem?.prompt || '',
            sampleInput: roomState?.problem?.sampleInput || '',
            sampleOutput: roomState?.problem?.sampleOutput || '',
            samples: roomState?.problem?.samples || [],
        });
    }, [roomState?.problem]);

    useEffect(() => {
        if (!socketRef?.current || !roomState) return;
        if (JSON.stringify(problemDraft) === JSON.stringify(roomState.problem || {})) return;

        const timer = setTimeout(() => {
            socketRef.current.emit('problem-update', {
                roomId,
                problem: problemDraft,
            });
        }, 300);

        return () => clearTimeout(timer);
    }, [problemDraft, roomId, socketRef, roomState]);

    if (!hasJoinState) {
        return <Navigate to='/' />;
    }

    const handleCopyRoomId = async () => {
        try {
            await navigator.clipboard.writeText(roomId);
            toast.success('Room ID copied');
        } catch {
            toast.error('Failed to copy room ID');
        }
    };

    const handleGoHome = () => {
        navigate('/');
    };

    const handleImportProblem = async () => {
        if (!problemDraft.problemCode.trim()) {
            toast.error('Add a platform problem code first.');
            return;
        }

        setIsImporting(true);
        setImportNotice('');

        try {
            const response = await axios.post(`${serverUrl}/api/problem-import`, {
                platform: problemDraft.platform,
                problemCode: problemDraft.problemCode,
                sourceUrl: problemDraft.sourceUrl,
            });

            setProblemDraft((prev) => ({
                ...prev,
                ...response.data.problem,
            }));

            setImportNotice('Problem details imported into the shared brief.');
            toast.success('Problem details imported');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to import the problem');
        } finally {
            setIsImporting(false);
        }
    };

    const handleImportProblemUrl = async () => {
        if (!problemDraft.problemUrl.trim()) {
            toast.error('Add a problem URL first.');
            return;
        }

        setIsImporting(true);
        setImportNotice('');

        try {
            const response = await axios.post(`${serverUrl}/api/problem-import-url`, {
                problemUrl: problemDraft.problemUrl,
            });

            setProblemDraft((prev) => ({
                ...prev,
                ...response.data.problem,
            }));

            if (response.data.warning) {
                const nextNotice = 'Automatic import was limited for this problem. Keep the URL and title for context, then paste the sample input and expected output manually below.';
                setImportNotice(nextNotice);
                toast(nextNotice, {
                    icon: '!',
                });
            } else {
                setImportNotice('Problem details imported from the URL.');
                toast.success('Problem imported from URL');
            }
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to import from URL');
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="flex h-full w-full flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="flex flex-col space-y-4 p-6">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-800/40">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                            Problem Brief
                        </h3>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                            Shared
                        </span>
                    </div>

                    <div className="space-y-3">
                        <div className="rounded-xl border border-blue-200 bg-blue-50/90 p-3 text-sm leading-6 text-blue-900 dark:border-blue-800/60 dark:bg-blue-950/30 dark:text-blue-100">
                            LeetCode stays available for collaborative discussion, but this room is optimized for Codeforces-style input/output practice.
                        </div>

                        {importNotice && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-sm leading-6 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100">
                                {importNotice}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                                Problem URL
                            </span>
                            <input
                                type="url"
                                value={problemDraft.problemUrl}
                                onChange={(event) => setProblemDraft((prev) => ({ ...prev, problemUrl: event.target.value }))}
                                placeholder="https://codeforces.com/problemset/problem/1/A"
                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleImportProblemUrl}
                            disabled={isImporting || !problemDraft.problemUrl.trim()}
                            className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:text-white"
                        >
                            {isImporting ? 'Importing...' : 'Import from URL'}
                        </button>
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
                            <label className="space-y-1.5">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                                    Platform
                                </span>
                                <select
                                    value={problemDraft.platform}
                                    onChange={(event) => {
                                        const nextPlatform = event.target.value;
                                        setProblemDraft((prev) => ({
                                            ...prev,
                                            platform: nextPlatform,
                                            sourceUrl: shouldResetImportedSource(prev.sourceUrl) ? '' : prev.sourceUrl,
                                            title: formatProblemTitle(nextPlatform, prev.problemCode, prev.title),
                                        }));
                                    }}
                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                >
                                    {PLATFORM_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="space-y-1.5">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                                    Problem Code
                                </span>
                                <input
                                    type="text"
                                    value={problemDraft.problemCode}
                                    maxLength={16}
                                    autoComplete="off"
                                    spellCheck={false}
                                    onChange={(event) => {
                                        const nextProblemCode = event.target.value;
                                        setProblemDraft((prev) => ({
                                            ...prev,
                                            problemCode: nextProblemCode,
                                            sourceUrl: shouldResetImportedSource(prev.sourceUrl) ? '' : prev.sourceUrl,
                                            title: formatProblemTitle(prev.platform, nextProblemCode, prev.title),
                                        }));
                                    }}
                                    placeholder="1885A"
                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                />
                            </label>
                        </div>
                        <button
                            type="button"
                            onClick={handleImportProblem}
                            disabled={isImporting || !problemDraft.problemCode.trim()}
                            className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:text-white"
                        >
                            {isImporting ? 'Importing problem...' : 'Import problem details'}
                        </button>
                        <input
                            type="text"
                            value={problemDraft.title}
                            onChange={(event) => setProblemDraft((prev) => ({ ...prev, title: event.target.value }))}
                            placeholder="Problem title"
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        />
                        <textarea
                            value={problemDraft.prompt}
                            onChange={(event) => setProblemDraft((prev) => ({ ...prev, prompt: event.target.value }))}
                            placeholder="Add the prompt, constraints, or the approach you want to discuss..."
                            className="h-24 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        />
                        <div className="grid gap-3">
                            <label className="space-y-1.5">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                                    Sample Input
                                </span>
                                <textarea
                                    value={problemDraft.sampleInput}
                                    onChange={(event) => setProblemDraft((prev) => ({ ...prev, sampleInput: event.target.value }))}
                                    placeholder="Paste the Codeforces sample input here"
                                    className="h-32 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 font-mono text-sm text-gray-900 outline-none transition focus:border-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                />
                            </label>
                            <label className="space-y-1.5">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                                    Expected Output
                                </span>
                                <textarea
                                    value={problemDraft.sampleOutput}
                                    onChange={(event) => setProblemDraft((prev) => ({ ...prev, sampleOutput: event.target.value }))}
                                    placeholder="Paste the expected output here"
                                    className="h-32 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 font-mono text-sm text-gray-900 outline-none transition focus:border-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                />
                            </label>
                        </div>
                        {problemDraft.samples?.length > 0 && (
                            <div className="flex items-center justify-between rounded-xl border border-dashed border-gray-300 bg-white/70 p-3 dark:border-gray-700 dark:bg-gray-900/50">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                                        Parsed Samples
                                    </p>
                                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                                        {problemDraft.samples.length} sample {problemDraft.samples.length === 1 ? 'test' : 'tests'} ready for suite runs.
                                    </p>
                                </div>
                                <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                                    Ready
                                </span>
                            </div>
                        )}
                    </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                                Room Members
                            </h2>
                            <div className="flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1">
                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{users.length}</span>
                            </div>
                        </div>
                        <div className="h-px bg-gradient-to-r from-gray-200 dark:from-gray-700 via-gray-200/50 dark:via-gray-700/50 to-transparent"></div>
                    </div>

                    <div>
                        {users.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                                    <div className="h-3 w-3 animate-pulse rounded-full bg-gray-400 dark:bg-gray-600"></div>
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Loading room members...</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {users.map((user) => (
                                    <User
                                        key={user.socketId}
                                        username={user.username}
                                        role={user.role}
                                        isOnline={true}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 backdrop-blur-sm p-6 flex-shrink-0">
                <div className="flex justify-center gap-4">
                    <button
                        onClick={handleCopyRoomId}
                        className="group relative inline-flex items-center justify-center w-11 h-11 rounded-xl bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-700 border border-gray-200/80 dark:border-gray-600/80 hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200 shadow-sm hover:shadow-md backdrop-blur-sm"
                        aria-label="Copy practice room ID"
                        title="Copy practice room ID"
                    >
                        <svg className="h-4 w-4 text-gray-700 dark:text-gray-300 group-hover:text-black dark:group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                        </svg>
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/5 dark:from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                    </button>
                    
                    <button
                        onClick={handleGoHome}
                        className="group relative inline-flex items-center justify-center w-11 h-11 rounded-xl bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-700 border border-gray-200/80 dark:border-gray-600/80 hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200 shadow-sm hover:shadow-md backdrop-blur-sm"
                        aria-label="Go to home"
                        title="Home"
                    >
                        <svg className="h-4 w-4 text-gray-700 dark:text-gray-300 group-hover:text-black dark:group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            <polyline points="9,22 9,12 15,12 15,22"/>
                        </svg>
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/5 dark:from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                    </button>
                    
                    <Link to="/">
                        <button
                            className="group relative inline-flex items-center justify-center w-11 h-11 rounded-xl bg-red-50/90 dark:bg-red-950/90 hover:bg-red-100 dark:hover:bg-red-900 border border-red-200/80 dark:border-red-800/80 hover:border-red-300 dark:hover:border-red-700 transition-all duration-200 shadow-sm hover:shadow-md backdrop-blur-sm"
                            aria-label="Leave room"
                            title="Leave room"
                        >
                            <svg className="h-4 w-4 text-red-600 dark:text-red-400 group-hover:text-red-700 dark:group-hover:text-red-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                                <polyline points="16,17 21,12 16,7"/>
                                <line x1="21" x2="9" y1="12" y2="12"/>
                            </svg>
                            <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-red-500/10 dark:from-red-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                        </button>
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default Sidebar;
