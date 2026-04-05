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
import { getAuthHeaders } from "../../lib/auth";

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
    const settingsRef = useRef(null);
    const selectedLanguageRef = useRef(DEFAULT_LANGUAGE);
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
    const [selectedLanguage, setSelectedLanguage] = useState(DEFAULT_LANGUAGE);
    const [lastRunMeta, setLastRunMeta] = useState(null);
    const [timerDuration, setTimerDuration] = useState(45 * 60);
    const [timeRemaining, setTimeRemaining] = useState(45 * 60);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [showReview, setShowReview] = useState(false);
    const [showOutputModal, setShowOutputModal] = useState(false);
    const [reviewContent, setReviewContent] = useState(null);
    const [isReviewLoading, setIsReviewLoading] = useState(false);
    const [isOutputCollapsed, setIsOutputCollapsed] = useState(false);

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
    const normalizedRole = (currentRole || 'Peer').toLowerCase();
    const isDriver = session.driverSocketId === currentSocketId;
    const isNavigator = session.navigatorSocketId === currentSocketId;
    const driverUser = users.find((user) => user.socketId === session.driverSocketId);
    const navigatorUser = users.find((user) => user.socketId === session.navigatorSocketId);
    const hasAssignedDriver = Boolean(session.driverSocketId);
    const isMentoringMode = session.mode === 'mentoring';
    const isMockMode = session.mode === 'mock_interview';
    const isMentorRole = normalizedRole === 'mentor';
    const isLearnerRole = normalizedRole === 'learner';
    const isInterviewerRole = normalizedRole === 'interviewer';
    const isCandidateRole = normalizedRole === 'candidate';

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

    const handleSwapRoles = () => {
        socketRef.current?.emit('swap-roles', { roomId });
    };

    const updateApproachNotes = (notes) => {
        socketRef.current?.emit('session-update', {
            roomId,
            session: { ...session, approachNotes: notes },
        });
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

    const updateMentorNotes = (notes) => {
        socketRef.current?.emit('session-update', {
            roomId,
            session: { ...session, mentorNotes: notes },
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
        setShowReview(true);
        try {
            const code = editorRef.current?.getValue() || "";
            setReviewContent(null);
            const response = await axios.post(`${serverUrl}/api/ai/review`, {
                code,
                problem: roomState?.problem,
                language: selectedLanguage,
            }, {
                headers: getAuthHeaders(),
            });
            setReviewContent(response.data);
        } catch {
            toast.error("Failed to get review");
            setShowReview(false);
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
                const code = instance.getValue();
                if (origin !== "setValue") {
                    socketRef.current.emit("code-change", {
                        roomId,
                        code,
                    });
                }
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

        const nextLanguage = LANGUAGE_OPTIONS[roomState.language] ? roomState.language : DEFAULT_LANGUAGE;
        selectedLanguageRef.current = nextLanguage;
        setSelectedLanguage(nextLanguage);
        editorRef.current.setOption("mode", LANGUAGE_OPTIONS[nextLanguage].editorMode);

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
        socket.on("language-change", ({ language }) => {
            if (!LANGUAGE_OPTIONS[language]) return;

            selectedLanguageRef.current = language;
            setSelectedLanguage(language);
            editorRef.current?.setOption("mode", LANGUAGE_OPTIONS[language].editorMode);
        });

        return () => {
            socket.off("code-change", handleCodeChange);
            socket.off("language-change");
        };
    }, [socketRef, roomId]);

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
        socketRef,
        timeRemaining,
        timerDuration,
    ]);

    const handleCopyRoomId = async () => {
        try {
            await navigator.clipboard.writeText(roomId);
            toast.success("Room ID copied");
            setShowSettings(false);
        } catch {
            toast.error("Failed to copy room ID");
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

    const handleResetCode = () => {
      const nextCode = LANGUAGE_OPTIONS[selectedLanguage].starterCode;
      editorRef.current?.setValue(nextCode);
      syncCodeToRoom(nextCode);
    };

    const handleFormatCode = () => {
      const currentCode = editorRef.current?.getValue() ?? "";
      const formattedCode = formatCode(selectedLanguage, currentCode);

      if (formattedCode !== currentCode) {
        editorRef.current?.setValue(formattedCode);
        syncCodeToRoom(formattedCode);
        toast.success("Code formatted");
      } else {
        toast("Code is already formatted enough for the current formatter.");
      }
    };

    const handleLanguageChange = (event) => {
      const nextLanguage = event.target.value;
      const nextLanguageConfig = LANGUAGE_OPTIONS[nextLanguage];
      const currentLanguageConfig = LANGUAGE_OPTIONS[selectedLanguageRef.current];
      const currentCode = editorRef.current?.getValue() ?? "";
      const currentStarterCode = currentLanguageConfig?.starterCode ?? "";
      const nextStarterCode = nextLanguageConfig.starterCode;
      const shouldReplaceCode =
        currentCode.trim().length === 0 || currentCode === currentStarterCode;

      selectedLanguageRef.current = nextLanguage;
      setSelectedLanguage(nextLanguage);
      editorRef.current?.setOption("mode", nextLanguageConfig.editorMode);

      socketRef.current?.emit("language-change", {
        roomId,
        language: nextLanguage,
      });

      if (shouldReplaceCode && editorRef.current) {
        editorRef.current.setValue(nextStarterCode);
        syncCodeToRoom(nextStarterCode);
      }
    };


const runCode = async () => {
  const rawCode = editorRef.current.getValue();
  const languageConfig = LANGUAGE_OPTIONS[selectedLanguage] || LANGUAGE_OPTIONS[DEFAULT_LANGUAGE];
  const fallbackSampleInput = sampleInput.trim();
  const effectiveStdin = sampleInput;
  const inputSource = fallbackSampleInput.length > 0 ? "sample" : "none";
  const normalizedExpectedOutput = normalizeOutput(expectedOutput);

  setLastRunMeta({
    languageLabel: languageConfig.label,
    hasStdin: effectiveStdin.trim().length > 0,
    inputSource,
    status: "Running",
    time: null,
    memory: null,
    sampleCheck: normalizedExpectedOutput ? "pending" : "not_available",
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
    const response = await axios.post(`${serverUrl}/api/run-code`, {
      code: rawCode,
      stdin: effectiveStdin,
      languageId: languageConfig.judge0Id,
      roomId,
    }, {
      headers: getAuthHeaders(),
    });

    const { stdout, stderr, compile_output, message, time, memory } = response.data;
    const normalizedStdout = normalizeOutput(stdout || "");
    const hasCompileError = Boolean(compile_output);
    const hasRuntimeError = Boolean(stderr);
    const hasOutput = Boolean(stdout);
    const hasSystemMessage = Boolean(message);
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

    setLastRunMeta({
      languageLabel: languageConfig.label,
      hasStdin: effectiveStdin.trim().length > 0,
      inputSource,
      status: hasCompileError ? "Compilation Error" : hasRuntimeError ? "Runtime Error" : "Completed",
      time: time || "N/A",
      memory: memory || "N/A",
      sampleCheck: sampleMatched ? "passed" : sampleMismatched ? "mismatch" : normalizedExpectedOutput ? "not_checked" : "not_available",
    });

    socketRef.current?.emit('run-history-update', {
      roomId,
      run: {
        status: hasCompileError ? "Compilation Error" : hasRuntimeError ? "Runtime Error" : "Completed",
        time: time || "N/A",
        memory: memory || "N/A",
        passed: sampleMatched,
        languageLabel: languageConfig.label,
        stdin: effectiveStdin,
        stdout: normalizeOutput(stdout || ""),
        expectedOutput: normalizedExpectedOutput,
        sampleCheck: sampleMatched ? "passed" : sampleMismatched ? "mismatch" : "not_checked",
      },
    });

    const finalOutput = (
      <div className="space-y-4 text-sm">
        {sampleMatched && (
          <OutputSection tone="success" title="Passed Sample">
            Actual output matches the expected output for the shared sample test case.
          </OutputSection>
        )}

        {sampleMismatched && (
          <>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-100">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700 dark:text-red-300">Sample Check Failed</p>
                  <p className="mt-1 text-sm leading-6">
                    Your program ran, but the output does not match the expected output for the shared sample test.
                  </p>
                </div>
                <span className="rounded-full border border-red-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200">
                  Mismatch
                </span>
              </div>
            </div>
            <ComparisonPanel expectedOutput={expectedOutput} actualOutput={stdout} />
          </>
        )}

        {compile_output && (
          <OutputSection tone="warning" title="Compilation Error">
            {compile_output}
          </OutputSection>
        )}

        {stderr && (
          <OutputSection tone="error" title="Runtime Error">
            {stderr}
          </OutputSection>
        )}

        {stdout && (
          <OutputSection tone="success" title="Program Output">
            {stdout}
          </OutputSection>
        )}

        {message && (
          <OutputSection tone="info" title="System Message">
            {message}
          </OutputSection>
        )}

        {!hasCompileError && !hasRuntimeError && !hasOutput && !hasSystemMessage && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-700 dark:border-slate-700/50 dark:bg-slate-900/50 dark:text-slate-300">
            The program finished without compiler messages or stdout output.
          </div>
        )}
      </div>
    );

    setOutput(finalOutput);
    setShowOutputModal(true);
  } catch (error) {
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
        <p>Error running code: {error.response?.data?.error || error.message}</p>
      </div>
    );
    setShowOutputModal(true);
    toast.error("Run Code failed. Check your Judge0 configuration.");
  }
};

    return (
        <div className="flex h-full min-h-0 flex-col bg-transparent">
            {showOutputModal && output && (
                <OverlayPanel
                    title="Run Output"
                    subtitle="Execution Results"
                    onClose={() => setShowOutputModal(false)}
                >
                    <div className="space-y-5">
                        <div className="grid gap-3 md:grid-cols-4">
                            <div className="rounded-[1.35rem] border border-gray-200/80 bg-white/90 p-4 shadow-sm dark:border-gray-700/80 dark:bg-slate-900/70">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Language</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{lastRunMeta?.languageLabel || LANGUAGE_OPTIONS[selectedLanguage].label}</p>
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

            {showReview && (
                <OverlayPanel
                    title="Solution Review"
                    subtitle="AI Review"
                    onClose={() => setShowReview(false)}
                >
                    {isReviewLoading ? (
                        <div className="flex min-h-[40vh] items-center justify-center">
                            <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-5 py-4 text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200">
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-500 border-t-transparent"></div>
                                <span className="text-sm font-medium">Analyzing solution...</span>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {reviewContent?.summary && (
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
                    )}
                </OverlayPanel>
            )}
            <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-b border-gray-200/80 bg-white px-5 py-2.5 dark:border-gray-700/80 dark:bg-[#081121]">
                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-gray-800 bg-black px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:border-gray-200 dark:bg-white dark:text-black dark:hover:bg-gray-100"
                        onClick={runCode}
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <polygon points="5,3 19,12 5,21"/>
                        </svg>
                        Run
                    </button>
                    <button
                        className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-gray-200 bg-white/92 px-4 text-sm font-medium text-black shadow-sm transition-all hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800/92 dark:text-white dark:hover:bg-gray-700"
                        onClick={handleResetCode}
                        disabled={!editorUnlocked}
                        title={editorUnlocked ? 'Reset the shared editor' : 'Only the active editor owner can clear code right now'}
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M3 6h18"/>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                            <line x1="10" x2="10" y1="11" y2="17"/>
                            <line x1="14" x2="14" y1="11" y2="17"/>
                        </svg>
                        Clear
                    </button>
                    <button
                        className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-gray-200 bg-white/92 px-4 text-sm font-medium text-black shadow-sm transition-all hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800/92 dark:text-white dark:hover:bg-gray-700"
                        onClick={handleFormatCode}
                        disabled={!editorUnlocked}
                        title={editorUnlocked ? 'Format the shared code' : 'Only the active editor owner can format code right now'}
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M4 7h10" />
                            <path d="M4 12h16" />
                            <path d="M4 17h12" />
                        </svg>
                        Format
                    </button>
                    <button
                        className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50/90 px-4 text-sm font-medium text-amber-700 shadow-sm transition-all hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/40"
                        onClick={reviewSolution}
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Review Solution
                    </button>
                </div>

                <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/92 px-3 py-1.5 shadow-sm dark:border-gray-700 dark:bg-gray-800/92">
                        <label htmlFor="language-select" className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                            Language
                        </label>
                        <select
                            id="language-select"
                            value={selectedLanguage}
                            onChange={handleLanguageChange}
                            disabled={!editorUnlocked}
                            className="h-8 min-w-[110px] rounded-full border border-gray-200 bg-white px-3 text-sm font-medium text-gray-900 shadow-sm outline-none transition focus:border-gray-400 dark:border-gray-600 dark:bg-[#111d33] dark:text-white"
                        >
                            {Object.entries(LANGUAGE_OPTIONS).map(([languageKey, config]) => (
                                <option key={languageKey} value={languageKey}>
                                    {config.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white/92 px-3 py-1.5 shadow-sm dark:border-gray-700 dark:bg-gray-800/92">
                            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{SESSION_MODE_LABELS[session.mode] || 'Peer Practice'}</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white/92 px-3 py-1.5 shadow-sm dark:border-gray-700 dark:bg-gray-800/92">
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.12em] uppercase ${
                            participationLabel === 'Driver' 
                                ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/50 dark:bg-blue-950/30 dark:text-blue-200'
                                : participationLabel === 'Navigator'
                                    ? 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800/50 dark:bg-purple-950/30 dark:text-purple-200'
                                    : 'border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200'
                        }`}>
                            {participationLabel}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
                            editorUnlocked
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/20 dark:text-emerald-200'
                                : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-200'
                        }`}>
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {editorUnlocked ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 4.487a2.25 2.25 0 113.182 3.182L7.5 20.213 3 21l.787-4.5L16.862 4.487z" />
                                ) : (
                                    <>
                                        <rect x="4" y="10" width="16" height="10" rx="2" strokeWidth={2} />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10V7a4 4 0 118 0v3" />
                                    </>
                                )}
                            </svg>
                            {editorUnlocked ? 'Editor control' : 'Read only'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white/92 px-3 py-1.5 shadow-sm dark:border-gray-700 dark:bg-gray-800/92">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">Room</span>
                        <code className="relative rounded-full bg-gray-100 dark:bg-[#111d33] px-3 py-1 font-mono text-sm font-medium text-gray-900 dark:text-white">
                            {roomId}
                        </code>
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
                                    <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"/>
                                    <circle cx="12" cy="12" r="3"/>
                                </svg>
                            </button>

                            {showSettings && (
                                <div className="absolute right-0 top-10 z-20 w-52 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                                    <div className="px-3 py-2">
                                        <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Practice Room</p>
                                        <p className="font-mono text-sm text-gray-900 dark:text-white">{roomId}</p>
                                    </div>
                                    <button
                                        onClick={handleCopyRoomId}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                                    >
                                        Copy room ID
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
                        <div className="relative group">
                            <button 
                                onClick={fetchAIHints}
                                className="ai-button inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white/92 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-white hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800/92 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:text-white"
                                aria-label="AI Practice Coach"
                                title="AI Practice Coach - Get interview-oriented suggestions"
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                                    <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423L16.5 15.75l.394 1.183a2.25 2.25 0 001.423 1.423L19.5 18.75l-1.183.394a2.25 2.25 0 00-1.423 1.423z"/>
                                </svg>
                                AI
                            </button>
                            
                            {/* AI Hints Dropdown */}
                            {showDropdown && createPortal(
                                <div className="ai-dropdown fixed top-20 right-6 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-[9999]">
                                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">AI Practice Suggestions</h3>
                                            <button
                                                onClick={closeDropdown}
                                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                            >
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="max-h-64 overflow-y-auto">
                                        {isLoading ? (
                                            <div className="p-4 text-center">
                                                <div className="inline-flex items-center gap-2">
                                                    <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-sm text-gray-600 dark:text-gray-400">Generating suggestions...</span>
                                                </div>
                                            </div>
                                        ) : aiHints.length > 0 ? (
                                            <div className="p-2">
                                                {aiHints.map((hint, index) => (
                                                    <button
                                                        key={index}
                                                        onClick={() => applyHint(hint)}
                                                        className="w-full text-left p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                                                <svg className="w-3 h-3 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                                </svg>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm text-gray-900 dark:text-white font-mono leading-relaxed group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                                                                    {hint}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-4 text-center">
                                                    <div className="text-gray-500 dark:text-gray-400 text-sm">
                                                    No suggestions available right now
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>,
                                document.body
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsOutputCollapsed((current) => !current)}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white/92 px-3 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-white hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800/92 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:text-white"
                            title={isOutputCollapsed ? 'Show output panel' : 'Hide output panel'}
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                                {isOutputCollapsed ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h16m0-12v12" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h16M18 6v12" />
                                )}
                            </svg>
                            {isOutputCollapsed ? 'Show Output' : 'Hide Output'}
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

            <div className={`grid min-h-0 flex-1 grid-cols-1 ${isOutputCollapsed ? 'xl:grid-cols-[minmax(0,1fr)]' : 'xl:grid-cols-[minmax(0,1fr)_24rem]'}`}>
                <div className={`relative min-h-[24rem] border-t xl:min-h-0 ${
                    editorUnlocked
                        ? 'border-emerald-200/80 dark:border-emerald-800/40'
                        : 'border-rose-200/80 dark:border-rose-800/40'
                } bg-white dark:bg-[#0a1324]`}>
                    <textarea 
                        id="realtimeEditor" 
                        className="h-full w-full resize-none border-0 bg-transparent p-6 text-sm font-mono text-gray-900 outline-none placeholder:text-gray-500 dark:text-white dark:placeholder:text-gray-400"
                        placeholder="// Start coding here..."
                    />
                </div>

                <aside className={`${isOutputCollapsed ? 'hidden xl:hidden' : 'block'} overflow-hidden border-t border-gray-200/80 bg-white dark:border-gray-700/80 dark:bg-[#081121] xl:h-full xl:min-w-[360px] xl:max-w-[520px] xl:flex-none xl:border-l xl:border-t-0 xl:panel-resize xl:panel-resize-left`}>
                    <div className="flex h-full flex-col min-h-0">
                        <div className="flex flex-none items-center gap-2 border-b border-gray-200/80 bg-white px-4 py-2.5 dark:border-gray-700/80 dark:bg-[#0b1528]">
                            <div className="flex gap-1.5">
                                <div className="h-3 w-3 rounded-full bg-red-500"></div>
                                <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                                <div className="h-3 w-3 rounded-full bg-green-500"></div>
                            </div>
                            <span className="ml-2 text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Output</span>
                        </div>

                        <div className="flex-none border-b border-gray-200/80 bg-stone-50 px-4 py-2.5 dark:border-gray-700/80 dark:bg-[#0d172b]">
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                                    {lastRunMeta?.languageLabel || LANGUAGE_OPTIONS[selectedLanguage].label}
                                </div>
                                <div className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                                    source: {lastRunMeta?.inputSource || "none"}
                                </div>
                                <div className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                                    status: {lastRunMeta?.status || "idle"}
                                </div>
                                <div className={`rounded-full border px-3 py-1 text-xs font-medium ${
                                    lastRunMeta?.sampleCheck === "passed"
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
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-3">
                                <div className="rounded-2xl border border-gray-200/80 bg-white px-3 py-3 shadow-sm dark:border-gray-700/80 dark:bg-[#111d33]">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                                        Execution Time
                                    </p>
                                    <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                                        {lastRunMeta?.time ?? "Not run yet"}
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-gray-200/80 bg-white px-3 py-3 shadow-sm dark:border-gray-700/80 dark:bg-[#111d33]">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                                        Memory
                                    </p>
                                    <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                                        {lastRunMeta?.memory ?? "Not run yet"}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-3 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowOutputModal(true)}
                                    disabled={!output}
                                    className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-stone-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-[#111d33] dark:text-gray-200 dark:hover:border-gray-600 dark:hover:bg-[#16243d] dark:hover:text-white"
                                >
                                    Open large output
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowReview(true)}
                                    disabled={!reviewContent && !isReviewLoading}
                                    className="inline-flex flex-1 items-center justify-center rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/30"
                                >
                                    Open review
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6">
                            {/* Session Content */}
                            <div className="space-y-6">
                                {/* Shared Approach Board */}
                                <div className="rounded-[1.4rem] border border-gray-200/80 bg-white p-4 dark:border-gray-700/80 dark:bg-[#0d172b]">
                                    <div className="mb-3 flex items-center justify-between">
                                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Shared Approach Board</h3>
                                        <span className="text-[10px] text-gray-400">Use this before coding</span>
                                    </div>
                                    <textarea
                                        value={session.approachNotes}
                                        onChange={(e) => updateApproachNotes(e.target.value)}
                                        placeholder="Idea, brute force, optimized approach, edge cases..."
                                        className="w-full min-h-[100px] rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-blue-500"
                                    />
                                </div>

                                {/* Edge Case Checklist */}
                                <div className="rounded-[1.4rem] border border-gray-200/80 bg-white p-4 dark:border-gray-700/80 dark:bg-[#0d172b]">
                                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Edge Case Checklist</h3>
                                    <div className="grid grid-cols-1 gap-2">
                                        {session.edgeCaseChecklist.map((item) => (
                                            <label key={item.id} className="flex items-center gap-3 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={item.checked}
                                                    onChange={() => toggleEdgeCase(item.id)}
                                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
                                                />
                                                <span className={`text-sm ${item.checked ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300'}`}>
                                                    {item.label}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Run History */}
                                {session.runHistory.length > 0 && (
                                    <div className="rounded-[1.4rem] border border-gray-200/80 bg-white p-4 dark:border-gray-700/80 dark:bg-[#0d172b]">
                                        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Run History</h3>
                                        <div className="space-y-2">
                                            {session.runHistory.map((run) => (
                                                <div key={run.id} className="rounded-lg border border-gray-100 bg-white/80 p-3 text-xs dark:border-gray-700 dark:bg-gray-800/60">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`h-1.5 w-1.5 rounded-full ${run.passed ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                                            <span className="font-medium text-gray-700 dark:text-gray-300">{run.status}</span>
                                                            <span className={`rounded-full px-2 py-0.5 ${
                                                                run.sampleCheck === 'passed'
                                                                    ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-200'
                                                                    : run.sampleCheck === 'mismatch'
                                                                        ? 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-200'
                                                                        : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300'
                                                            }`}>
                                                                {run.sampleCheck === 'passed' ? 'Passed sample' : run.sampleCheck === 'mismatch' ? 'Mismatch' : 'No check'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-gray-400">
                                                            <span>{run.time}</span>
                                                            <span>{run.memory}</span>
                                                        </div>
                                                    </div>
                                                    {(run.stdin || run.stdout || run.expectedOutput) && (
                                                        <div className="mt-2 space-y-2">
                                                            {run.stdin ? (
                                                                <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 px-2 py-2 font-mono text-[11px] text-slate-700 dark:bg-slate-900/70 dark:text-slate-300">{`stdin\n${run.stdin}`}</pre>
                                                            ) : null}
                                                            <div className="grid gap-2 lg:grid-cols-2">
                                                                {run.stdout ? (
                                                                    <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 px-2 py-2 font-mono text-[11px] text-slate-700 dark:bg-slate-900/70 dark:text-slate-300">{`stdout\n${run.stdout}`}</pre>
                                                                ) : null}
                                                                {run.expectedOutput ? (
                                                                    <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 px-2 py-2 font-mono text-[11px] text-slate-700 dark:bg-slate-900/70 dark:text-slate-300">{`expected\n${run.expectedOutput}`}</pre>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Mentor Notes */}
                                {((isMentoringMode && isMentorRole) || (isMockMode && isInterviewerRole)) && (
                                    <div className="rounded-2xl border border-purple-200 bg-purple-50/30 p-4 dark:border-purple-800/30 dark:bg-purple-900/10">
                                        <div className="mb-3 flex items-center justify-between">
                                            <h3 className="text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300">{isMockMode ? 'Private Interviewer Notes' : 'Private Mentor Notes'}</h3>
                                            <span className="text-[10px] text-purple-400">Visible only to you</span>
                                        </div>
                                        <textarea
                                            value={session.mentorNotes}
                                            onChange={(e) => updateMentorNotes(e.target.value)}
                                            placeholder="Confusion points, next topic, score/rubric..."
                                            className="w-full min-h-[100px] rounded-lg border border-purple-100 bg-white p-3 text-sm text-gray-900 outline-none focus:border-purple-400 dark:border-purple-800/50 dark:bg-gray-800 dark:text-white dark:focus:border-purple-500"
                                        />
                                    </div>
                                )}

                                {isMockMode && session.mockSummary && (
                                    <div className="rounded-[1.4rem] border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-800/40 dark:bg-amber-950/20">
                                        <div className="mb-3 flex items-center justify-between">
                                            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">Mock Summary</h3>
                                            <div className="flex items-center gap-2">
                                                {session.mockSummary.shareId ? (
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            await navigator.clipboard.writeText(`${window.location.origin}/summary/${session.mockSummary.shareId}`);
                                                            toast.success('Mock summary link copied');
                                                        }}
                                                        className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:border-amber-800/40 dark:bg-slate-900/60 dark:text-amber-200"
                                                    >
                                                        Share
                                                    </button>
                                                ) : null}
                                                <span className="text-[10px] text-amber-500">Saved at time-up</span>
                                            </div>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="rounded-xl bg-white/80 p-3 dark:bg-slate-900/50">
                                                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Problem</p>
                                                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{session.mockSummary.problemTitle}</p>
                                            </div>
                                            <div className="rounded-xl bg-white/80 p-3 dark:bg-slate-900/50">
                                                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Latest Run</p>
                                                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{session.mockSummary.latestRunStatus}</p>
                                            </div>
                                        </div>
                                        <p className="mt-3 text-sm leading-6 text-amber-900 dark:text-amber-100">
                                            {session.mockSummary.candidate || 'Candidate'} worked through a {session.mockSummary.durationLabel || formatTimerLabel(timerDuration)} round. Latest sample check: {session.mockSummary.latestSampleCheck || 'n/a'}.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="h-px bg-gray-200 dark:bg-gray-700 my-2"></div>

                            {sampleInput && (
                                <div className="mb-4 rounded-2xl border border-dashed border-gray-300 bg-white/80 p-4 dark:border-gray-700 dark:bg-gray-900/60">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                                            Shared Sample Input
                                        </p>
                                        <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                                            Used by Run
                                        </span>
                                    </div>
                                    <pre className="whitespace-pre-wrap font-mono text-sm text-gray-700 dark:text-gray-300">{sampleInput}</pre>
                                </div>
                            )}
                            {expectedOutput && (
                                <div className="mb-4 rounded-2xl border border-dashed border-gray-300 bg-white/80 p-4 dark:border-gray-700 dark:bg-gray-900/60">
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                                        Expected Output
                                    </p>
                                    <pre className="whitespace-pre-wrap font-mono text-sm text-gray-700 dark:text-gray-300">{expectedOutput}</pre>
                                </div>
                            )}
                            {output ? (
                                <div className="font-mono text-sm text-gray-900 dark:text-white">
                                    {output}
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-dashed border-gray-300 bg-white/80 p-5 text-sm leading-7 text-gray-600 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-400">
                                    Run your code to see compiler output, runtime messages, and execution stats here.
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
