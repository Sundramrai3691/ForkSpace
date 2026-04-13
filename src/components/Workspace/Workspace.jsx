/* eslint-disable react/prop-types */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import Codemirror from "codemirror";
import axios from "axios";
import toast from "react-hot-toast";
import "codemirror/lib/codemirror.css";
import "codemirror/theme/dracula.css";
import "codemirror/mode/javascript/javascript";
import "codemirror/mode/clike/clike";
import "codemirror/mode/python/python";
import "codemirror/addon/edit/closetag";
import "codemirror/addon/edit/closebrackets";
import useAIHint from "./AIHint";
import { DEFAULT_LANGUAGE, LANGUAGE_OPTIONS } from "./languages";
import { formatCode } from "./formatCode";
import { getAuthHeaders, getAuthToken } from "../../lib/auth";
import SessionIntelligenceReportDashboard from "../sessionIntelligence/SessionIntelligenceReportDashboard.jsx";
import HiddenTestPanel from "../HiddenTestPanel.jsx";

function normalizeEditorText(text) {
    return String(text ?? "").replace(/\r\n/g, "\n");
}

/** Empty/whitespace or still exactly one of the built-in starter templates (safe to swap on language change). */
function codeIsSafeToReplaceForLanguageSwitch(raw) {
    const normalized = normalizeEditorText(raw).trimEnd();
    if (!normalized.trim()) return true;
    return Object.values(LANGUAGE_OPTIONS).some((opt) => {
        const starter = normalizeEditorText(opt.starterCode).trimEnd();
        return starter === normalized;
    });
}

function codeMatchesLanguageStarter(raw, languageKey) {
    const opt = LANGUAGE_OPTIONS[languageKey];
    if (!opt) return false;
    return (
        normalizeEditorText(raw).trimEnd() === normalizeEditorText(opt.starterCode).trimEnd()
    );
}

function OutputSection({ tone, title, children }) {
    const toneClasses = {
        success: "border-green-200 bg-green-50 text-green-900 dark:border-green-800/50 dark:bg-green-950/30 dark:text-green-100",
        error: "border-red-200 bg-red-50 text-red-900 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-100",
        warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100",
        info: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800/50 dark:bg-blue-950/30 dark:text-blue-100",
    };

    const dotClasses = {
        success: "bg-green-500",
        error: "bg-red-500",
        warning: "bg-amber-500",
        info: "bg-blue-500",
    };

    return (
        <div className={`rounded-lg border p-4 ${toneClasses[tone]}`}>
            <div className="mb-2 flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${dotClasses[tone]}`}></div>
                <span className="font-medium">{title}</span>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">{children}</pre>
        </div>
    );
}

function buildLineComparison(expectedOutput = "", actualOutput = "") {
    const expectedLines = (expectedOutput || "").split('\n');
    const actualLines = (actualOutput || "").split('\n');
    const maxLength = Math.max(expectedLines.length, actualLines.length);
    let firstDiffLine = -1;

    const lines = Array.from({ length: maxLength }, (_, index) => {
        const expectedLine = expectedLines[index] || "";
        const actualLine = actualLines[index] || "";
        const matches = normalizeOutput(expectedLine) === normalizeOutput(actualLine);

        if (!matches && firstDiffLine === -1) {
            firstDiffLine = index + 1;
        }

        return {
            lineNumber: index + 1,
            expectedLine,
            actualLine,
            matches,
        };
    });

    return { lines, firstDiffLine, expectedLines, actualLines };
}

function ComparisonPanel({ expectedOutput, actualOutput }) {
    const { lines, firstDiffLine, expectedLines, actualLines } = buildLineComparison(expectedOutput, actualOutput);

    const getPossibleCause = () => {
        if (actualLines.length < expectedLines.length) return "Output is shorter than expected. Missing data?";
        if (actualLines.length > expectedLines.length) return "Output is longer than expected. Extra prints or wrong logic?";
        if (firstDiffLine !== -1) return "Data mismatch. Check your logic for the given line.";
        return null;
    };

    return (
        <div className="space-y-3">
            {firstDiffLine !== -1 && (
                <div className="rounded-lg bg-amber-50 p-2 text-xs font-medium text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                    <span className="font-bold">Hint:</span> First difference found at line {firstDiffLine}. {getPossibleCause()}
                </div>
            )}
            <div className="rounded-xl border border-gray-200 bg-white/90 p-4 dark:border-gray-700/70 dark:bg-gray-900/70">
                <div className="mb-3 grid gap-3 sm:grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                        Line
                    </p>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-green-700 dark:text-green-300">
                        Expected
                    </p>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                        Actual
                    </p>
                </div>
                <div className="space-y-2">
                    {lines.length > 0 ? lines.map((line) => (
                        <div
                            key={`${line.lineNumber}-${line.expectedLine}-${line.actualLine}`}
                            className="grid gap-3 rounded-xl sm:grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)]"
                        >
                            <div className={`rounded-lg px-3 py-2 text-xs font-semibold ${line.matches ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-200' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-200'}`}>
                                Line {line.lineNumber}
                            </div>
                            <pre className={`overflow-x-auto whitespace-pre-wrap rounded-lg px-3 py-2 font-mono text-sm leading-relaxed ${line.matches ? 'bg-green-50 text-green-900 dark:bg-green-950/20 dark:text-green-100' : 'bg-red-50 text-red-900 dark:bg-red-950/20 dark:text-red-100'}`}>{line.expectedLine || ' '}</pre>
                            <pre className={`overflow-x-auto whitespace-pre-wrap rounded-lg px-3 py-2 font-mono text-sm leading-relaxed ${line.matches ? 'bg-green-50 text-green-900 dark:bg-green-950/20 dark:text-green-100' : 'bg-red-50 text-red-900 dark:bg-red-950/20 dark:text-red-100'}`}>{line.actualLine || ' '}</pre>
                        </div>
                    )) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No expected output provided.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

function OverlayPanel({ title, subtitle, onClose, children }) {
    return createPortal(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-[0_30px_120px_-36px_rgba(15,23,42,0.7)] dark:bg-slate-950">
                <div className="flex items-start justify-between gap-4 border-b border-gray-200 bg-[linear-gradient(180deg,rgba(255,248,239,0.95),rgba(248,250,252,0.88))] px-6 py-5 dark:border-gray-800 dark:bg-[linear-gradient(180deg,rgba(30,41,59,0.92),rgba(2,6,23,0.96))]">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-600 dark:text-amber-300">{subtitle}</p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white/90 text-gray-600 transition hover:border-gray-300 hover:text-gray-900 dark:border-gray-700 dark:bg-slate-900/70 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:text-white"
                        aria-label="Close overlay"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(248,250,252,0.72),rgba(255,255,255,0.92))] px-6 py-6 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.94))]">
                    {children}
                </div>
            </div>
        </div>,
        document.body,
    );
}

function ButtonSpinner() {
    return (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="9" className="opacity-30" stroke="currentColor" strokeWidth="2.2" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
    );
}

function normalizeOutput(value = "") {
    return value.replace(/\r\n/g, "\n").trim();
}

