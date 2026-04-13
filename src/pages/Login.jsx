import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import axios from 'axios';
import { GraduationCap, Sword, X, Zap } from 'lucide-react';
import FormComp from '../components/forms/FormComp';
import Navbar from '../components/common/Navbar';
import { getAuthHeaders, getAuthToken } from '../lib/auth';

const useCases = [
    {
        icon: Sword,
        title: 'Mock Interview',
        description: 'Candidate and interviewer in one room. Shared editor, live output, Driver/Navigator roles. No screen share needed.',
    },
    {
        icon: GraduationCap,
        title: 'DSA Mentoring',
        description: 'Load a Codeforces problem, walk through the approach together, run and debug in the same editor. No back-and-forth screen passing.',
    },
    {
        icon: Zap,
        title: 'Peer Practice',
        description: 'Pick a problem, write a solution, stress-test it with generated hidden tests. Two people, one attempt, immediate feedback.',
    },
];

const quickStartSteps = [
    'Create a room or paste a Room ID. Jump in as guest — no account needed to start.',
    'Pick a session mode: Mock Interview, DSA Mentoring, or Peer Practice. Assign Driver and Navigator roles so both sides know the structure.',
    'Write code together, run it, compare output against sample cases. Use Analyze for complexity and bug review, Report for a session summary — when you actually need it.',
];

