/* eslint-disable react/prop-types */
import { useState, useEffect, useRef } from "react";
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

function ComparisonPanel({ expectedOutput, actualOutput }) {
    return (
        <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-red-200 bg-white/90 p-4 dark:border-red-800/50 dark:bg-gray-900/70">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-700 dark:text-red-300">
                    Expected Output
                </p>
                <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-gray-800 dark:text-gray-200">{expectedOutput || "No expected output provided."}</pre>
            </div>
            <div className="rounded-xl border border-amber-200 bg-white/90 p-4 dark:border-amber-800/50 dark:bg-gray-900/70">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                    Your Output
                </p>
                <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-gray-800 dark:text-gray-200">{actualOutput || "No stdout produced."}</pre>
            </div>
        </div>
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

function Workspace({ socketRef, roomId, roomState, currentSocketId }) {
    const serverUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();
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
    const sampleInput = roomState?.problem?.sampleInput || "";
    const expectedOutput = roomState?.problem?.sampleOutput || "";
    const session = roomState?.session || { mode: 'peer_practice', driverSocketId: '', navigatorSocketId: '' };
    const participationLabel =
        session.driverSocketId === currentSocketId
            ? 'Driver'
            : session.navigatorSocketId === currentSocketId
                ? 'Navigator'
                : 'Observer';


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
        if (!editorRef.current || !roomState) return;

        const nextLanguage = LANGUAGE_OPTIONS[roomState.language] ? roomState.language : DEFAULT_LANGUAGE;
        selectedLanguageRef.current = nextLanguage;
        setSelectedLanguage(nextLanguage);
        editorRef.current.setOption("mode", LANGUAGE_OPTIONS[nextLanguage].editorMode);

        if (typeof roomState.code === "string" && editorRef.current.getValue() !== roomState.code) {
            const cursor = editorRef.current.getCursor();
            const scrollInfo = editorRef.current.getScrollInfo();

            editorRef.current.setValue(roomState.code);
            editorRef.current.setCursor(cursor);
            editorRef.current.scrollTo(scrollInfo.left, scrollInfo.top);
        }
    }, [roomState]);

    useEffect(() => {
        const socket = socketRef.current;

        if (!socket || !editorRef.current) return;

        const handleCodeChange = ({ code }) => {
            if (code !== null && editorRef.current) {
                const cursor = editorRef.current.getCursor();
                const scrollInfo = editorRef.current.getScrollInfo();

                editorRef.current.setValue(code);

                editorRef.current.setCursor(cursor);
                editorRef.current.scrollTo(scrollInfo.left, scrollInfo.top);
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
            setTimeRemaining((currentValue) => {
                if (currentValue <= 1) {
                    window.clearInterval(intervalId);
                    setIsTimerRunning(false);
                    toast.success("Timer complete");
                    return 0;
                }

                return currentValue - 1;
            });
        }, 1000);

        return () => window.clearInterval(intervalId);
    }, [isTimerRunning]);

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
    toast.error("Run Code failed. Check your Judge0 configuration.");
  }
};

    return (
        <div className="flex h-full min-h-0 flex-col bg-white dark:bg-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-gray-200 bg-white/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-gray-700 dark:bg-gray-900/95 dark:supports-[backdrop-filter]:bg-gray-900/60">
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-100 border border-gray-800 dark:border-gray-200 shadow-sm h-9 px-4"
                        onClick={runCode}
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <polygon points="5,3 19,12 5,21"/>
                        </svg>
                        Run
                    </button>
                    <button
                        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-white dark:bg-gray-800 text-black dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-sm h-9 px-4"
                        onClick={handleResetCode}
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
                        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-white dark:bg-gray-800 text-black dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-sm h-9 px-4"
                        onClick={handleFormatCode}
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M4 7h10" />
                            <path d="M4 12h16" />
                            <path d="M4 17h12" />
                        </svg>
                        Format
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <label htmlFor="language-select" className="text-sm text-gray-600 dark:text-gray-400">
                            Language
                        </label>
                        <select
                            id="language-select"
                            value={selectedLanguage}
                            onChange={handleLanguageChange}
                            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        >
                            {Object.entries(LANGUAGE_OPTIONS).map(([languageKey, config]) => (
                                <option key={languageKey} value={languageKey}>
                                    {config.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{SESSION_MODE_LABELS[session.mode] || 'Peer Practice'}</span>
                    </div>
                    <div className="h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
                    <div className="flex items-center gap-2">
                        <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold tracking-[0.12em] text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                            {participationLabel}
                        </span>
                    </div>
                    <div className="h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Practice Room:</span>
                        <code className="relative rounded-md bg-gray-100 dark:bg-gray-800 px-2 py-1 font-mono text-sm font-medium text-gray-900 dark:text-white">
                            {roomId}
                        </code>
                        <div className="relative" ref={settingsRef}>
                            <button
                                onClick={() => setShowSettings((current) => !current)}
                                className="group relative inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 shadow-sm hover:shadow-md"
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
                                className="ai-button inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:text-white"
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
                        <div className="flex items-center gap-2 border-l border-gray-200 pl-3 dark:border-gray-700">
                            <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold tracking-[0.12em] text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                {formatTimerLabel(timeRemaining)}
                            </span>
                            <select
                                value={timerDuration}
                                onChange={handleTimerPresetChange}
                                className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
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
                                className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:text-white"
                            >
                                {isTimerRunning ? "Pause" : "Start"}
                            </button>
                            <button
                                type="button"
                                onClick={handleTimerReset}
                                className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:text-white"
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_24rem]">
                <div className="relative min-h-[24rem] xl:min-h-0">
                    <textarea 
                        id="realtimeEditor" 
                        className="h-full w-full resize-none border-0 bg-white dark:bg-gray-900 p-6 text-sm font-mono outline-none placeholder:text-gray-500 dark:placeholder:text-gray-400 text-gray-900 dark:text-white"
                        placeholder="// Start coding here..."
                    />
                </div>

                <aside className="border-t border-gray-200 bg-gray-50/90 dark:border-gray-700 dark:bg-gray-800/20 xl:min-w-[360px] xl:max-w-[520px] xl:flex-none xl:border-l xl:border-t-0 xl:panel-resize xl:panel-resize-left">
                    <div className="flex h-full min-h-[16rem] flex-col">
                        <div className="flex items-center gap-2 border-b border-gray-200 bg-white/80 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/70">
                            <div className="flex gap-1.5">
                                <div className="h-3 w-3 rounded-full bg-red-500"></div>
                                <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                                <div className="h-3 w-3 rounded-full bg-green-500"></div>
                            </div>
                            <span className="ml-2 text-sm font-medium text-gray-600 dark:text-gray-400">Output</span>
                        </div>

                        <div className="border-b border-gray-200 bg-gray-50/80 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/50">
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
                                <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 dark:border-gray-700 dark:bg-gray-900">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                                        Execution Time
                                    </p>
                                    <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                                        {lastRunMeta?.time ?? "Not run yet"}
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 dark:border-gray-700 dark:bg-gray-900">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                                        Memory
                                    </p>
                                    <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                                        {lastRunMeta?.memory ?? "Not run yet"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
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