function formatTimerLabel(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const TIMER_PRESETS = [
    { label: "15m", value: 15 * 60 },
    { label: "30m", value: 30 * 60 },
    { label: "45m", value: 45 * 60 },
    { label: "60m", value: 60 * 60 },
];

const SESSION_MODE_LABELS = {
    peer_practice: 'Peer Practice',
    mock_interview: 'Mock Interview',
    mentoring: 'Mentoring',
};

function Workspace({ socketRef, roomId, roomState, currentSocketId, currentRole = 'Peer', currentUsername = 'Anonymous', users = [] }) {
    const rawServerUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();
    // Fallback for development if frontend is on 5173 and backend is on 5000
    const serverUrl = (rawServerUrl.includes(":5173") && !import.meta.env.VITE_SERVER_URL)
        ? rawServerUrl.replace(":5173", ":5000")
        : rawServerUrl;

    const editorRef = useRef(null);
    const remoteCursorMarkersRef = useRef({});
    const myColorRef = useRef('#f59e0b');
    const settingsRef = useRef(null);
    const selectedLanguageRef = useRef(DEFAULT_LANGUAGE);
    const isUserLanguageChangeRef = useRef(false);
    const navigate = useNavigate();
    const {
        ghostHint,
        fetchHint,
        acceptGhostHint,
        showDropdown,
        aiHints,
        isLoading,
        fetchAIHints,
        closeDropdown,
        applyHint
    } = useAIHint(
        editorRef,
        socketRef,
        roomId
    );
    const [output, setOutput] = useState("");
    const [showSettings, setShowSettings] = useState(false);
    const [copyingRoomLink, setCopyingRoomLink] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState(DEFAULT_LANGUAGE);
    const [lastRunMeta, setLastRunMeta] = useState(null);
    const [timerDuration, setTimerDuration] = useState(45 * 60);
    const [timeRemaining, setTimeRemaining] = useState(45 * 60);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [showOutputModal, setShowOutputModal] = useState(false);
    const [reviewContent, setReviewContent] = useState(null);
    const [isReviewLoading, setIsReviewLoading] = useState(false);
    const [isOutputCollapsed, setIsOutputCollapsed] = useState(false);
    const [activeRightTab, setActiveRightTab] = useState("output");
    /** Brief highlight after a new report is generated (Output-like priority). */
    const [isNewReport, setIsNewReport] = useState(false);
    const [runBy, setRunBy] = useState('');
    const [reportLoading, setReportLoading] = useState(false);
    const [lastReportPayload, setLastReportPayload] = useState(null);
    const [lastShareId, setLastShareId] = useState('');
    const [showReportModal, setShowReportModal] = useState(false);
    const [showAnalysisModal, setShowAnalysisModal] = useState(false);
    const [showChecklist, setShowChecklist] = useState(false);
    const [rightPanelWidthPct, setRightPanelWidthPct] = useState(() => {
        const raw = Number(localStorage.getItem("forkspace.rightPanelWidthPct"));
        if (Number.isFinite(raw) && raw >= 25 && raw <= 50) return raw;
        return 35;
    });
    const [testGenerateSignal, setTestGenerateSignal] = useState(0);
    const [editorContentVersion, setEditorContentVersion] = useState(0);
    const [collabHintDismissed, setCollabHintDismissed] = useState(false);

    useEffect(() => {
        setCollabHintDismissed(false);
    }, [roomId]);

    useEffect(() => {
        if (activeRightTab !== "report") {
            setIsNewReport(false);
        }
    }, [activeRightTab]);

    useEffect(() => {
        if (!isNewReport) return undefined;
        const id = window.setTimeout(() => setIsNewReport(false), 12000);
        return () => window.clearTimeout(id);
    }, [isNewReport]);

    useEffect(() => {
        localStorage.setItem(
            "forkspace.rightPanelWidthPct",
            String(rightPanelWidthPct),
        );
    }, [rightPanelWidthPct]);

    const startPanelResize = useCallback((event) => {
        event.preventDefault();
        const startX = event.clientX;
        const startPct = rightPanelWidthPct;
        const onMove = (ev) => {
            const deltaPx = ev.clientX - startX;
            const deltaPct = (deltaPx / window.innerWidth) * 100;
            const next = Math.max(25, Math.min(50, startPct - deltaPct));
            setRightPanelWidthPct(next);
        };
        const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }, [rightPanelWidthPct]);

    const renderReviewContent = () => {
        if (isReviewLoading) {
            return (
                <div className="flex min-h-[14rem] items-center justify-center rounded-[1.4rem] border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-800/40 dark:bg-amber-900/20">
                    <div className="flex items-center gap-3 text-sm font-medium text-amber-800 dark:text-amber-200">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-500 border-t-transparent"></div>
                        Analyzing solution...
                    </div>
                </div>
            );
        }

        if (!reviewContent) {
            return (
                <div className="rounded-[1.4rem] border border-dashed border-gray-300 bg-white/80 p-5 text-sm leading-7 text-gray-600 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-400">
                    Run `Review Solution` to get complexity, bug checks, and optimization suggestions here.
                </div>
            );
        }

        return (
            <div className="space-y-5">
                {reviewContent.summary && (
                    <div className="rounded-[1.4rem] border border-gray-200/80 bg-white/90 p-5 shadow-sm dark:border-gray-700/80 dark:bg-slate-900/70">
                        <p className="text-base leading-7 text-slate-800 dark:text-slate-200">{reviewContent.summary}</p>
                        {reviewContent?.complexity_reasoning ? (
                            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">{reviewContent.complexity_reasoning}</p>
                        ) : null}
                    </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[1.35rem] border border-blue-200 bg-blue-50/80 p-4 dark:border-blue-800/40 dark:bg-blue-950/20">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Time Complexity</p>
                        <p className="mt-2 text-lg font-semibold text-blue-950 dark:text-blue-100">{reviewContent?.time_complexity || 'N/A'}</p>
                    </div>
                    <div className="rounded-[1.35rem] border border-purple-200 bg-purple-50/80 p-4 dark:border-purple-800/40 dark:bg-purple-950/20">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-purple-700 dark:text-purple-300">Space Complexity</p>
                        <p className="mt-2 text-lg font-semibold text-purple-950 dark:text-purple-100">{reviewContent?.space_complexity || 'N/A'}</p>
                    </div>
                </div>

                {reviewContent?.bugs?.length > 0 && (
                    <div className="rounded-[1.4rem] border border-red-200 bg-red-50/80 p-5 dark:border-red-800/40 dark:bg-red-950/20">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-red-700 dark:text-red-300">Potential Bugs</h3>
                        <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-7 text-red-900 dark:text-red-200">
                            {reviewContent.bugs.map((bug, index) => <li key={index}>{bug}</li>)}
                        </ul>
                    </div>
                )}

                {reviewContent?.style_issues?.length > 0 && (
                    <div className="rounded-[1.4rem] border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-800/40 dark:bg-amber-950/20">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Style And Readability</h3>
                        <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-7 text-amber-900 dark:text-amber-200">
                            {reviewContent.style_issues.map((issue, index) => <li key={index}>{issue}</li>)}
                        </ul>
                    </div>
                )}

                {reviewContent?.optimization_suggestion && (
                    <div className="rounded-[1.4rem] border border-emerald-200 bg-emerald-50/80 p-5 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Optimization Suggestion</h3>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div className="rounded-2xl bg-white/80 p-4 dark:bg-slate-900/50">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Before</p>
                                <p className="mt-2 text-sm leading-7 text-slate-800 dark:text-slate-200">{reviewContent.optimization_suggestion.before}</p>
                            </div>
                            <div className="rounded-2xl bg-white/80 p-4 dark:bg-slate-900/50">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">After</p>
                                <p className="mt-2 text-sm leading-7 text-slate-800 dark:text-slate-200">{reviewContent.optimization_suggestion.after}</p>
                            </div>
                        </div>
                        <p className="mt-4 text-sm leading-7 text-emerald-900 dark:text-emerald-100">{reviewContent.optimization_suggestion.benefit}</p>
                    </div>
                )}
            </div>
        );
    };

    const sampleInput = roomState?.problem?.sampleInput || "";
    const expectedOutput = roomState?.problem?.sampleOutput || "";
    const session = useMemo(() => (
        roomState?.session || {
            mode: 'peer_practice',
            driverSocketId: '',
            navigatorSocketId: '',
            approachNotes: '',
            edgeCaseChecklist: [],
            runHistory: [],
            mentorNotes: '',
            mockSummary: null,
            mockLocked: false,
        }
    ), [roomState?.session]);

    const problemToolbarMeta = useMemo(() => {
        const prob = roomState?.problem;
        const snap = prob?.problemSnapshot;
        if (!prob && !snap) return null;
        const title = snap?.title || prob?.title || "";
        const tags =
            Array.isArray(snap?.tags) && snap.tags.length
                ? snap.tags
                : Array.isArray(prob?.tags)
                  ? prob.tags
                  : [];
        const rating = snap?.rating != null ? snap.rating : prob?.rating;
        const solved =
            typeof snap?.solvedCount === "number" ? snap.solvedCount : null;
        const diff =
            snap?.difficultyLabel || prob?.difficultyLabel || prob?.difficulty;
        const showBar =
            (title && title !== "Untitled Practice Problem") ||
            tags.length > 0 ||
            (rating != null && String(rating).length > 0) ||
            solved != null ||
            (diff != null && String(diff).length > 0) ||
            prob?.problemSource === "codeforces";
        if (!showBar) return null;
        return { title, tags, rating, solved, diff };
    }, [roomState?.problem]);

    const normalizedRole = (currentRole || 'Peer').toLowerCase();
    const isDriver = session.driverSocketId === currentSocketId;
    const isNavigator = session.navigatorSocketId === currentSocketId;
    const driverUser = users.find((user) => user.socketId === session.driverSocketId);
    const navigatorUser = users.find((user) => user.socketId === session.navigatorSocketId);
    const hasAssignedDriver = Boolean(session.driverSocketId);
    const isMentoringMode = session.mode === 'mentoring';
    const isMockMode = session.mode === 'mock_interview';
    const isLearnerRole = normalizedRole === 'learner';
    const isInterviewerRole = normalizedRole === 'interviewer';
    const isCandidateRole = normalizedRole === 'candidate';
    const canRunInCurrentMode = !isMockMode || !hasAssignedDriver || isDriver;
    const checklistTotal = session.edgeCaseChecklist.length;
    const checklistCompleted = session.edgeCaseChecklist.filter((item) => item.checked).length;
    const criticalOpenCount = session.edgeCaseChecklist.filter(
        (item) => item.priority === 'critical' && !item.checked
    ).length;
    const isRunBusy = lastRunMeta?.status === "Running";
    const isSubmitBusy = lastRunMeta?.status === "Submitting samples...";

    const canEdit =
        isMentoringMode
            ? isLearnerRole
                ? false
                : true
            : isMockMode
                ? isInterviewerRole
                    ? false
                    : isCandidateRole
                        ? true
                        : hasAssignedDriver
                            ? isDriver
                            : true
                : hasAssignedDriver
                    ? isDriver
                    : true;
    const editorUnlocked = canEdit && !session.mockLocked;

    const controlTone = editorUnlocked
        ? isDriver
            ? 'driver'
            : isMentoringMode
                ? 'mentor'
                : isMockMode
                    ? 'candidate'
                    : 'shared'
        : isNavigator
            ? 'navigator'
            : 'locked';

    const participationLabel =
        isDriver
            ? 'Driver'
            : isNavigator
                ? 'Navigator'
                : 'Observer';
    const isDesktopLayout =
        typeof window !== "undefined" ? window.innerWidth >= 1280 : false;

    const handleSwapRoles = () => {
        socketRef.current?.emit('swap-roles', { roomId });
    };

    const toggleEdgeCase = (id) => {
        const nextChecklist = session.edgeCaseChecklist.map((item) =>
            item.id === id ? { ...item, checked: !item.checked } : item
        );
        socketRef.current?.emit('session-update', {
            roomId,
            session: { ...session, edgeCaseChecklist: nextChecklist },
        });
    };

    const createMockSummaryShare = useCallback(async (summaryPayload) => {
        try {
            const response = await axios.post(`${serverUrl}/api/mock-summary`, {
                roomId,
                summary: summaryPayload,
            }, {
                headers: getAuthHeaders(),
            });

            return response.data.summaryId;
        } catch {
            return null;
        }
    }, [roomId, serverUrl]);

    const reviewSolution = async () => {
        setIsReviewLoading(true);
        setShowAnalysisModal(true);
        try {
            const code = editorRef.current?.getValue() || "";
            setReviewContent(null);
            const response = await axios.post(`${serverUrl}/api/ai/review`, {
                code,
                problem: roomState?.problem,
                language: selectedLanguageRef.current,
                roomId,
            }, {
                headers: getAuthHeaders(),
            });
            setReviewContent(response.data);
        } catch {
            toast.error("Failed to get review");
        } finally {
            setIsReviewLoading(false);
        }
    };


    useEffect(() => {
        async function connect() {
            editorRef.current = Codemirror.fromTextArea(
                document.getElementById("realtimeEditor"),
                {
                    mode: LANGUAGE_OPTIONS[DEFAULT_LANGUAGE].editorMode,
                    theme: "dracula",
                    autoCloseTags: true,
                    autoCloseBrackets: true,
                    lineNumbers: true,
                }
            );

            // Override font family to use monospace instead of Sora
            const cmWrapper = editorRef.current.getWrapperElement();
            if (cmWrapper) {
                cmWrapper.style.fontFamily = "'Fira Code', 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace";
            }

            editorRef.current.on("change", (instance, changes) => {
                const { origin } = changes;
                setEditorContentVersion((v) => v + 1);
                if (origin !== "setValue") {
                    setCollabHintDismissed(true);
                }
                const code = instance.getValue();
                if (origin !== "setValue") {
                    socketRef.current.emit("code-change", {
                        roomId,
                        code,
                    });
                }
            });

            editorRef.current.on("cursorActivity", (instance) => {
                const socket = socketRef.current;
                if (!socket) return;
                const selections = instance.listSelections?.() || [];
                const primary = selections[0];
                if (!primary) return;
                const anchorIndex = instance.indexFromPos(primary.anchor);
                const headIndex = instance.indexFromPos(primary.head);
                socket.emit("cursor-move", {
                    roomId,
                    anchor: anchorIndex,
                    head: headIndex,
                });
            });
        }
        connect();
    }, [roomId, socketRef]);

    useEffect(() => {
        if (!editorRef.current) return;

        const wrapper = editorRef.current.getWrapperElement();
        editorRef.current.setOption("readOnly", editorUnlocked ? false : "nocursor");

        if (wrapper) {
            wrapper.classList.remove(
                "forkspace-editor-driver",
                "forkspace-editor-navigator",
                "forkspace-editor-mentor",
                "forkspace-editor-candidate",
                "forkspace-editor-shared",
                "forkspace-editor-locked",
            );
            wrapper.classList.add(`forkspace-editor-${controlTone}`);
        }
    }, [controlTone, editorUnlocked]);

    useEffect(() => {
        if (!editorRef.current || !roomState) return;

        const serverLanguage = roomState.language;
        if (serverLanguage && LANGUAGE_OPTIONS[serverLanguage]) {
            if (serverLanguage === selectedLanguageRef.current) {
                isUserLanguageChangeRef.current = false;
            } else if (!isUserLanguageChangeRef.current) {
                const nextLanguage = serverLanguage;
                selectedLanguageRef.current = nextLanguage;
                setSelectedLanguage(nextLanguage);
                editorRef.current.setOption("mode", LANGUAGE_OPTIONS[nextLanguage].editorMode);
                const cur = editorRef.current.getValue();
                if (codeIsSafeToReplaceForLanguageSwitch(cur)) {
                    const nextCode = LANGUAGE_OPTIONS[nextLanguage].starterCode;
                    editorRef.current.setValue(nextCode);
                    socketRef.current?.emit("code-change", { roomId, code: nextCode });
                }
            }
        }

        // Only set the value if the editor is currently empty (initial load)
        const currentCode = editorRef.current.getValue();
        if (typeof roomState.code === "string" && !currentCode.trim() && roomState.code.trim()) {
            editorRef.current.setValue(roomState.code);
        }
    }, [roomState, roomId]);

    useEffect(() => {
        const socket = socketRef.current;

        if (!socket || !editorRef.current) return;

        const handleCodeChange = ({ code }) => {
            if (code !== null && editorRef.current) {
                const currentCode = editorRef.current.getValue();
                if (code !== currentCode) {
                    const cursor = editorRef.current.getCursor();
                    const scrollInfo = editorRef.current.getScrollInfo();

                    editorRef.current.setValue(code);

                    editorRef.current.setCursor(cursor);
                    editorRef.current.scrollTo(scrollInfo.left, scrollInfo.top);
                }
            }
        };

        socket.on("code-change", handleCodeChange);
        socket.on("user-color-assigned", ({ color }) => {
            if (typeof color === 'string' && color.trim()) {
                myColorRef.current = color;
            }
        });
        socket.on("remote-cursor-update", ({ socketId, anchor, head, username, color }) => {
            if (!editorRef.current || !socketId) return;
            if (socketId === currentSocketId) return;

            const existingMarkers = remoteCursorMarkersRef.current[socketId] || [];
            existingMarkers.forEach((marker) => marker?.clear?.());

            const safeAnchor = Math.max(0, Math.min(anchor, editorRef.current.getValue().length));
            const safeHead = Math.max(0, Math.min(head, editorRef.current.getValue().length));
            const cursorPos = editorRef.current.posFromIndex(safeHead);
            const anchorPos = editorRef.current.posFromIndex(safeAnchor);
            const selectionStart = safeAnchor <= safeHead ? anchorPos : cursorPos;
            const selectionEnd = safeAnchor <= safeHead ? cursorPos : anchorPos;
            const userColor = color || '#f59e0b';

            const cursorEl = document.createElement('span');
            cursorEl.className = 'remote-cursor-widget';
            cursorEl.style.borderLeft = `2px solid ${userColor}`;

            const labelEl = document.createElement('span');
            labelEl.className = 'remote-cursor-label';
            labelEl.style.backgroundColor = userColor;
            labelEl.textContent = username || 'Guest';
            cursorEl.appendChild(labelEl);

            const cursorMarker = editorRef.current.setBookmark(cursorPos, {
                widget: cursorEl,
                insertLeft: false,
            });

            const markers = [cursorMarker];
            if (safeAnchor !== safeHead) {
                const selectionMarker = editorRef.current.markText(selectionStart, selectionEnd, {
                    className: 'remote-selection',
                    css: `background: ${userColor}33; border-radius: 2px;`,
                });
                markers.push(selectionMarker);
            }

            remoteCursorMarkersRef.current[socketId] = markers;
        });
        socket.on("user-left", ({ socketId }) => {
            const markers = remoteCursorMarkersRef.current[socketId] || [];
            markers.forEach((marker) => marker?.clear?.());
            delete remoteCursorMarkersRef.current[socketId];
        });
        socket.on("run-result", ({ result, runBy: resultRunBy }) => {
            const languageConfig = LANGUAGE_OPTIONS[selectedLanguageRef.current] || LANGUAGE_OPTIONS[DEFAULT_LANGUAGE];
            const { stdout, stderr, compile_output, message, time, memory } = result || {};
            const normalizedStdout = normalizeOutput(stdout || "");
            const normalizedExpectedOutput = normalizeOutput(expectedOutput);
            const hasCompileError = Boolean(compile_output);
            const hasRuntimeError = Boolean(stderr);
            const sampleMatched =
                normalizedExpectedOutput &&
                !hasCompileError &&
                !hasRuntimeError &&
                normalizedStdout === normalizedExpectedOutput;
            const sampleMismatched =
                normalizedExpectedOutput &&
                !hasCompileError &&
                !hasRuntimeError &&
                normalizedStdout !== normalizedExpectedOutput;

            setRunBy(resultRunBy || '');
            setLastRunMeta({
                languageLabel: languageConfig.label,
                hasStdin: sampleInput.trim().length > 0,
                inputSource: sampleInput.trim().length > 0 ? "sample" : "none",
                status: hasCompileError ? "Compilation Error" : hasRuntimeError ? "Runtime Error" : "Completed",
                time: time || "N/A",
                memory: memory || "N/A",
                sampleCheck: sampleMatched ? "passed" : sampleMismatched ? "mismatch" : normalizedExpectedOutput ? "not_checked" : "not_available",
                updatedAt: Date.now(),
            });

            const nextOutput = (
                <div className="space-y-4 text-sm">
                    {sampleMatched && <OutputSection tone="success" title="Passed Sample">Actual output matches the expected output for the shared sample test case.</OutputSection>}
                    {sampleMismatched && <ComparisonPanel expectedOutput={expectedOutput} actualOutput={stdout} />}
                    {compile_output && <OutputSection tone="warning" title="Compilation Error">{compile_output}</OutputSection>}
                    {stderr && <OutputSection tone="error" title="Runtime Error">{stderr}</OutputSection>}
                    {stdout && <OutputSection tone="success" title="Program Output">{stdout}</OutputSection>}
                    {message && <OutputSection tone="info" title="System Message">{message}</OutputSection>}
                </div>
            );
            setOutput(nextOutput);
            setShowOutputModal(true);
        });
        socket.on("run-error", ({ error }) => {
            const message = error || "Run request failed";
            toast.error(message);
            setLastRunMeta((prev) => ({
                ...(prev || {}),
                status: "Request Failed",
            }));
        });
        socket.on("language-change", ({ language }) => {
            if (!LANGUAGE_OPTIONS[language]) return;

            // Don't override if this is a user-initiated change (to prevent echo)
            if (isUserLanguageChangeRef.current) return;

            selectedLanguageRef.current = language;
            setSelectedLanguage(language);
            editorRef.current?.setOption("mode", LANGUAGE_OPTIONS[language].editorMode);

            const cur = editorRef.current?.getValue() ?? "";
            if (codeIsSafeToReplaceForLanguageSwitch(cur)) {
                const nextCode = LANGUAGE_OPTIONS[language].starterCode;
                editorRef.current?.setValue(nextCode);
                socketRef.current?.emit("code-change", { roomId, code: nextCode });
            }
        });

        return () => {
            socket.off("code-change", handleCodeChange);
            socket.off("user-color-assigned");
            socket.off("remote-cursor-update");
            socket.off("user-left");
            socket.off("run-result");
            socket.off("run-error");
            socket.off("language-change");
            Object.values(remoteCursorMarkersRef.current).forEach((markers) => {
                markers.forEach((marker) => marker?.clear?.());
            });
            remoteCursorMarkersRef.current = {};
        };
    }, [socketRef, roomId, currentSocketId, expectedOutput, sampleInput]);

    // AI Hint Keymap
    useEffect(() => {
        const cm = editorRef.current;
        if (!cm) return;

        // Keymap
        cm.addKeyMap({
            "Ctrl-Space": fetchHint,
            Tab: () => {
                if (ghostHint) acceptGhostHint();
                else cm.replaceSelection("\t");
            },
            Esc: () => {
                // Clear ghost hint if available
                if (ghostHint) {
                    // Assuming there's a clearGhostHint function or we can set ghostHint to null
                    // This would need to be implemented in the useAIHint hook
                }
            },
        });
    }, [ghostHint, fetchHint, acceptGhostHint]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showDropdown) {
                const dropdown = event.target.closest('.ai-dropdown');
                const aiButton = event.target.closest('.ai-button');

                if (!dropdown && !aiButton) {
                    closeDropdown();
                }
            }
        };

        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showDropdown, closeDropdown]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showSettings && settingsRef.current && !settingsRef.current.contains(event.target)) {
                setShowSettings(false);
            }
        };

        if (showSettings) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showSettings]);

    useEffect(() => {
        if (!isTimerRunning) {
            return undefined;
        }

        const intervalId = window.setInterval(() => {
            setTimeRemaining((currentValue) => (currentValue <= 1 ? 0 : currentValue - 1));
        }, 1000);

        return () => window.clearInterval(intervalId);
    }, [
        createMockSummaryShare,
        currentUsername,
        driverUser?.username,
        isCandidateRole,
        isInterviewerRole,
        isMockMode,
        isTimerRunning,
        lastRunMeta?.sampleCheck,
        lastRunMeta?.status,
        navigatorUser?.username,
        output,
        roomId,
        roomState?.problem?.title,
        session,
        socketRef,
        timerDuration,
    ]);

    useEffect(() => {
        if (!isMockMode || timeRemaining !== 0 || !isTimerRunning) {
            return;
        }

        const finishMockRound = async () => {
            setIsTimerRunning(false);

            const snapshot = {
                capturedAt: new Date().toISOString(),
                durationLabel: formatTimerLabel(timerDuration),
                timerFinished: true,
                candidate: isCandidateRole ? currentUsername : driverUser?.username || currentUsername,
                interviewer: isInterviewerRole ? currentUsername : navigatorUser?.username || 'Not assigned',
                problemTitle: roomState?.problem?.title || 'Untitled Practice Problem',
                latestRunStatus: lastRunMeta?.status || 'Not run yet',
                latestSampleCheck: lastRunMeta?.sampleCheck || 'n/a',
                codeLength: (editorRef.current?.getValue() || '').trim().length,
                linesWritten: editorRef.current?.lineCount?.() || 0,
                finalOutputPreview: typeof output === 'string' ? output : '',
            };
            const shareId = await createMockSummaryShare(snapshot);

            socketRef.current?.emit('session-update', {
                roomId,
                session: {
                    ...session,
                    mockLocked: true,
                    mockSummary: {
                        ...snapshot,
                        shareId,
                    },
                },
            });
            toast.success("Mock timer complete. Session snapshot saved.");

            if (getAuthToken()) {
                try {
                    const intelRes = await axios.post(
                        `${serverUrl}/api/session-intelligence/report`,
                        {
                            roomId,
                            saveShare: true,
                            endSession: true,
                            endReason: "mock_timer",
                        },
                        { headers: getAuthHeaders() },
                    );
                    if (intelRes.data?.shareId) {
                        setLastShareId(intelRes.data.shareId);
                        setLastReportPayload(intelRes.data.report);
                        setIsOutputCollapsed(false);
                        setIsNewReport(true);
                        setShowReportModal(true);
                        toast.success("Session intelligence report saved.");
                    }
                } catch {
                    /* optional — room may have no intelligence events yet */
                }
            }
        };

        finishMockRound();
    }, [
        createMockSummaryShare,
        currentUsername,
        driverUser?.username,
        isCandidateRole,
        isInterviewerRole,
        isMockMode,
        isTimerRunning,
        lastRunMeta?.sampleCheck,
        lastRunMeta?.status,
        navigatorUser?.username,
        output,
        roomId,
        roomState?.problem?.title,
        session,
        serverUrl,
        socketRef,
        timeRemaining,
        timerDuration,
    ]);

    const handleCopyRoomId = async () => {
        try {
            setCopyingRoomLink(true);
            const inviteUrl = `${window.location.origin}/editor/${roomId}`;
            await navigator.clipboard.writeText(inviteUrl);
            toast.success("Room link copied");
            setShowSettings(false);
        } catch {
            toast.error("Failed to copy link");
        } finally {
            setTimeout(() => setCopyingRoomLink(false), 900);
        }
    };

    const handleGoHome = () => {
        setShowSettings(false);
        navigate("/");
    };

    const handleLeaveRoom = () => {
        setShowSettings(false);
        socketRef.current?.disconnect();
        navigate("/");
    };

    const handleTimerPresetChange = (event) => {
        const nextDuration = Number(event.target.value);
        setTimerDuration(nextDuration);
        setTimeRemaining(nextDuration);
        setIsTimerRunning(false);
        if (isMockMode && session.mockLocked) {
            socketRef.current?.emit('session-update', {
                roomId,
                session: {
                    ...session,
                    mockLocked: false,
                },
            });
        }
    };

    const handleTimerToggle = () => {
        if (timeRemaining === 0) {
            setTimeRemaining(timerDuration);
        }

        setIsTimerRunning((currentValue) => !currentValue);
    };

    const handleTimerReset = () => {
        setIsTimerRunning(false);
        setTimeRemaining(timerDuration);
        if (isMockMode && session.mockLocked) {
            socketRef.current?.emit('session-update', {
                roomId,
                session: {
                    ...session,
                    mockLocked: false,
                },
            });
        }
    };

    const syncCodeToRoom = (nextCode) => {
        socketRef.current?.emit("code-change", {
            roomId,
            code: nextCode,
        });
    };

    const handleLanguageChange = useCallback((event) => {
        const next = event.target.value;
        if (!LANGUAGE_OPTIONS[next]) return;

        const prevLang = selectedLanguageRef.current;
        if (prevLang === next) return;

        const currentCode = editorRef.current?.getValue() ?? "";
        const safeReplace = codeIsSafeToReplaceForLanguageSwitch(currentCode);

        if (!safeReplace) {
            const ok = window.confirm(
                `Switch to ${LANGUAGE_OPTIONS[next].label}? The editor will be reset to the default template for that language and your current code will be replaced.`,
            );
            if (!ok) {
                event.target.value = prevLang;
                return;
            }
        }

        const nextCode = LANGUAGE_OPTIONS[next].starterCode;

        setCollabHintDismissed(false);
        isUserLanguageChangeRef.current = true;
        selectedLanguageRef.current = next;
        setSelectedLanguage(next);
        editorRef.current?.setOption("mode", LANGUAGE_OPTIONS[next].editorMode);
        editorRef.current?.setValue(nextCode);
        socketRef.current?.emit("code-change", { roomId, code: nextCode });
        socketRef.current?.emit("language-change", { roomId, language: next });
    }, [roomId]);

    const handleResetCode = () => {
        setCollabHintDismissed(false);
        const nextCode = LANGUAGE_OPTIONS[selectedLanguageRef.current].starterCode;
        editorRef.current?.setValue(nextCode);
        syncCodeToRoom(nextCode);
    };

    const handleFormatCode = () => {
        const currentCode = editorRef.current?.getValue() ?? "";
        const formattedCode = formatCode(selectedLanguageRef.current, currentCode);

        if (formattedCode !== currentCode) {
            editorRef.current?.setValue(formattedCode);
            syncCodeToRoom(formattedCode);
            toast.success("Code formatted");
        } else {
            toast("Code is already formatted enough for the current formatter.");
        }
    };

    const runCode = async () => {
        if (!canRunInCurrentMode) {
            toast.error("Only the Driver can run code in mock mode.");
            return;
        }
        const rawCode = editorRef.current.getValue();
        const languageConfig = LANGUAGE_OPTIONS[selectedLanguageRef.current] || LANGUAGE_OPTIONS[DEFAULT_LANGUAGE];
        const fallbackSampleInput = sampleInput.trim();
        const effectiveStdin = sampleInput;
        const inputSource = fallbackSampleInput.length > 0 ? "sample" : "none";
        const normalizedExpectedOutput = normalizeOutput(expectedOutput);
        setActiveRightTab("output");

        setLastRunMeta({
            languageLabel: languageConfig.label,
            hasStdin: effectiveStdin.trim().length > 0,
            inputSource,
            status: "Running",
            time: null,
            memory: null,
            sampleCheck: normalizedExpectedOutput ? "pending" : "not_available",
            updatedAt: Date.now(),
        });
        setOutput(
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-blue-700 dark:text-blue-400 font-medium">Running Code...</span>
                </div>
            </div>
        );

        try {
            const ack = await new Promise((resolve) => {
                const timeoutId = window.setTimeout(() => {
                    resolve({ ok: false, error: "Realtime run request timed out" });
                }, 15000);

                socketRef.current?.emit("run-code", {
                    roomId,
                    code: rawCode,
                    languageId: languageConfig.judge0Id,
                    stdin: effectiveStdin,
                }, (payload) => {
                    window.clearTimeout(timeoutId);
                    resolve(payload);
                });
            });

            if (!ack?.ok) {
                throw new Error(ack?.error || "Run request failed");
            }
        } catch (error) {
            const runErrorMessage =
                error?.response?.data?.error ||
                error?.message ||
                "Run request failed";
            setLastRunMeta({
                languageLabel: languageConfig.label,
                hasStdin: effectiveStdin.trim().length > 0,
                inputSource,
                status: "Request Failed",
                time: null,
                memory: null,
                sampleCheck: normalizedExpectedOutput ? "not_checked" : "not_available",
            });
            setOutput(
                <div className="dark:text-red-200 p-4 text-red-800">
                    <p>Error running code: {runErrorMessage}</p>
                </div>
            );
            setShowOutputModal(true);
            toast.error(runErrorMessage);
        }
    };

    const generateSessionReport = async (options = {}) => {
        const { endSession = false, endReason = "manual", wholeRoom = false } = options;
        setReportLoading(true);
        try {
            const res = await axios.post(
                `${serverUrl}/api/session-intelligence/report`,
                {
                    roomId,
                    saveShare: true,
                    endSession,
                    endReason: endSession ? endReason : undefined,
                    personal: wholeRoom ? "all" : undefined,
                },
                { headers: getAuthHeaders() },
            );
            setLastReportPayload(res.data.report);
            setLastShareId(res.data.shareId || "");
            setIsOutputCollapsed(false);
            setIsNewReport(true);
            setShowReportModal(true);
            toast.success("Session intelligence report is ready.");
        } catch (error) {
            const msg =
                error?.response?.data?.error ||
                error?.message ||
                "Could not generate report";
            toast.error(msg);
        } finally {
            setReportLoading(false);
        }
    };

    const submitSamples = async () => {
        if (!canRunInCurrentMode) {
            toast.error("Only the Driver can run code in mock mode.");
            return;
        }
        const samples = roomState?.problem?.samples || [];
        if (!samples.length) {
            toast.error("Add sample tests in the brief (parsed samples) before submitting.");
            return;
        }
        const rawCode = editorRef.current?.getValue() || "";
        const languageConfig =
            LANGUAGE_OPTIONS[selectedLanguageRef.current] || LANGUAGE_OPTIONS[DEFAULT_LANGUAGE];
        setActiveRightTab("output");
        setLastRunMeta({
            languageLabel: languageConfig.label,
            hasStdin: true,
            inputSource: "suite",
            status: "Submitting samples...",
            time: null,
            memory: null,
            sampleCheck: "pending",
            updatedAt: Date.now(),
        });
        setOutput(
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-800/40 dark:bg-amber-950/20">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Running full sample suite…</p>
            </div>,
        );
        try {
            const { data } = await axios.post(
                `${serverUrl}/api/run-sample-suite`,
                {
                    code: rawCode,
                    languageId: languageConfig.judge0Id,
                    samples,
                    roomId,
                },
                { headers: getAuthHeaders() },
            );
            const { results, summary } = data;
            const allPass = summary?.failed === 0 && summary?.passed === summary?.total;
            setLastRunMeta({
                languageLabel: languageConfig.label,
                hasStdin: true,
                inputSource: "suite",
                status: allPass ? "All samples passed" : "Some samples failed",
                time: null,
                memory: null,
                sampleCheck: allPass ? "passed" : "mismatch",
                updatedAt: Date.now(),
            });
            const blocks = (
                <div className="space-y-3 text-sm">
                    <OutputSection tone={allPass ? "success" : "warning"} title="Sample suite">
                        {`Passed ${summary?.passed ?? 0} / ${summary?.total ?? 0}`}
                    </OutputSection>
                    {results?.map((r) => (
                        <div key={r.id || r.index} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700 dark:bg-gray-800/40">
                            <p className="font-semibold text-gray-900 dark:text-white">Test {r.index}{r.passed ? " ✓" : " ✗"}</p>
                            {r.compile_output ? (
                                <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-gray-800 dark:text-gray-200">{r.compile_output}</pre>
                            ) : null}
                            {r.stderr ? (
                                <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-red-700 dark:text-red-300">{r.stderr}</pre>
                            ) : null}
                            {!r.passed && !r.compile_output && !r.stderr ? (
                                <div className="mt-2">
                                    <ComparisonPanel expectedOutput={r.expectedOutput} actualOutput={r.actualOutput} />
                                </div>
                            ) : null}
                        </div>
                    ))}
                </div>
            );
            setOutput(blocks);
            setShowOutputModal(true);
            if (allPass) {
                toast.success("All parsed samples passed.");
            } else {
                toast.error("Sample suite reported failures.");
            }
        } catch (error) {
            const msg = error?.response?.data?.error || error?.message || "Submit failed";
            toast.error(msg);
            setLastRunMeta((prev) => ({
                ...(prev || {}),
                status: "Submit failed",
                sampleCheck: "not_checked",
                updatedAt: Date.now(),
            }));
        }
    };

    /* editorContentVersion bumps on each CodeMirror change so visibility recomputes when the buffer updates. */
    const collaborationHintVisible = useMemo(() => {
        if (collabHintDismissed || !editorRef.current) return false;
        return codeMatchesLanguageStarter(editorRef.current.getValue(), selectedLanguage);
    }, [collabHintDismissed, selectedLanguage, editorContentVersion]); // eslint-disable-line react-hooks/exhaustive-deps -- editorContentVersion is an intentional invalidation signal

    return (
        <div className="flex h-full min-h-0 flex-col bg-transparent">
            {showOutputModal && output && (
                <OverlayPanel
                    title={lastRunMeta?.inputSource === "suite" ? "Submission Output" : "Run Output"}
                    subtitle="Execution Results"
                    onClose={() => setShowOutputModal(false)}
                >
                    <div className="space-y-5">
                        <div className="grid gap-3 md:grid-cols-4">
                            <div className="rounded-[1.35rem] border border-gray-200/80 bg-white/90 p-4 shadow-sm dark:border-gray-700/80 dark:bg-slate-900/70">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Language</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{lastRunMeta?.languageLabel || LANGUAGE_OPTIONS[selectedLanguageRef.current].label}</p>
                            </div>
                            <div className="rounded-[1.35rem] border border-gray-200/80 bg-white/90 p-4 shadow-sm dark:border-gray-700/80 dark:bg-slate-900/70">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Status</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{lastRunMeta?.status || 'idle'}</p>
                            </div>
                            <div className="rounded-[1.35rem] border border-gray-200/80 bg-white/90 p-4 shadow-sm dark:border-gray-700/80 dark:bg-slate-900/70">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Execution Time</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{lastRunMeta?.time ?? 'Not run yet'}</p>
                            </div>
                            <div className="rounded-[1.35rem] border border-gray-200/80 bg-white/90 p-4 shadow-sm dark:border-gray-700/80 dark:bg-slate-900/70">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Memory</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{lastRunMeta?.memory ?? 'Not run yet'}</p>
                            </div>
                        </div>
                        <div className="rounded-[1.5rem] border border-gray-200/80 bg-white/88 p-5 shadow-sm dark:border-gray-700/80 dark:bg-slate-900/70">
                            {output}
                        </div>
                    </div>
                </OverlayPanel>
            )}
            {showReportModal && lastReportPayload ? (
                <OverlayPanel
                    title="Session Report"
                    subtitle="Session Intelligence"
                    onClose={() => setShowReportModal(false)}
                >
                    <div className="space-y-4">
                        <SessionIntelligenceReportDashboard
                            report={lastReportPayload}
                            title={roomState?.problem?.title || "Practice session"}
                            variant="standalone"
                        />
                        {lastShareId ? (
                            <button
                                type="button"
                                onClick={async () => {
                                    const url = `${window.location.origin}/report/${lastShareId}`;
                                    await navigator.clipboard.writeText(url);
                                    toast.success("Share link copied");
                                }}
                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-200"
                            >
                                Copy share link
                            </button>
                        ) : null}
                    </div>
                </OverlayPanel>
            ) : null}
            {showAnalysisModal ? (
                <OverlayPanel
                    title="Solution Analysis"
                    subtitle="Session Intelligence"
                    onClose={() => setShowAnalysisModal(false)}
                >
                    <div className="space-y-5">
                        <div className="rounded-[1.4rem] border border-gray-200/80 bg-white p-4 dark:border-gray-700/80 dark:bg-[#0d172b]">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowChecklist((v) => !v)}
                                    className="text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                                >
                                    Edge Case Checklist {showChecklist ? "Hide" : "Show"}
                                </button>
                                <div className="flex items-center gap-2 text-[11px]">
                                    <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-gray-600 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-300">
                                        {checklistCompleted}/{checklistTotal}
                                    </span>
                                    {criticalOpenCount > 0 && (
                                        <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-red-700 dark:border-red-800/50 dark:bg-red-950/20 dark:text-red-300">
                                            {criticalOpenCount} critical open
                                        </span>
                                    )}
                                </div>
                            </div>
                            {showChecklist ? (
                            <div className="grid grid-cols-1 gap-2">
                                {session.edgeCaseChecklist.map((item) => (
                                    <label key={item.id} className="group flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-2 py-1.5 hover:border-gray-200 dark:hover:border-gray-700">
                                        <input
                                            type="checkbox"
                                            checked={item.checked}
                                            onChange={() => toggleEdgeCase(item.id)}
                                            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
                                        />
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm ${item.checked ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300'}`}>
                                                    {item.label}
                                                </span>
                                            </div>
                                            {item.hint ? (
                                                <p className="mt-0.5 text-xs leading-5 text-gray-500 dark:text-gray-400">
                                                    {item.hint}
                                                </p>
                                            ) : null}
                                        </div>
                                    </label>
                                ))}
                            </div>
                            ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Checklist is collapsed so analysis stays focused. Expand when you want to verify edge cases.
                                </p>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={reviewSolution}
                                className="inline-flex flex-1 items-center justify-center rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/30"
                            >
                                {isReviewLoading ? <ButtonSpinner /> : null}
                                Re-run analysis
                            </button>
                            <button
                                type="button"
                                onClick={fetchAIHints}
                                className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-stone-50 hover:text-gray-900 dark:border-gray-700 dark:bg-[#111d33] dark:text-gray-200 dark:hover:border-gray-600 dark:hover:bg-[#16243d] dark:hover:text-white"
                            >
                                {isLoading ? <ButtonSpinner /> : null}
                                Refresh AI Hints
                            </button>
                        </div>

                        <div className="rounded-[1.4rem] border border-gray-200/80 bg-white p-4 dark:border-gray-700/80 dark:bg-[#0d172b]">
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">AI Hints</h3>
                                {isLoading ? <span className="text-[10px] text-amber-500">Loading...</span> : null}
                            </div>
                            {aiHints.length > 0 ? (
                                <div className="space-y-2">
                                    {aiHints.map((hint, index) => (
                                        <button
                                            key={index}
                                            type="button"
                                            onClick={() => applyHint(hint)}
                                            className="w-full rounded-xl border border-gray-200 bg-white/80 p-3 text-left text-sm text-gray-700 transition hover:border-amber-200 hover:bg-amber-50/70 dark:border-gray-700 dark:bg-slate-900/50 dark:text-gray-200 dark:hover:border-amber-800/40 dark:hover:bg-amber-900/10"
                                        >
                                            {hint}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-400">No suggestions available right now.</p>
                            )}
                        </div>

                        {renderReviewContent()}
                    </div>
                </OverlayPanel>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-b border-gray-200/80 bg-white px-5 py-2.5 dark:border-gray-700/80 dark:bg-[#081121]">
                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        className="inline-flex h-11 min-h-[2.75rem] items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-teal-600 px-6 text-base font-semibold text-white shadow-md shadow-teal-600/25 ring-2 ring-amber-400/55 ring-offset-2 ring-offset-white transition-all hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-[#081121] dark:hover:bg-teal-500"
                        onClick={runCode}
                        disabled={!canRunInCurrentMode || isRunBusy}
                        title={canRunInCurrentMode ? 'Run code for everyone in this room' : 'Only the Driver can run code in mock mode'}
                    >
                        {isRunBusy ? <ButtonSpinner /> : (
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <polygon points="5,3 19,12 5,21" />
                            </svg>
                        )}
                        {isRunBusy ? "Running..." : "Run"}
                    </button>
                    <button
                        className="inline-flex h-11 min-h-[2.75rem] items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-teal-500/80 bg-white px-5 text-base font-semibold text-teal-800 shadow-sm transition hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:border-teal-600 dark:bg-[#0a1324] dark:text-teal-100 dark:hover:bg-teal-950/40 dark:ring-offset-[#081121]"
                        onClick={submitSamples}
                        disabled={!canRunInCurrentMode || isSubmitBusy}
                        title={canRunInCurrentMode ? "Run all parsed sample tests (Judge0)" : "Only the Driver can submit in mock mode"}
                    >
                        {isSubmitBusy ? <ButtonSpinner /> : (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                        {isSubmitBusy ? "Submitting..." : "Submit"}
                    </button>
                    <span className="mx-1 h-7 w-px bg-gray-300/80 dark:bg-gray-700" />
                    <button
                        type="button"
                        onClick={() => {
                            setShowAnalysisModal(true);
                            if (!reviewContent) {
                                void reviewSolution();
                            }
                        }}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50/90 px-4 text-sm font-semibold text-blue-800 transition hover:bg-blue-100 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-blue-200"
                    >
                        {isReviewLoading ? <ButtonSpinner /> : (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17l-4-4 4-4m6 8l4-4-4-4" />
                            </svg>
                        )}
                        Analyze
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (lastReportPayload) {
                                setShowReportModal(true);
                                return;
                            }
                            void generateSessionReport({ endSession: false });
                        }}
                        disabled={reportLoading}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-4 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800/40 dark:bg-amber-900/25 dark:text-amber-200"
                    >
                        {reportLoading ? <ButtonSpinner /> : (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6m3 6V7m3 10v-3m3 7H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
                            </svg>
                        )}
                        {reportLoading ? "Working..." : "Report"}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setActiveRightTab("tests");
                            setTestGenerateSignal((v) => v + 1);
                        }}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50/90 px-4 text-sm font-semibold text-violet-800 transition hover:bg-violet-100 dark:border-violet-800/40 dark:bg-violet-900/20 dark:text-violet-200"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                        </svg>
                        Generate Tests
                        <span className="rounded-full border border-violet-300/80 bg-white/80 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-violet-700 dark:border-violet-700/60 dark:bg-violet-950/30 dark:text-violet-200">
                            Beta
                        </span>
                    </button>
                    <button
                        className="inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-200 bg-gray-100 px-2.5 text-xs font-medium text-gray-600 shadow-sm transition hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                        onClick={handleResetCode}
                        disabled={!editorUnlocked}
                        title={editorUnlocked ? 'Reset the shared editor' : 'Only the active editor owner can clear code right now'}
                    >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            <line x1="10" x2="10" y1="11" y2="17" />
                            <line x1="14" x2="14" y1="11" y2="17" />
                        </svg>
                        Clear
                    </button>
                </div>

                <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="inline-flex h-10 items-center gap-2 rounded-full border border-gray-200 bg-white/92 px-3 shadow-sm transition hover:bg-white dark:border-gray-700 dark:bg-gray-800/92"
                        title="Go to home"
                    >
                        <img src="/logo.png" alt="ForkSpace logo" className="h-5 w-5 rounded" />
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">ForkSpace</span>
                    </button>
                    <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/92 px-3 py-1.5 shadow-sm dark:border-gray-700 dark:bg-gray-800/92">
                        <label htmlFor="language-select" className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                            Language
                        </label>
                        <select
                            id="language-select"
                            value={selectedLanguage}
                            onChange={handleLanguageChange}
                            disabled={!editorUnlocked}
                            title={LANGUAGE_OPTIONS[selectedLanguage]?.label || "Language"}
                            className="h-8 min-w-[128px] rounded-full border border-gray-200 bg-white px-3 text-sm font-medium text-gray-900 shadow-sm outline-none transition focus:border-gray-400 dark:border-gray-600 dark:bg-[#111d33] dark:text-white"
                        >
                            {Object.entries(LANGUAGE_OPTIONS).map(([languageKey, config]) => (
                                <option key={languageKey} value={languageKey}>
                                    {`${config.optionGlyph ?? ""} ${config.label}`.trim()}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white/92 px-3 py-1.5 shadow-sm dark:border-gray-700 dark:bg-gray-800/92">
                        <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{SESSION_MODE_LABELS[session.mode] || 'Peer Practice'}</span>
                    </div>
                    {problemToolbarMeta && (
                        <div className="hidden min-w-0 max-w-[min(380px,42vw)] flex-col gap-1 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-left shadow-sm dark:border-amber-900/50 dark:bg-amber-950/25 md:flex md:flex-col">
                            <span className="truncate text-xs font-semibold text-gray-900 dark:text-white">
                                {problemToolbarMeta.title || "Practice problem"}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-400">
                                {problemToolbarMeta.tags?.slice(0, 5).map((t) => (
                                    <span
                                        key={t}
                                        className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-gray-700 ring-1 ring-amber-200/80 dark:bg-slate-900/80 dark:text-gray-200 dark:ring-amber-900/40"
                                    >
                                        {t}
                                    </span>
                                ))}
                                {problemToolbarMeta.rating != null && problemToolbarMeta.rating !== "" ? (
                                    <span className="whitespace-nowrap">Rating {String(problemToolbarMeta.rating)}</span>
                                ) : null}
                                {problemToolbarMeta.diff ? (
                                    <span className="whitespace-nowrap">{String(problemToolbarMeta.diff)}</span>
                                ) : null}
                                {problemToolbarMeta.solved != null ? (
                                    <span className="whitespace-nowrap">
                                        {problemToolbarMeta.solved.toLocaleString()} solves
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white/92 px-3 py-1.5 shadow-sm dark:border-gray-700 dark:bg-gray-800/92">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">Room</span>
                        <code className="relative rounded-full bg-gray-100 dark:bg-[#111d33] px-3 py-1 font-mono text-sm font-medium text-gray-900 dark:text-white">
                            {roomId}
                        </code>
                        <button
                            type="button"
                            onClick={handleCopyRoomId}
                            className="inline-flex h-8 items-center justify-center rounded-full border border-gray-200 bg-white px-2.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-200"
                            title="Copy room link"
                        >
                            {copyingRoomLink ? "Copied" : "Copy"}
                        </button>
                        {(participationLabel === 'Driver' || participationLabel === 'Navigator') && (
                            <button
                                onClick={handleSwapRoles}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-[#111d33] dark:text-gray-400 dark:hover:bg-gray-700"
                                title="Swap Roles"
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                </svg>
                            </button>
                        )}
                        <div className="relative" ref={settingsRef}>
                            <button
                                onClick={() => setShowSettings((current) => !current)}
                                className="group relative inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-[#111d33] hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 shadow-sm hover:shadow-md"
                                aria-label="Practice room settings"
                                title="Practice room settings"
                            >
                                <svg className="h-4 w-4 text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                                    <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                                    <circle cx="12" cy="12" r="3" />
                                </svg>
                            </button>

                            {showSettings && (
                                <div className="absolute right-0 top-10 z-20 w-52 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                                    <div className="px-3 py-2">
                                        <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Practice Room</p>
                                        <p className="font-mono text-sm text-gray-900 dark:text-white">{roomId}</p>
                                    </div>
                                    <button
                                        onClick={handleFormatCode}
                                        disabled={!editorUnlocked}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700"
                                    >
                                        Format code
                                    </button>
                                    <button
                                        onClick={handleCopyRoomId}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                                    >
                                        Copy room link
                                    </button>
                                    <button
                                        onClick={handleGoHome}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                                    >
                                        Back to home
                                    </button>
                                    <button
                                        onClick={handleLeaveRoom}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                                    >
                                        Leave practice room
                                    </button>
                                </div>
                            )}
                        </div>
                        {users.length > 0 && (
                            <div className="flex items-center pl-1">
                                {users.slice(0, 5).map((user, index) => (
                                    <div
                                        key={user.socketId}
                                        style={{ backgroundColor: user.color || '#94a3b8', marginLeft: index === 0 ? 0 : -6 }}
                                        className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[11px] font-semibold text-black dark:border-[#081121]"
                                        title={`${user.username || "Guest"} (${user.role || "Peer"})`}
                                    >
                                        {(user.username || '?').charAt(0).toUpperCase()}
                                    </div>
                                ))}
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => setIsOutputCollapsed((current) => !current)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white/92 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-white hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800/92 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:text-white"
                            title={isOutputCollapsed ? 'Show output panel' : 'Hide output panel'}
                            aria-label={isOutputCollapsed ? 'Show output panel' : 'Hide output panel'}
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                                {isOutputCollapsed ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h16m0-12v12" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h16M18 6v12" />
                                )}
                            </svg>
                        </button>
                        {isMockMode && (
                            <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white/92 px-3 py-1.5 shadow-sm dark:border-gray-700 dark:bg-gray-800/92">
                                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200">
                                    {formatTimerLabel(timeRemaining)}
                                </span>
                                <select
                                    value={timerDuration}
                                    onChange={handleTimerPresetChange}
                                    className="h-9 rounded-xl border border-gray-200 bg-white/92 px-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-400 dark:border-gray-600 dark:bg-gray-800/92 dark:text-white"
                                >
                                    {TIMER_PRESETS.map((preset) => (
                                        <option key={preset.value} value={preset.value}>
                                            {preset.label}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={handleTimerToggle}
                                    className="inline-flex h-9 items-center justify-center rounded-xl border border-gray-200 bg-white/92 px-3 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-white hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800/92 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:text-white"
                                >
                                    {isTimerRunning ? "Pause" : "Start"}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleTimerReset}
                                    className="inline-flex h-9 items-center justify-center rounded-xl border border-gray-200 bg-white/92 px-3 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-white hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800/92 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:text-white"
                                >
                                    Reset
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div
                className="grid min-h-0 flex-1 grid-cols-1"
                style={
                    isOutputCollapsed || !isDesktopLayout
                        ? undefined
                        : { gridTemplateColumns: `minmax(0,1fr) 8px ${rightPanelWidthPct}%` }
                }
            >
                <div className={`relative min-h-[24rem] border-t xl:min-h-0 ${editorUnlocked
                    ? 'border-emerald-200/80 dark:border-emerald-800/40'
                    : 'border-rose-200/80 dark:border-rose-800/40'
                    } bg-white dark:bg-[#0a1324]`}>
                    <textarea
                        id="realtimeEditor"
                        className="h-full w-full resize-none border-0 bg-transparent p-6 text-sm font-mono text-gray-900 outline-none dark:text-white"
                        placeholder=""
                    />
                    {collaborationHintVisible ? (
                        <div
                            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-8"
                            aria-hidden
                        >
                            <p className="max-w-sm text-center text-sm font-medium leading-relaxed text-gray-400 select-none dark:text-gray-500">
                                Start coding together...
                            </p>
                        </div>
                    ) : null}
                </div>

                <div
                    onMouseDown={startPanelResize}
                    className={`${isOutputCollapsed ? 'hidden' : 'hidden xl:block'} cursor-col-resize border-t border-gray-200/80 bg-gray-100/70 hover:bg-amber-200/80 dark:border-gray-700/80 dark:bg-slate-800/80 dark:hover:bg-amber-700/40`}
                    title="Resize panel"
                />

                <aside className={`${isOutputCollapsed ? 'hidden xl:hidden' : 'block'} overflow-hidden border-t border-gray-200/80 bg-white dark:border-gray-700/80 dark:bg-[#081121] xl:h-full xl:flex-none xl:border-l xl:border-t-0`}>
                    <div className="flex h-full flex-col min-h-0">
                        <div className="flex flex-none items-center gap-2 border-b border-gray-200/80 bg-white px-4 py-2.5 dark:border-gray-700/80 dark:bg-[#0b1528]">
                            <div className="flex gap-1.5">
                                <div className="h-3 w-3 rounded-full bg-red-500"></div>
                                <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                                <div className="h-3 w-3 rounded-full bg-green-500"></div>
                            </div>
                        </div>

                        <div className="flex-none border-b border-gray-200/80 bg-stone-50 px-4 py-3.5 dark:border-gray-700/80 dark:bg-[#0d172b]">
                            <div className="flex flex-wrap gap-2 rounded-[1.2rem] border border-gray-200/80 bg-white/70 p-1.5 shadow-sm dark:border-gray-700/80 dark:bg-slate-950/40">
                                {[
                                    { key: "output", label: "Output" },
                                    { key: "submissions", label: "Submissions" },
                                    { key: "tests", label: "Tests" },
                                ].map((tab) => {
                                    const isActive = activeRightTab === tab.key;
                                    return (
                                        <button
                                            key={tab.key}
                                            type="button"
                                            onClick={() => setActiveRightTab(tab.key)}
                                            className={`rounded-[0.95rem] border-b-2 px-3.5 py-2.5 text-sm font-semibold transition ${isActive
                                                ? "border-amber-500 bg-white text-gray-900 shadow-sm dark:border-amber-400 dark:bg-slate-900 dark:text-white"
                                                : "border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                                                }`}
                                        >
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth p-5">
                            {activeRightTab === "output" && (
                                <div className="space-y-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {runBy && (
                                            <div className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                                                Run by {runBy}
                                            </div>
                                        )}
                                        <div className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                                            {lastRunMeta?.languageLabel || LANGUAGE_OPTIONS[selectedLanguageRef.current].label}
                                        </div>
                                        <div className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                                            status: {lastRunMeta?.status || "idle"}
                                        </div>
                                        <div className={`rounded-full border px-3 py-1 text-xs font-medium ${lastRunMeta?.sampleCheck === "passed"
                                            ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800/50 dark:bg-green-950/30 dark:text-green-200"
                                            : lastRunMeta?.sampleCheck === "mismatch"
                                                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-200"
                                                : "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                                            }`}>
                                            sample: {lastRunMeta?.sampleCheck === "passed"
                                                ? "passed"
                                                : lastRunMeta?.sampleCheck === "mismatch"
                                                    ? "mismatch"
                                                    : lastRunMeta?.sampleCheck === "pending"
                                                        ? "checking"
                                                        : lastRunMeta?.sampleCheck === "not_checked"
                                                            ? "not checked"
                                                            : "n/a"}
                                        </div>
                                        {lastRunMeta?.updatedAt ? (
                                            <div className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                                                updated {new Date(lastRunMeta.updatedAt).toLocaleTimeString()}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="rounded-2xl border border-gray-200/80 bg-white px-3 py-3 shadow-sm dark:border-gray-700/80 dark:bg-[#111d33]">
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Execution Time</p>
                                            <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{lastRunMeta?.time ?? "Not run yet"}</p>
                                        </div>
                                        <div className="rounded-2xl border border-gray-200/80 bg-white px-3 py-3 shadow-sm dark:border-gray-700/80 dark:bg-[#111d33]">
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Memory</p>
                                            <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{lastRunMeta?.memory ?? "Not run yet"}</p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setShowOutputModal(true)}
                                        disabled={!output}
                                        className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-stone-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-[#111d33] dark:text-gray-200 dark:hover:border-gray-600 dark:hover:bg-[#16243d] dark:hover:text-white"
                                    >
                                        Open large output
                                    </button>

                                    {output ? (
                                        <div className="rounded-[1.5rem] border border-gray-200/80 bg-white/88 p-5 shadow-sm dark:border-gray-700/80 dark:bg-slate-900/70">
                                            <div className="font-mono text-sm text-gray-900 dark:text-white">{output}</div>
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-gray-300 bg-white/80 p-5 text-sm leading-7 text-gray-600 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-400">
                                            Run your code to see compiler output, runtime messages, and execution stats here.
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeRightTab === "submissions" && (
                                session.runHistory.length > 0 ? (
                                    <div className="space-y-3">
                                        {session.runHistory.map((run) => (
                                            <div key={run.id} className="rounded-[1.4rem] border border-gray-200/80 bg-white p-4 dark:border-gray-700/80 dark:bg-[#0d172b]">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`h-1.5 w-1.5 rounded-full ${run.passed ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{run.status}</span>
                                                        <span className={`rounded-full px-2 py-0.5 text-xs ${run.sampleCheck === 'passed'
                                                            ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-200'
                                                            : run.sampleCheck === 'mismatch'
                                                                ? 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-200'
                                                                : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300'
                                                            }`}>
                                                            {run.sampleCheck === 'passed' ? 'Passed sample' : run.sampleCheck === 'mismatch' ? 'Mismatch' : 'No check'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-gray-400">
                                                        <span>{run.time}</span>
                                                        <span>{run.memory}</span>
                                                    </div>
                                                </div>
                                                {(run.stdin || run.stdout || run.expectedOutput) && (
                                                    <div className="mt-3 space-y-2">
                                                        {run.stdin ? (
                                                            <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-700 dark:bg-slate-900/70 dark:text-slate-300">{`stdin\n${run.stdin}`}</pre>
                                                        ) : null}
                                                        <div className="grid gap-2">
                                                            {run.stdout ? (
                                                                <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-700 dark:bg-slate-900/70 dark:text-slate-300">{`stdout\n${run.stdout}`}</pre>
                                                            ) : null}
                                                            {run.expectedOutput ? (
                                                                <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-700 dark:bg-slate-900/70 dark:text-slate-300">{`expected\n${run.expectedOutput}`}</pre>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-dashed border-gray-300 bg-white/80 p-5 text-sm leading-7 text-gray-600 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-400">
                                        Run your code to populate the last 5 executions here.
                                    </div>
                                )
                            )}

                            {activeRightTab === "ai" && (
                                <div className="space-y-5">
                                    <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
                                        Session Intelligence: edge checklist, AI hints, and solution review (same flow as before).
                                    </p>
                                    <div className="rounded-[1.4rem] border border-gray-200/80 bg-white p-4 dark:border-gray-700/80 dark:bg-[#0d172b]">
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Edge Case Checklist</h3>
                                            <div className="flex items-center gap-2 text-[11px]">
                                                <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-gray-600 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-300">
                                                    {checklistCompleted}/{checklistTotal}
                                                </span>
                                                {criticalOpenCount > 0 && (
                                                    <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-red-700 dark:border-red-800/50 dark:bg-red-950/20 dark:text-red-300">
                                                        {criticalOpenCount} critical open
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2">
                                            {session.edgeCaseChecklist.map((item) => (
                                                <label key={item.id} className="group flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-2 py-1.5 hover:border-gray-200 dark:hover:border-gray-700">
                                                    <input
                                                        type="checkbox"
                                                        checked={item.checked}
                                                        onChange={() => toggleEdgeCase(item.id)}
                                                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-sm ${item.checked ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300'}`}>
                                                                {item.label}
                                                            </span>
                                                            {!item.checked && item.priority === 'critical' && (
                                                                <span className="rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-red-700 dark:border-red-800/50 dark:bg-red-950/20 dark:text-red-300">
                                                                    Critical
                                                                </span>
                                                            )}
                                                        </div>
                                                        {item.hint && (
                                                            <p className="mt-0.5 text-xs leading-5 text-gray-500 dark:text-gray-400">
                                                                {item.hint}
                                                            </p>
                                                        )}
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={reviewSolution}
                                            className="inline-flex flex-1 items-center justify-center rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/30"
                                        >
                                            Review solution
                                        </button>
                                        <button
                                            type="button"
                                            onClick={fetchAIHints}
                                            className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-stone-50 hover:text-gray-900 dark:border-gray-700 dark:bg-[#111d33] dark:text-gray-200 dark:hover:border-gray-600 dark:hover:bg-[#16243d] dark:hover:text-white"
                                        >
                                            Refresh AI Hints
                                        </button>
                                    </div>

                                    <div className="rounded-[1.4rem] border border-gray-200/80 bg-white p-4 dark:border-gray-700/80 dark:bg-[#0d172b]">
                                        <div className="mb-3 flex items-center justify-between">
                                            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">AI Hints</h3>
                                            {isLoading ? <span className="text-[10px] text-amber-500">Loading...</span> : null}
                                        </div>
                                        {aiHints.length > 0 ? (
                                            <div className="space-y-2">
                                                {aiHints.map((hint, index) => (
                                                    <button
                                                        key={index}
                                                        type="button"
                                                        onClick={() => applyHint(hint)}
                                                        className="w-full rounded-xl border border-gray-200 bg-white/80 p-3 text-left text-sm text-gray-700 transition hover:border-amber-200 hover:bg-amber-50/70 dark:border-gray-700 dark:bg-slate-900/50 dark:text-gray-200 dark:hover:border-amber-800/40 dark:hover:bg-amber-900/10"
                                                    >
                                                        {hint}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-500 dark:text-gray-400">No suggestions available right now.</p>
                                        )}
                                    </div>

                                    {renderReviewContent()}
                                </div>
                            )}

                            {activeRightTab === "tests" && (
                                <HiddenTestPanel
                                    serverUrl={serverUrl}
                                    roomId={roomId}
                                    language={selectedLanguageRef.current}
                                    code={editorRef.current?.getValue?.() || ""}
                                    problem={roomState?.problem || {}}
                                    externalGenerateSignal={testGenerateSignal}
                                />
                            )}

                            {activeRightTab === "report" && (
                                <div className="space-y-4">
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            disabled={reportLoading}
                                            onClick={() => generateSessionReport({ endSession: false })}
                                            className="inline-flex flex-1 min-w-[8rem] items-center justify-center rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800/40 dark:bg-amber-900/25 dark:text-amber-200 dark:hover:bg-amber-900/35"
                                        >
                                            {reportLoading ? "Working…" : "Generate Report"}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={reportLoading}
                                            onClick={() =>
                                                generateSessionReport({
                                                    endSession: true,
                                                    endReason: "manual_end",
                                                })
                                            }
                                            className="inline-flex flex-1 min-w-[8rem] items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-stone-50 disabled:opacity-60 dark:border-gray-700 dark:bg-[#111d33] dark:text-gray-200 dark:hover:bg-[#16243d]"
                                        >
                                            Generate and end session
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={reportLoading}
                                        onClick={() => generateSessionReport({ wholeRoom: true })}
                                        className="w-full rounded-xl border border-dashed border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-stone-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-slate-800/60"
                                    >
                                        Use whole-room activity (all participants)
                                    </button>
                                    {!lastShareId ? (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Generate a report to get a shareable link. Sign in to keep reports in History → Analysis Reports.
                                        </p>
                                    ) : null}

                                    {lastReportPayload ? (
                                        <div
                                            className={`relative rounded-[1.5rem] border border-amber-200/35 bg-gradient-to-b from-amber-50/40 to-transparent p-1 shadow-[0_8px_40px_-16px_rgba(245,158,11,0.35)] ring-1 ring-amber-400/15 transition-[box-shadow,ring] duration-500 dark:border-amber-900/40 dark:from-amber-950/25 dark:shadow-[0_12px_48px_-20px_rgba(0,0,0,0.75)] dark:ring-amber-500/10 ${isNewReport && activeRightTab === "report" ? "ring-2 ring-amber-400/60 shadow-[0_12px_48px_-12px_rgba(251,191,36,0.55)] dark:shadow-[0_16px_56px_-16px_rgba(251,191,36,0.25)]" : ""}`}
                                        >
                                            <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 rounded-t-[1.25rem] border-b border-amber-200/40 bg-white/90 px-3 py-2.5 backdrop-blur-md dark:border-amber-900/35 dark:bg-[#0a1324]/92">
                                                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                                                    Session report
                                                </span>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold tabular-nums text-amber-950 dark:bg-amber-900/50 dark:text-amber-100">
                                                        {lastReportPayload.sessionScore}
                                                    </span>
                                                    {lastShareId ? (
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                const url = `${window.location.origin}/report/${lastShareId}`;
                                                                await navigator.clipboard.writeText(url);
                                                                toast.success("Share link copied");
                                                            }}
                                                            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 transition hover:bg-stone-50 dark:border-gray-600 dark:bg-slate-900 dark:text-gray-200 dark:hover:bg-slate-800"
                                                        >
                                                            Copy link
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <div className="p-2 pt-3 sm:p-3">
                                                <SessionIntelligenceReportDashboard
                                                    report={lastReportPayload}
                                                    title={
                                                        roomState?.problem?.title ||
                                                        "Practice session"
                                                    }
                                                    variant="embedded"
                                                />
                                                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200/70 pt-3 dark:border-gray-700/70">
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                                        Screenshot-friendly layout · share from Copy link
                                                    </p>
                                                    <button
                                                        type="button"
                                                        disabled={reportLoading}
                                                        onClick={() => generateSessionReport({ endSession: false })}
                                                        className="text-[11px] font-semibold text-amber-700 underline-offset-2 hover:underline disabled:opacity-50 dark:text-amber-300"
                                                    >
                                                        Regenerate
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-gray-300 bg-white/80 p-5 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-400">
                                            Run code, submit samples, or run a signed-in solution review, then generate your report here.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}

export default Workspace;
