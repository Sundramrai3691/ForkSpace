/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useParams } from 'react-router';
import toast from 'react-hot-toast';
import { getAnalysisApiBases } from '../lib/analysisApi';

const LANGUAGE_CHOICES = [
    { value: 'cpp', label: 'C++' },
    { value: 'python', label: 'Python' },
    { value: 'javascript', label: 'JavaScript' },
];

const LOADING_STEPS = [
    'Parsing code structure...',
    'Detecting algorithms and patterns...',
    'Analysing time & space complexity...',
    'Checking for bugs and edge cases...',
    'Generating optimization suggestions...',
    'Scoring interview readiness...',
];

function normalizeLegacyAnalysis(result = {}, code = '') {
    if (result.overallScore != null || result.complexity || result.interviewReadiness) {
        return result;
    }

    const bugObjects = Array.isArray(result.bugs)
        ? result.bugs.map((bug) => ({
            severity: 'medium',
            title: bug,
            location: 'Shared analysis',
            explanation: bug,
            fix: 'Review this scenario and patch the edge case in the current approach.',
        }))
        : [];

    return {
        overallScore: bugObjects.length === 0 ? 78 : Math.max(45, 78 - bugObjects.length * 8),
        verdict: bugObjects.length === 0 ? 'Legacy analysis · no obvious critical issues' : 'Legacy analysis · follow-up review advised',
        summary: result.summary || 'This analysis was generated with the older ForkSpace analyzer and has been adapted into the new layout.',
        complexity: {
            time: result.time_complexity || 'N/A',
            timeExplanation: result.complexity_reasoning || 'Legacy analysis did not include a separate time explanation.',
            timeRating: result.time_complexity && /n\^2|n²/i.test(result.time_complexity) ? 'suboptimal' : 'acceptable',
            space: result.space_complexity || 'N/A',
            spaceExplanation: result.complexity_reasoning || 'Legacy analysis did not include a separate space explanation.',
            spaceRating: 'acceptable',
            constraintWarning: null,
        },
        patterns: [],
        bugs: bugObjects,
        metrics: {
            linesOfCode: code ? code.split(/\r?\n/).filter((line) => line.trim()).length : 0,
            cyclomaticComplexity: 1,
            nestingDepth: 1,
            variableCount: 0,
            branchCount: 0,
            readability: 'Medium',
        },
        optimization: {
            hasSuggestion: Boolean(result.optimization_suggestion?.before || result.optimization_suggestion?.after || result.optimization_suggestion?.benefit),
            summary: result.optimization_suggestion?.benefit || '',
            complexityChange: 'same complexity, cleaner code',
            before: result.optimization_suggestion?.before || '',
            after: result.optimization_suggestion?.after || '',
            explanation: result.optimization_suggestion?.benefit || '',
        },
        style: Array.isArray(result.style_issues)
            ? result.style_issues.map((item) => ({ type: 'info', text: item }))
            : [],
        interviewReadiness: {
            correctness: bugObjects.length === 0 ? 82 : 65,
            efficiency: 74,
            edgeCoverage: bugObjects.length === 0 ? 76 : 58,
            clarity: 72,
            robustness: bugObjects.length === 0 ? 78 : 60,
            cfFitness: 73,
            toReach95: 'Re-run the deep analyzer on this solution to get the richer issue list and improve the remaining edge-case coverage.',
        },
        similarProblems: [],
        tags: ['legacy-analysis'],
        missedEdgeCases: Array.isArray(result.bugs) ? result.bugs.slice(0, 4) : [],
        provider: 'legacy',
    };
}

function normalizeAnalysisPayload(result = {}, code = '') {
    return normalizeLegacyAnalysis(result, code);
}