function createRoomId() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function Login() {
    const navigate = useNavigate();
    const quickRoomRef = useRef(null);
    const serverUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();
    const [currentUser, setCurrentUser] = useState(null);
    const [quickRoomId, setQuickRoomId] = useState('');
    const [showAuthPanel, setShowAuthPanel] = useState(false);

    useEffect(() => {
        const loadCurrentUser = async () => {
            if (!getAuthToken()) {
                setCurrentUser(null);
                return;
            }

            try {
                const response = await axios.get(`${serverUrl}/api/auth/me`, {
                    headers: getAuthHeaders(),
                });
                setCurrentUser(response.data.user);
            } catch {
                setCurrentUser(null);
            }
        };

        loadCurrentUser();
    }, [serverUrl]);

    const handleQuickJoin = (event) => {
        event.preventDefault();
        const resolvedRoomId = quickRoomId.trim() || createRoomId();

        navigate(`/editor/${resolvedRoomId}`, {
            state: {
                username: currentUser?.name || 'Guest',
                role: 'Peer',
                sessionMode: 'peer_practice',
            },
        });
    };

    const focusQuickEntry = () => {
        quickRoomRef.current?.focus();
    };

    return (
        <div className="min-h-screen bg-stone-50 text-slate-900 dark:bg-slate-950 dark:text-white">
            <Navbar />

            <main>
                <section className="border-b border-stone-200 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_28%),radial-gradient(circle_at_78%_18%,_rgba(148,163,184,0.1),_transparent_18%),linear-gradient(180deg,#fff8ef_0%,#f8fafc_48%,#f8fafc_100%)] px-4 pb-20 pt-20 dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.14),_transparent_24%),radial-gradient(circle_at_78%_18%,_rgba(148,163,184,0.08),_transparent_18%),linear-gradient(180deg,#020617_0%,#0f172a_48%,#020617_100%)] sm:px-6 lg:px-8">
                    <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
                        <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-white/80 px-4 py-1.5 text-sm text-amber-900 shadow-sm backdrop-blur dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                            Built for Codeforces practice, mock interviews, and DSA mentoring
                        </div>

                        <div className="mt-8 space-y-5">
                            <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:text-6xl">
                                One room. One solution. No screen sharing.
                            </h1>
                            <p className="mx-auto max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                                Open a room, load a Codeforces problem, write and run code together — without switching tabs or sharing screens. Built for pair DSA practice, mock rounds, and mentor sessions.
                            </p>
                        </div>

                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <button
                                type="button"
                                onClick={focusQuickEntry}
                                className="inline-flex items-center justify-center rounded-md bg-white px-5 py-2.5 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
                            >
                                Start a Room
                            </button>
                            <Link
                                to="/analyse"
                                className="inline-flex items-center justify-center rounded-md border border-amber-500 px-5 py-2.5 text-sm text-amber-400 transition hover:bg-amber-500/10"
                            >
                                Solution Analyser
                            </Link>
                        </div>

                        <form
                            id="join-session"
                            onSubmit={handleQuickJoin}
                            className="mt-8 flex w-full max-w-2xl flex-col gap-3 rounded-[1.75rem] border border-stone-200 bg-white/85 p-4 shadow-[0_28px_90px_-48px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/75 sm:flex-row sm:items-center"
                        >
                            <input
                                ref={quickRoomRef}
                                type="text"
                                value={quickRoomId}
                                onChange={(event) => setQuickRoomId(event.target.value.toUpperCase())}
                                placeholder="Paste a Room ID, or leave blank to create one"
                                className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            />
                            <button
                                type="submit"
                                className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                            >
                                Enter
                            </button>
                        </form>

                        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                            {currentUser ? `Jump in as ${currentUser.name}.` : 'No signup needed. Sign in only to save room and run history.'}
                        </p>

                        {!currentUser && (
                            <button
                                type="button"
                                onClick={() => setShowAuthPanel((prev) => !prev)}
                                className="mt-5 text-sm font-medium text-slate-600 underline-offset-4 transition hover:text-slate-900 hover:underline dark:text-slate-300 dark:hover:text-white"
                            >
                                {showAuthPanel ? 'Close account access' : 'Sign in to save history'}
                            </button>
                        )}
                    </div>
                </section>

                {(!currentUser && showAuthPanel) && (
                    <section id="auth-entry" className="scroll-mt-24 border-b border-stone-200 bg-white px-4 py-10 dark:border-slate-800 dark:bg-slate-950 sm:px-6 lg:px-8">
                        <div className="mx-auto max-w-6xl space-y-5">
                            <div className="mx-auto flex w-full max-w-2xl items-start justify-between gap-4">
                                <div className="space-y-2 text-left">
                                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-400">Account Access</p>
                                    <h2 className="text-2xl font-bold tracking-tight">Sign in only when you want saved history and rooms.</h2>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowAuthPanel(false)}
                                    className="rounded-xl border border-stone-200 bg-white p-2 text-slate-500 transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
                                    aria-label="Close sign-in panel"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="flex justify-center">
                                <FormComp />
                            </div>
                        </div>
                    </section>
                )}

                <section id="how-it-works" className="scroll-mt-24 bg-white px-4 py-14 dark:bg-slate-950 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl space-y-8">
                        <div className="max-w-2xl space-y-3">
                            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-400">How It Works</p>
                            <h2 className="text-3xl font-bold tracking-tight">From zero to coding together in under a minute.</h2>
                            <p className="text-slate-600 dark:text-slate-400">
                                No configuration. No plugins. Just open a room, load the problem, and start.
                            </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                            {quickStartSteps.map((step, index) => (
                                <div key={step} className="rounded-2xl border border-stone-200 bg-stone-50 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                    <p className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-400">
                                        Step {index + 1}
                                    </p>
                                    <p className="text-sm leading-7 text-slate-700 dark:text-slate-300">{step}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="use-cases" className="scroll-mt-24 border-y border-stone-200 bg-stone-100/70 px-4 py-14 dark:border-slate-800 dark:bg-slate-900/40 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl space-y-8">
                        <div className="max-w-2xl space-y-3">
                            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-400">Use Cases</p>
                            <h2 className="text-3xl font-bold tracking-tight">Narrow by design. Strong where it counts.</h2>
                            <p className="text-slate-600 dark:text-slate-400">
                                ForkSpace doesn&apos;t try to be a full IDE. It&apos;s built for one workflow: two people, one problem, solved together in real time.
                            </p>
                        </div>

                        <div className="grid gap-6 md:grid-cols-3">
                            {useCases.map((item) => (
                                <article key={item.title} className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                    <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                                        <item.icon size={18} strokeWidth={2} />
                                    </div>
                                    <h3 className="text-xl font-semibold">{item.title}</h3>
                                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">{item.description}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

            </main>

            <footer className="border-t border-stone-200 bg-stone-100/70 px-4 py-6 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400 sm:px-6 lg:px-8">
                <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
                    <p>ForkSpace</p>
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <a
                            href="https://github.com/Sundramrai3691"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="transition hover:text-slate-900 dark:hover:text-white"
                        >
                            GitHub
                        </a>
                        <a
                            href="/LICENSE"
                            className="transition hover:text-slate-900 dark:hover:text-white"
                        >
                            MIT License
                        </a>
                        <span>Made by Sundram Kumar Rai, NIT Raipur</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default Login;
