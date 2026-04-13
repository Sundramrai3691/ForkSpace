import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import axios from 'axios';
import { BrainCircuit, FlaskConical, GraduationCap, Radar, ShieldCheck, Sparkles, Sword, Users2, Workflow, X, Zap } from 'lucide-react';
import FormComp from '../components/forms/FormComp';
import Navbar from '../components/common/Navbar';
import AvatarGlyph from '../components/common/AvatarGlyph';
import { getAuthHeaders, getAuthToken } from '../lib/auth';
import { getAvatarById, getRandomAvatar } from '../lib/avatars';
import { toast } from 'react-hot-toast';

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

const featureHighlights = [
    {
        icon: Workflow,
        title: 'Realtime Shared Workspace',
        description: 'Socket-based code sync, live cursors, shared language switching, and role-aware collaboration in one room.',
    },
    {
        icon: Radar,
        title: 'Codeforces-Ready Problem Flow',
        description: 'Load metadata from Codeforces URL (title, tags, rating) and continue with an honest manual brief workflow.',
    },
    {
        icon: FlaskConical,
        title: 'Hidden Tests (Beta)',
        description: 'Generate verified + stress test sets, run all tests quickly, and review timeout/crash/pass signals clearly.',
    },
    {
        icon: BrainCircuit,
        title: 'Session Intelligence',
        description: 'Analyze and report overlays summarize thinking patterns, strengths, gaps, and next practice priorities.',
    },
    {
        icon: Users2,
        title: 'Interview Modes',
        description: 'Peer Practice, Mock Interview, and Mentoring modes keep sessions structured without extra setup.',
    },
    {
        icon: ShieldCheck,
        title: 'Stable, Practical Workflow',
        description: 'Run/submit with shared outputs, preserved room state, and optional account history when you need it.',
    },
];