async function requestFromBases(bases, requestFactory) {
    let lastError = null;

    for (const baseUrl of bases) {
        try {
            return await requestFactory(baseUrl);
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Analysis API is unavailable');
}

function scoreColor(score) {
    if (score >= 80) return '#3fb950';
    if (score >= 60) return '#d29922';
    return '#f85149';
}

function complexityTone(rating = 'acceptable') {
    if (rating === 'optimal') return 'text-green-400';
    if (rating === 'acceptable') return 'text-[#e6edf3]';
    return 'text-amber-400';
}

function metricTone(type, value) {
    if (type === 'readability') {
        if (value === 'High') return 'text-green-400';
        if (value === 'Medium') return 'text-amber-400';
        return 'text-red-400';
    }

    if (type === 'cyclomaticComplexity') {
        if (value <= 5) return 'text-green-400';
        if (value <= 10) return 'text-amber-400';
        return 'text-red-400';
    }

    if (type === 'nestingDepth') {
        if (value <= 3) return 'text-green-400';
        if (value <= 5) return 'text-amber-400';
        return 'text-red-400';
    }

    return 'text-[#e6edf3]';
}

function readinessTone(value) {
    if (value >= 80) return 'bg-green-500 text-green-400';
    if (value >= 60) return 'bg-amber-500 text-amber-400';
    return 'bg-red-500 text-red-400';
}

function ratingToFill(rating = 'acceptable') {
    if (rating === 'optimal') return 92;
    if (rating === 'acceptable') return 74;
    if (rating === 'suboptimal') return 45;
    if (rating === 'too slow') return 24;
    if (rating === 'high') return 40;
    return 60;
}

function pillClass(kind) {
    const map = {
        green: 'border-green-500/30 bg-green-500/10 text-green-400',
        amber: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
        red: 'border-red-500/30 bg-red-500/10 text-red-400',
        blue: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
    };
    return map[kind] || map.blue;
}

function formatLastAnalysed(dateValue) {
    if (!dateValue) return '';
    try {
        return new Date(dateValue).toLocaleString();
    } catch {
        return '';
    }
}

function Section({ index, title, children }) {
    return (
        <section
            className="rounded-xl border border-[#21262d] bg-[#161b22] p-4 opacity-0"
            style={{ animation: `fadeUp 0.45s ease ${index * 0.1}s forwards` }}
        >
            <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b949e]">{title}</h2>
            {children}
        </section>
    );
}

function AnalysePage() {
    const { analysisId } = useParams();
    const navigate = useNavigate();
    const apiBases = useMemo(() => getAnalysisApiBases(), []);
    const [language, setLanguage] = useState('cpp');
    const [problemContext, setProblemContext] = useState('');
    const [code, setCode] = useState('');
    const [analysis, setAnalysis] = useState(null);
    const [savedId, setSavedId] = useState(analysisId || '');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingShared, setIsFetchingShared] = useState(false);
    const [loadingStepIndex, setLoadingStepIndex] = useState(0);
    const [lastAnalysedAt, setLastAnalysedAt] = useState('');
    const [analysisError, setAnalysisError] = useState('');

    const lineCount = code ? code.split(/\r?\n/).length : 0;
    const charCount = code.length;
    const displayAnalysis = analysis ? normalizeAnalysisPayload(analysis, code) : null;
    const provider = displayAnalysis?.provider || 'ForkSpace AI';
    const circumference = 251;
    const score = displayAnalysis?.overallScore || 0;
    const scoreOffset = circumference - (score / 100) * circumference;

    useEffect(() => {
        if (!isLoading) {
            setLoadingStepIndex(0);
            return undefined;
        }

        const intervalId = window.setInterval(() => {
            setLoadingStepIndex((current) => (current + 1) % LOADING_STEPS.length);
        }, 480);

        return () => window.clearInterval(intervalId);
    }, [isLoading]);

    useEffect(() => {
        if (!analysisId) return;

        const loadSharedAnalysis = async () => {
            setIsFetchingShared(true);
            try {
                const response = await requestFromBases(apiBases, (baseUrl) => axios.get(`${baseUrl}/api/analysis/${analysisId}`));
                const shared = response.data.analysis;
                setLanguage(shared.language || 'cpp');
                setProblemContext(shared.prompt || '');
                setCode(shared.code || '');
                setAnalysis(normalizeAnalysisPayload(shared.result || {}, shared.code || ''));
                setSavedId(shared.id || analysisId);
                setLastAnalysedAt(shared.createdAt || '');
                setAnalysisError('');
            } catch {
                toast.error('Analysis link not found');
            } finally {
                setIsFetchingShared(false);
            }
        };

        loadSharedAnalysis();
    }, [analysisId, apiBases]);

    const copyShareLink = async () => {
        if (!savedId) {
            toast.error('Run an analysis first.');
            return;
        }

        await navigator.clipboard.writeText(window.location.href);
        toast.success('Share link copied');
    };

    const handleAnalyse = async () => {
        if (!code.trim()) {
            toast.error('Paste your solution first.');
            return;
        }

        setIsLoading(true);
        setAnalysisError('');

        try {
            const analysisResponse = await requestFromBases(apiBases, (baseUrl) => axios.post(`${baseUrl}/api/analyse`, {
                code,
                language,
                problemContext,
            }));

            const parsedResult = normalizeAnalysisPayload(analysisResponse.data, code);
            const saveResponse = await requestFromBases(apiBases, (baseUrl) => axios.post(`${baseUrl}/api/analysis/save`, {
                code,
                language,
                problemContext,
                result: parsedResult,
            }));

            const nextId = saveResponse.data.id;
            setAnalysis(parsedResult);
            setSavedId(nextId);
            setLastAnalysedAt(new Date().toISOString());
            window.history.pushState({}, '', `/analysis/${nextId}`);
            navigate(`/analysis/${nextId}`, { replace: true });
            toast.success('Analysis ready');
        } catch (error) {
            const message = error.response?.data?.error || 'Analysis failed';
            setAnalysisError(error.response?.data?.raw || message);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    const openProblemSearch = (problem) => {
        const tags = Array.isArray(problem.tags) ? problem.tags.join(',') : '';
        window.open(`https://codeforces.com/problemset?tags=${encodeURIComponent(tags)}`, '_blank', 'noopener,noreferrer');
    };

    const resultSections = displayAnalysis ? [
        {
            key: 'overall',
            title: 'Overall Score',
            content: (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                    <div className="rounded-2xl border border-[#30363d] bg-[#0d1117] p-5">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center">
                            <div className="relative h-28 w-28 shrink-0">
                        <svg className="h-28 w-28 -rotate-90" viewBox="0 0 80 80" aria-hidden="true">
                            <circle cx="40" cy="40" r="32" stroke="#21262d" strokeWidth="8" fill="none" />
                            <circle
                                cx="40"
                                cy="40"
                                r="32"
                                stroke={scoreColor(score)}
                                strokeWidth="8"
                                fill="none"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={scoreOffset}
                                style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)' }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-[#e6edf3]">{score}</div>
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8b949e]">ForkSpace verdict</p>
                                <h3 className="mt-2 text-2xl font-semibold text-[#e6edf3]">{displayAnalysis.verdict}</h3>
                                <p className="mt-3 text-base leading-8 text-[#c9d1d9]">{displayAnalysis.summary}</p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {displayAnalysis.tags.map((tag) => (
                                        <span key={tag} className={`rounded-full border px-3 py-1 text-xs ${pillClass('blue')}`}>{tag}</span>
                                    ))}
                                    <span className={`rounded-full border px-3 py-1 text-xs ${displayAnalysis.bugs.length ? pillClass('red') : pillClass('green')}`}>
                                        {displayAnalysis.bugs.length} issues
                                    </span>
                                    <span className={`rounded-full border px-3 py-1 text-xs ${displayAnalysis.complexity.timeRating === 'optimal' ? pillClass('green') : pillClass('amber')}`}>
                                        {displayAnalysis.complexity.timeRating}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="grid gap-3">
                        <div className="rounded-2xl border border-[#30363d] bg-[#0d1117] p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8b949e]">Time complexity</p>
                            <p className="mt-3 text-2xl font-bold text-[#79c0ff]">{displayAnalysis.complexity.time}</p>
                        </div>
                        <div className="rounded-2xl border border-[#30363d] bg-[#0d1117] p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8b949e]">Space complexity</p>
                            <p className="mt-3 text-2xl font-bold text-green-400">{displayAnalysis.complexity.space}</p>
                        </div>
                    </div>
                </div>
            ),
        },
        {
            key: 'complexity',
            title: 'Complexity Analysis',
            content: (
                <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        {[
                            ['TIME COMPLEXITY', displayAnalysis.complexity.time, displayAnalysis.complexity.timeExplanation, displayAnalysis.complexity.timeRating],
                            ['SPACE COMPLEXITY', displayAnalysis.complexity.space, displayAnalysis.complexity.spaceExplanation, displayAnalysis.complexity.spaceRating],
                        ].map(([label, value, explanation, rating]) => (
                            <div key={label} className="rounded-2xl border border-[#21262d] bg-[#0d1117] p-4">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6e7681]">{label}</p>
                                <p className={`mt-4 font-mono text-4xl ${complexityTone(rating)}`}>{value}</p>
                                <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs ${rating === 'optimal' ? pillClass('green') : rating === 'acceptable' ? pillClass('blue') : pillClass('amber')}`}>
                                    {rating}
                                </span>
                                <p className="mt-4 text-sm leading-7 text-[#c9d1d9]">{explanation}</p>
                                <div className="mt-4 rounded-xl border border-[#21262d] bg-[#11161d] px-4 py-3 text-sm text-[#8b949e]">
                                    Complexity confidence: {ratingToFill(rating)} / 100
                                </div>
                            </div>
                        ))}
                    </div>
                    {displayAnalysis.complexity.constraintWarning ? (
                        <div className="rounded-lg border border-[#21262d] bg-[#0d1117] p-3 text-sm leading-7 text-[#8b949e]">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b949e]">Constraint Check</p>
                            <p className="mt-2">{displayAnalysis.complexity.constraintWarning}</p>
                        </div>
                    ) : null}
                </div>
            ),
        },
        {
            key: 'patterns',
            title: 'Algorithm & Pattern Detection',
            content: displayAnalysis.patterns.length ? (
                <div className="space-y-3">
                    {displayAnalysis.patterns.map((pattern) => (
                        <div key={`${pattern.name}-${pattern.confidence}`} className="flex items-start gap-3 rounded-lg border border-[#21262d] bg-[#0d1117] p-3">
                            <div className="mt-1 h-10 w-10 rounded-lg bg-sky-500/10 text-center text-lg leading-10 text-sky-300">A</div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="font-medium text-[#e6edf3]">{pattern.name}</p>
                                    <span className={`text-xs font-semibold ${pattern.confidence >= 90 ? 'text-green-400' : pattern.confidence >= 60 ? 'text-[#e6edf3]' : 'text-amber-400'}`}>
                                        {pattern.confidence}% {pattern.confidence < 60 ? 'Suggestion' : 'confidence'}
                                    </span>
                                </div>
                                <p className="mt-1 text-sm text-[#8b949e]">{pattern.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-[#8b949e]">No specific algorithmic patterns detected.</p>
            ),
        },
        {
            key: 'bugs',
            title: 'Bug & Risk Detection',
            content: displayAnalysis.bugs.length ? (
                <div className="space-y-3">
                    {displayAnalysis.bugs.map((bug) => (
                        <div key={`${bug.title}-${bug.location}`} className="flex overflow-hidden rounded-lg border border-[#21262d] bg-[#0d1117]">
                            <div className={`w-1 ${bug.severity === 'critical' ? 'bg-red-500' : bug.severity === 'high' ? 'bg-amber-400' : bug.severity === 'medium' ? 'bg-sky-400' : 'bg-[#6e7681]'}`} />
                            <div className="flex-1 p-4">
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${bug.severity === 'critical' ? pillClass('red') : bug.severity === 'high' ? pillClass('amber') : bug.severity === 'medium' ? pillClass('blue') : 'border-[#30363d] bg-[#161b22] text-[#8b949e]'}`}>
                                        {bug.severity}
                                    </span>
                                    <h3 className="text-sm font-medium text-[#e6edf3]">{bug.title}</h3>
                                </div>
                                <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-[#6e7681]">{bug.location}</p>
                                <p className="mt-2 text-sm leading-6 text-[#8b949e]">{bug.explanation}</p>
                                <pre className="mt-3 overflow-x-auto rounded-lg bg-[#11161d] p-3 font-mono text-[11px] leading-6 text-[#8b949e]">{bug.fix}</pre>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-400">No critical issues found.</div>
            ),
        },
        {
            key: 'metrics',
            title: 'Code Metrics',
            content: (
                <div className="grid gap-px rounded-xl bg-[#21262d] md:grid-cols-3">
                    {[
                        ['Lines of code', displayAnalysis.metrics.linesOfCode, 'default'],
                        ['Cyclomatic complexity', displayAnalysis.metrics.cyclomaticComplexity, 'cyclomaticComplexity'],
                        ['Nesting depth', displayAnalysis.metrics.nestingDepth, 'nestingDepth'],
                        ['Variable count', displayAnalysis.metrics.variableCount, 'default'],
                        ['Branch count', displayAnalysis.metrics.branchCount, 'default'],
                        ['Readability', displayAnalysis.metrics.readability, 'readability'],
                    ].map(([label, value, type]) => (
                        <div key={label} className="bg-[#0d1117] p-4">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6e7681]">{label}</p>
                            <p className={`mt-3 text-lg font-bold ${metricTone(type, value)}`}>{value}</p>
                        </div>
                    ))}
                </div>
            ),
        },
        ...(displayAnalysis.optimization?.hasSuggestion ? [{
            key: 'optimization',
            title: 'Concrete Optimization',
            content: (
                <div className="space-y-4">
                    <div className="grid gap-px rounded-xl bg-[#21262d] md:grid-cols-2">
                        <div className="bg-[#0d1117] p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-red-400">Before</p>
                            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-6 text-[#8b949e]">{displayAnalysis.optimization.before}</pre>
                        </div>
                        <div className="bg-[#0d1117] p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-green-400">After</p>
                            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-6 text-[#e6edf3]">{displayAnalysis.optimization.after}</pre>
                        </div>
                    </div>
                    <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-400">
                        <p>{displayAnalysis.optimization.summary || displayAnalysis.optimization.complexityChange}</p>
                        <p className="mt-2">Up: {displayAnalysis.optimization.explanation}</p>
                    </div>
                </div>
            ),
        }] : []),
        {
            key: 'style',
            title: 'Style & Readability',
            content: (
                <div className="space-y-3">
                    {displayAnalysis.style.length ? displayAnalysis.style.map((item, itemIndex) => (
                        <div key={`${item.text}-${itemIndex}`} className="flex items-start gap-3 text-sm text-[#8b949e]">
                            <span className={`mt-2 h-2.5 w-2.5 rounded-full ${item.type === 'warning' ? 'bg-amber-400' : item.type === 'good' ? 'bg-green-400' : 'bg-sky-400'}`} />
                            <p><span className="font-medium text-[#e6edf3]">{item.type}</span> {item.text}</p>
                        </div>
                    )) : <p className="text-sm text-[#8b949e]">No extra style remarks from the analyzer.</p>}
                </div>
            ),
        },
        {
            key: 'readiness',
            title: 'Interview Readiness',
            content: (
                <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {[
                            ['Correctness', displayAnalysis.interviewReadiness.correctness],
                            ['Efficiency', displayAnalysis.interviewReadiness.efficiency],
                            ['Edge coverage', displayAnalysis.interviewReadiness.edgeCoverage],
                            ['Clarity', displayAnalysis.interviewReadiness.clarity],
                            ['Robustness', displayAnalysis.interviewReadiness.robustness],
                            ['CF fitness', displayAnalysis.interviewReadiness.cfFitness],
                        ].map(([label, value]) => {
                            const [barClass, textClass] = readinessTone(value).split(' ');
                            return (
                                <div key={label} className="rounded-2xl border border-[#21262d] bg-[#0d1117] p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm text-[#e6edf3]">{label}</p>
                                        <span className={`text-2xl font-bold ${textClass}`}>{value}%</span>
                                    </div>
                                    <div className="mt-4 rounded-xl border border-[#21262d] bg-[#11161d] px-4 py-3">
                                        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-[#8b949e]">
                                            <span>Readiness</span>
                                            <span>{value >= 80 ? 'Strong' : value >= 60 ? 'Solid' : 'Needs work'}</span>
                                        </div>
                                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#161b22]">
                                            <div className={`h-full rounded-full ${barClass}`} style={{ width: `${value}%`, animation: 'barGrow 0.65s ease 0.4s both' }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="rounded-lg border border-amber-500/20 bg-[#0d1117] p-4 text-sm leading-7 text-[#8b949e]">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-400">To Reach 95+</p>
                        <p className="mt-2">{displayAnalysis.interviewReadiness.toReach95}</p>
                    </div>
                </div>
            ),
        },
        ...(displayAnalysis.missedEdgeCases.length ? [{
            key: 'edges',
            title: 'Missed Edge Cases',
            content: (
                <div className="space-y-3">
                    {displayAnalysis.missedEdgeCases.map((edgeCase, edgeIndex) => (
                        <div key={`${edgeCase}-${edgeIndex}`} className="border-l-4 border-red-500 bg-[#0d1117] p-3 text-sm text-[#e6edf3]">
                            {edgeCase}
                        </div>
                    ))}
                </div>
            ),
        }] : []),
        {
            key: 'similar',
            title: 'Similar Problems',
            content: displayAnalysis.similarProblems.length ? (
                <div className="space-y-3">
                    {displayAnalysis.similarProblems.map((problem) => (
                        <button
                            key={`${problem.name}-${problem.rating}`}
                            type="button"
                            onClick={() => openProblemSearch(problem)}
                            className="w-full rounded-lg border border-[#21262d] bg-[#0d1117] p-4 text-left transition hover:border-sky-500/40"
                        >
                            <div className="flex flex-wrap items-center gap-3">
                                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${problem.difficulty === 'Easy' ? pillClass('green') : problem.difficulty === 'Hard' ? pillClass('red') : pillClass('amber')}`}>
                                    {problem.difficulty[0]}
                                </span>
                                <p className="font-medium text-[#e6edf3]">{problem.name}</p>
                                <span className="text-xs text-[#8b949e]">{problem.rating}</span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {problem.tags.map((tag) => (
                                    <span key={tag} className={`rounded-full border px-2 py-1 text-[10px] ${pillClass('blue')}`}>{tag}</span>
                                ))}
                            </div>
                            <p className="mt-3 text-sm text-[#8b949e]">{problem.reason}</p>
                        </button>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-[#8b949e]">No similar Codeforces problems suggested yet.</p>
            ),
        },
    ] : [];

    return (
        <div className="h-screen overflow-hidden bg-[#0d1117] text-[#e6edf3]">
            <style>{`
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes barGrow {
                    from { width: 0; }
                    to { width: var(--w, 100%); }
                }
                @keyframes pulseTrack {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(220%); }
                }
            `}</style>

            <header className="flex items-center justify-between border-b border-[#21262d] px-5 py-4">
                <div>
                    <p className="text-sm font-semibold tracking-[0.25em] text-[#79c0ff]">ForkSpace - Solution Analyser</p>
                    <p className="mt-1 text-xs text-[#8b949e]">Deep analytics for interview-style and Codeforces-style solutions.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link to="/history/reports" className="rounded-lg border border-[#30363d] px-3 py-2 text-sm text-[#e6edf3] transition hover:border-[#79c0ff]">History</Link>
                    <button type="button" onClick={copyShareLink} className="rounded-lg border border-[#30363d] px-3 py-2 text-sm text-[#e6edf3] transition hover:border-[#79c0ff]">Share</button>
                </div>
            </header>

            <div className="flex h-[calc(100vh-73px)]">
                <aside className="flex h-full w-full flex-col border-r border-[#21262d] lg:w-[40%] xl:w-[38%]">
                    <div className="overflow-y-auto px-5 py-5">
                        <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
                            <label className="space-y-2">
                                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b949e]">Language</span>
                                <select
                                    value={language}
                                    onChange={(event) => setLanguage(event.target.value)}
                                    className="w-full rounded-xl border border-[#30363d] bg-[#161b22] px-4 py-3 text-sm text-[#e6edf3] outline-none transition focus:border-[#79c0ff]"
                                >
                                    {LANGUAGE_CHOICES.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="space-y-2">
                                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b949e]">Problem context</span>
                                <input
                                    value={problemContext}
                                    onChange={(event) => setProblemContext(event.target.value)}
                                    placeholder="e.g. segment tree, n <= 2x10^5, CF-style"
                                    className="w-full rounded-xl border border-[#30363d] bg-[#161b22] px-4 py-3 text-sm text-[#e6edf3] outline-none transition focus:border-[#79c0ff]"
                                />
                            </label>
                        </div>

                        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm text-[#8b949e]">
                            <p>Lines: {lineCount} - Chars: {charCount}</p>
                            {analysisError ? <p className="max-w-full rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300 lg:max-w-[70%]">{analysisError}</p> : null}
                        </div>

                        <div className="mt-3 min-h-[60vh] rounded-2xl border border-[#21262d] bg-[#0d1117] p-1">
                            <textarea
                                value={code}
                                onChange={(event) => setCode(event.target.value)}
                                placeholder="// Paste your solution here"
                                className="h-[calc(100vh-260px)] min-h-[520px] w-full resize-none rounded-2xl border-0 bg-[#0d1117] px-4 py-4 font-mono text-sm leading-[1.7] text-[#e6edf3] outline-none"
                            />
                        </div>
                    </div>
                    <div className="border-t border-[#21262d] px-5 py-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={handleAnalyse}
                                disabled={isLoading}
                                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {isLoading ? 'Analysing...' : analysis ? 'Re-analyse' : 'Analyse solution'}
                            </button>
                            {lastAnalysedAt ? <p className="text-sm text-[#8b949e]">Last analysed {formatLastAnalysed(lastAnalysedAt)}</p> : null}
                        </div>
                        <p className="mt-3 text-xs text-[#8b949e]">Powered by {provider} - results in ~3s</p>
                    </div>
                </aside>

                <main className="flex-1 overflow-y-auto px-5 py-5">
                    {isFetchingShared ? (
                        <div className="flex h-full items-center justify-center text-sm text-[#8b949e]">Loading shared analysis...</div>
                    ) : isLoading ? (
                        <div className="flex h-full flex-col items-center justify-center">
                            <div className="relative h-2 w-full max-w-xl overflow-hidden rounded-full bg-[#161b22]">
                                <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-blue-500" style={{ animation: 'pulseTrack 1.1s linear infinite' }} />
                            </div>
                            <p className="mt-6 text-sm text-[#e6edf3]">{LOADING_STEPS[loadingStepIndex]}</p>
                        </div>
                    ) : !displayAnalysis ? (
                        <div className="flex h-full flex-col items-center justify-center text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#21262d] bg-[#161b22] text-2xl text-[#79c0ff]">A</div>
                            <h2 className="mt-6 text-xl font-semibold text-[#e6edf3]">Paste your solution and click Analyse.</h2>
                            <p className="mt-2 max-w-lg text-sm text-[#8b949e]">Deep metrics - bug detection - pattern recognition - interview score</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {resultSections.map((section, index) => (
                                <Section key={section.key} index={index} title={section.title}>
                                    {section.content}
                                </Section>
                            ))}
                            <div
                                className="rounded-xl border border-[#21262d] bg-[#161b22] p-3 opacity-0"
                                style={{ animation: `fadeUp 0.45s ease ${resultSections.length * 0.1}s forwards` }}
                            >
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0d1117] text-[#79c0ff]">F</div>
                                        <div>
                                            <p className="text-sm font-medium text-[#e6edf3]">Analysis ready - Score {displayAnalysis.overallScore}/100 - {displayAnalysis.complexity.time} - {displayAnalysis.bugs.length} issues</p>
                                            <p className="text-xs text-[#8b949e]">Saved as a shareable ForkSpace analysis page.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button type="button" onClick={copyShareLink} className="rounded-lg border border-[#30363d] px-3 py-2 text-sm text-[#e6edf3] transition hover:border-[#79c0ff]">Copy link</button>
                                        <button type="button" onClick={() => navigate('/')} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-500">Open in ForkSpace</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

export default AnalysePage;
