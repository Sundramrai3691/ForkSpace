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
import "codemirror/addon/edit/closetag";
import "codemirror/addon/edit/closebrackets";
import useAIHint from "./AIHint";

function encodeBase64Utf8(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";

    for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }

    return btoa(binary);
}

function decodeBase64Utf8(value) {
    return new TextDecoder().decode(
        Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
    );
}


function Workspace({ socketRef, roomId }) {
    const judge0ApiUrl = (import.meta.env.VITE_JUDGE0_API_URL || "").trim();
    const judge0ApiKey = (import.meta.env.VITE_JUDGE0_API_KEY || "").trim();
    const judge0Enabled = import.meta.env.VITE_ENABLE_RUN_CODE === "true" && Boolean(judge0ApiUrl) && Boolean(judge0ApiKey);
    const editorRef = useRef(null);
    const settingsRef = useRef(null);
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


    useEffect(() => {
        async function connect() {
            editorRef.current = Codemirror.fromTextArea(
                document.getElementById("realtimeEditor"),
                {
                    mode: { name: "clike", json: true },
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

        return () => {
            socket.off("code-change", handleCodeChange);
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



const runCode = async () => {
  if (!judge0Enabled) {
    toast.error("Run Code is disabled. Set VITE_ENABLE_RUN_CODE=true, VITE_JUDGE0_API_URL, and VITE_JUDGE0_API_KEY in the root .env.");
    setOutput(
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100">
        Run Code is not configured for the frontend yet. Add the required Judge0 variables to the root <code>.env</code> file.
      </div>
    );
    return;
  }

  const rawCode = editorRef.current.getValue();
  const stdin = "Judge0";

  setOutput(
    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-blue-700 dark:text-blue-400 font-medium">Running Code...</span>
      </div>
    </div>
  );

  const createOptions = (useBase64 = false) => ({
    method: "POST",
    url: `${judge0ApiUrl}/submissions`,
    params: {
      ...(useBase64 ? { base64_encoded: "true" } : {}),
      wait: "true",
      fields: "*",
    },
    headers: {
      "x-rapidapi-key": judge0ApiKey,
      "x-rapidapi-host": "judge0-ce.p.rapidapi.com",
      "Content-Type": "application/json",
    },
    data: {
      language_id: 54,
      source_code: useBase64 ? encodeBase64Utf8(rawCode) : rawCode,
      stdin: useBase64 ? encodeBase64Utf8(stdin) : stdin,
    },
  });

  try {
    let response;

    try {
      response = await axios.request(createOptions(false));
    } catch (error) {
      const apiError = error.response?.data?.error;
      const shouldRetryWithBase64 =
        typeof apiError === "string" &&
        apiError.includes("use base64_encoded=true");

      if (!shouldRetryWithBase64) {
        throw error;
      }

      response = await axios.request(createOptions(true));
    }

    const { stdout, stderr, compile_output, message, time, memory } = response.data;
    const decodeResponse = response.config?.params?.base64_encoded === "true"
      ? decodeBase64Utf8
      : (value) => value;

    const finalOutput = (
      <div className="space-y-4 text-sm">
        {stdout && (
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-green-700 dark:text-green-400 font-medium">Output</span>
            </div>
            <pre className="text-green-900 dark:text-green-100 whitespace-pre-wrap font-mono text-sm leading-relaxed">{decodeResponse(stdout)}</pre>
          </div>
        )}

        {stderr && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-red-700 dark:text-red-400 font-medium">Runtime Error</span>
            </div>
            <pre className="text-red-900 dark:text-red-100 whitespace-pre-wrap font-mono text-sm leading-relaxed">{decodeResponse(stderr)}</pre>
          </div>
        )}

        {compile_output && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-amber-500"></div>
              <span className="text-amber-700 dark:text-amber-400 font-medium">Compilation Error</span>
            </div>
            <pre className="text-amber-900 dark:text-amber-100 whitespace-pre-wrap font-mono text-sm leading-relaxed">{decodeResponse(compile_output)}</pre>
          </div>
        )}

        {message && (
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-blue-700 dark:text-blue-400 font-medium">System Message</span>
            </div>
            <pre className="text-blue-900 dark:text-blue-100 whitespace-pre-wrap font-mono text-sm leading-relaxed">{decodeResponse(message)}</pre>
          </div>
        )}

        <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-slate-500"></div>
            <span className="text-slate-700 dark:text-slate-300 font-medium">Execution Summary</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12,6 12,12 16,14"/>
              </svg>
              <span className="text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-800 dark:text-slate-200">{time || "N/A"}s</span> execution time
              </span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
              <span className="text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-800 dark:text-slate-200">{memory || "N/A"} KB</span> memory used
              </span>
            </div>
          </div>
        </div>
      </div>
    );

    setOutput(finalOutput);
  } catch (error) {
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
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-gray-900/60 px-6 py-4">
                <div className="flex items-center gap-3">
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
                        onClick={() =>
                            editorRef.current.setValue("// ForkSpace - realtime coding platform")
                        }
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
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Live Session</span>
                    </div>
                    <div className="h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Room:</span>
                        <code className="relative rounded-md bg-gray-100 dark:bg-gray-800 px-2 py-1 font-mono text-sm font-medium text-gray-900 dark:text-white">
                            {roomId}
                        </code>
                        <div className="relative" ref={settingsRef}>
                            <button
                                onClick={() => setShowSettings((current) => !current)}
                                className="group relative inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 shadow-sm hover:shadow-md"
                                aria-label="Room settings"
                                title="Room settings"
                            >
                                <svg className="h-4 w-4 text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                                    <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"/>
                                    <circle cx="12" cy="12" r="3"/>
                                </svg>
                            </button>

                            {showSettings && (
                                <div className="absolute right-0 top-10 z-20 w-52 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                                    <div className="px-3 py-2">
                                        <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Room</p>
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
                                        Go to home
                                    </button>
                                    <button
                                        onClick={handleLeaveRoom}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                                    >
                                        Leave room
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="relative group">
                            <button 
                                onClick={fetchAIHints}
                                className="ai-button inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 border border-orange-400 hover:border-orange-500 transition-all duration-300 shadow-sm hover:shadow-lg hover:scale-105 text-sm font-medium"
                                aria-label="AI Assistant"
                                title="AI Assistant - Get coding suggestions"
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
                                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">AI Suggestions</h3>
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
                                                    No suggestions available
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>,
                                document.body
                            )}
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

                <aside className="border-t border-gray-200 bg-gray-50/90 dark:border-gray-700 dark:bg-gray-800/20 xl:border-l xl:border-t-0">
                    <div className="flex h-full min-h-[16rem] flex-col">
                        <div className="flex items-center gap-2 border-b border-gray-200 bg-white/80 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/70">
                            <div className="flex gap-1.5">
                                <div className="h-3 w-3 rounded-full bg-red-500"></div>
                                <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                                <div className="h-3 w-3 rounded-full bg-green-500"></div>
                            </div>
                            <span className="ml-2 text-sm font-medium text-gray-600 dark:text-gray-400">Output</span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
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