function createRoomId() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function Login() {
    const navigate = useNavigate();
    const quickRoomRef = useRef(null);
    const authEntryRef = useRef(null);
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
        const randomAvatar = getRandomAvatar();
        const resolvedAvatarId = currentUser?.avatarId || randomAvatar.id;

        if (!currentUser) {
            toast(
                <span className="inline-flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-400/50 bg-amber-500/15">
                        <AvatarGlyph avatar={getAvatarById(randomAvatar.id)} className="h-3.5 w-3.5" />
                    </span>
                    {`You're ${randomAvatar.name} this session`}
                </span>,
                {
                duration: 3500,
                position: 'bottom-center',
                style: {
                    background: '#111827',
                    color: '#f59e0b',
                    borderRadius: '10px',
                },
            });
        }

        navigate(`/editor/${resolvedRoomId}`, {
            state: {
                username: currentUser?.name || 'Guest',
                avatarId: resolvedAvatarId,
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
                <section className="relative overflow-hidden border-b border-stone-200 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_28%),radial-gradient(circle_at_78%_18%,_rgba(148,163,184,0.1),_transparent_18%),linear-gradient(180deg,#fff8ef_0%,#f8fafc_48%,#f8fafc_100%)] px-4 pb-20 pt-20 dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.14),_transparent_24%),radial-gradient(circle_at_78%_18%,_rgba(148,163,184,0.08),_transparent_18%),linear-gradient(180deg,#020617_0%,#0f172a_48%,#020617_100%)] sm:px-6 lg:px-8">
                    <div className="pointer-events-none absolute -left-20 top-20 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl dark:bg-amber-500/10" />
                    <div className="pointer-events-none absolute -right-20 top-12 h-64 w-64 rounded-full bg-sky-300/20 blur-3xl dark:bg-sky-500/10" />
                    <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
                        <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-white/80 px-4 py-1.5 text-sm text-amber-900 shadow-sm backdrop-blur dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                            <Sparkles size={14} />
                            Realtime interview practice platform for serious DSA sessions
                        </div>

                        <div className="mt-8 space-y-5">
                            <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:text-6xl">
                                Practice interviews and DSA in one polished collaborative room.
                            </h1>
                            <p className="mx-auto max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                                ForkSpace combines shared coding, Codeforces-ready problem setup, run/submit output, hidden tests, and AI-assisted session intelligence into one focused workspace.
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
                        <div className="mt-6 grid w-full max-w-3xl gap-3 text-left sm:grid-cols-3">
                            <div className="rounded-2xl border border-stone-200 bg-white/75 px-4 py-3 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/55">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">Realtime</p>
                                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">Shared editor, cursors, and role sync over Socket.IO.</p>
                            </div>
                            <div className="rounded-2xl border border-stone-200 bg-white/75 px-4 py-3 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/55">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">Execution + Tests</p>
                                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">Run, submit, and hidden-test your code with quick feedback loops.</p>
                            </div>
                            <div className="rounded-2xl border border-stone-200 bg-white/75 px-4 py-3 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/55">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">Session Intelligence</p>
                                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">Analyze and report overlays for better interview-quality reviews.</p>
                            </div>
                        </div>

                        {!currentUser && (
                            <button
                                type="button"
                                onClick={() => {
                                    setShowAuthPanel((prev) => {
                                        const next = !prev;
                                        if (next) {
                                            window.setTimeout(() => {
                                                authEntryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                            }, 30);
                                        }
                                        return next;
                                    });
                                }}
                                className="mt-5 inline-flex items-center justify-center rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-stone-400 hover:bg-stone-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-white"
                            >
                                {showAuthPanel ? 'Close account access' : 'Sign in to save history'}
                            </button>
                        )}
                    </div>
                </section>

                {(!currentUser && showAuthPanel) && (
                    <section ref={authEntryRef} id="auth-entry" className="scroll-mt-24 border-b border-stone-200 bg-white px-4 py-10 dark:border-slate-800 dark:bg-slate-950 sm:px-6 lg:px-8">
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

                <section id="features" className="scroll-mt-24 border-b border-stone-200 bg-white px-4 py-14 dark:border-slate-800 dark:bg-slate-950 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl space-y-8">
                        <div className="max-w-3xl space-y-3">
                            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-400">Core Features</p>
                            <h2 className="text-3xl font-bold tracking-tight">Everything needed for modern collaborative coding practice.</h2>
                            <p className="text-slate-600 dark:text-slate-400">
                                ForkSpace is purpose-built for pair problem solving with practical tools that help you move faster and review better.
                            </p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {featureHighlights.map((feature) => (
                                <article
                                    key={feature.title}
                                    className="group rounded-3xl border border-stone-200 bg-stone-50/75 p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-amber-300/60 hover:shadow-[0_16px_42px_-24px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-amber-500/40"
                                >
                                    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 transition group-hover:scale-105 dark:bg-amber-500/10 dark:text-amber-300">
                                        <feature.icon size={18} strokeWidth={2} />
                                    </div>
                                    <h3 className="text-lg font-semibold">{feature.title}</h3>
                                    <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-400">{feature.description}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="how-it-works" className="scroll-mt-24 bg-white px-4 py-14 dark:bg-slate-950 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl space-y-8">
                        <div className="max-w-2xl space-y-3">
                            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-400">How It Works</p>
                            <h2 className="text-3xl font-bold tracking-tight">From zero to coding together in under a minute.</h2>
                            <p className="text-slate-600 dark:text-slate-400">
                                No configuration. No plugins. Just open a room, load the problem, and start.
                            </p>
                        </div>

                        <div className="relative mx-auto max-w-4xl">
                            <div className="absolute bottom-6 left-6 top-6 w-px bg-gradient-to-b from-amber-300/70 via-amber-400/60 to-amber-300/40 dark:from-amber-500/50 dark:via-amber-400/40 dark:to-amber-600/20 md:left-1/2" />
                            <div className="space-y-5">
                                {quickStartSteps.map((step, index) => {
                                    const isRight = index % 2 === 1;
                                    return (
                                        <div
                                            key={step}
                                            className={`relative flex items-start gap-4 md:gap-6 ${isRight ? 'md:flex-row-reverse' : ''}`}
                                        >
                                            <div className="relative z-10 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-300 bg-amber-50 font-semibold text-amber-700 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300">
                                                {index + 1}
                                            </div>
                                            <div className="absolute left-6 top-6 hidden h-px w-8 bg-amber-300/60 dark:bg-amber-500/40 md:block md:w-10" />
                                            <div
                                                className={`absolute top-6 hidden h-8 w-8 border-t border-amber-300/60 dark:border-amber-500/40 md:block ${
                                                    isRight
                                                        ? 'left-[calc(50%+2.5rem)] rounded-tr-full border-r'
                                                        : 'left-[calc(50%-2rem)] rounded-tl-full border-l'
                                                }`}
                                            />
                                            <div className="min-w-0 flex-1 rounded-2xl border border-stone-200 bg-stone-50 p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 md:max-w-[42%]">
                                                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-400">
                                                    Step {index + 1}
                                                </p>
                                                <p className="text-sm leading-7 text-slate-700 dark:text-slate-300">{step}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
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
                                <article key={item.title} className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
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
