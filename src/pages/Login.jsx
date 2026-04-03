import FormComp from '../components/forms/FormComp';
import Navbar from '../components/common/Navbar';

const featureCards = [
    {
        title: 'Realtime Collaboration',
        description: 'Code together in the same room with live cursor updates and instant sync.',
    },
    {
        title: 'AI Suggestions',
        description: 'Generate inline coding hints and quick improvement ideas without leaving the editor.',
    },
    {
        title: 'Run Code Fast',
        description: 'Execute snippets from the workspace and inspect output without breaking your flow.',
    },
];

const docSteps = [
    'Create or paste a room ID, enter your username, and join the editor.',
    'Share the room code with teammates so everyone lands in the same session.',
    'Use the room menu to copy the room ID or head back home when you are done.',
];

const pricingTiers = [
    {
        name: 'Starter',
        price: 'Free',
        description: 'Perfect for interviews, practice rooms, and quick pair-programming sessions.',
    },
    {
        name: 'Team Ready',
        price: 'Self-host',
        description: 'Run the socket and AI services locally or on your own infrastructure.',
    },
];

function Login() {
    return (
        <div className="min-h-screen bg-stone-50 text-slate-900 dark:bg-slate-950 dark:text-white">
            <Navbar />

            <main>
                <section className="border-b border-stone-200 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_32%),linear-gradient(180deg,#fff8ef_0%,#f8fafc_48%,#f8fafc_100%)] px-4 py-16 dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.16),_transparent_28%),linear-gradient(180deg,#020617_0%,#0f172a_48%,#020617_100%)] sm:px-6 lg:px-8">
                    <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
                        <div className="space-y-8">
                            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-white/80 px-4 py-1.5 text-sm text-amber-900 shadow-sm backdrop-blur dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                                Collaborative coding for interviews, pairing, and fast reviews
                            </div>

                            <div className="space-y-5">
                                <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                                    A home page that now leads somewhere useful.
                                </h1>
                                <p className="max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                                    ForkSpace gives you a shared room, live code sync, and AI-assisted editing without forcing people through a confusing setup.
                                </p>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row">
                                <a
                                    href="#join-session"
                                    className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                                >
                                    Get Started
                                </a>
                                <a
                                    href="#demo"
                                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                                >
                                    See Live Demo Details
                                </a>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-3">
                                <div className="rounded-2xl border border-stone-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                                    <p className="text-2xl font-bold">Rooms</p>
                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Spin up a shared session in seconds.</p>
                                </div>
                                <div className="rounded-2xl border border-stone-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                                    <p className="text-2xl font-bold">Socket.IO</p>
                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Realtime sync between everyone in the room.</p>
                                </div>
                                <div className="rounded-2xl border border-stone-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                                    <p className="text-2xl font-bold">AI + Run</p>
                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Hints and execution tools live beside your code.</p>
                                </div>
                            </div>
                        </div>

                        <div id="join-session" className="scroll-mt-24">
                            <FormComp />
                        </div>
                    </div>
                </section>

                <section id="features" className="scroll-mt-24 px-4 py-16 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl space-y-8">
                        <div className="max-w-2xl space-y-3">
                            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-400">Features</p>
                            <h2 className="text-3xl font-bold tracking-tight">The top navigation now lands on real product sections.</h2>
                            <p className="text-slate-600 dark:text-slate-400">
                                These cards back up what the app already does today, so clicking “Features” no longer feels like a dead end.
                            </p>
                        </div>

                        <div className="grid gap-6 md:grid-cols-3">
                            {featureCards.map((card) => (
                                <article key={card.title} className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                    <h3 className="text-xl font-semibold">{card.title}</h3>
                                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">{card.description}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="demo" className="scroll-mt-24 border-y border-stone-200 bg-stone-100/70 px-4 py-16 dark:border-slate-800 dark:bg-slate-900/40 sm:px-6 lg:px-8">
                    <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
                        <div className="space-y-4">
                            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-400">Live Demo</p>
                            <h2 className="text-3xl font-bold tracking-tight">How the live experience works</h2>
                            <p className="text-slate-600 dark:text-slate-400">
                                Generate a room, invite someone else, and you will both see code changes in the same editor. The toolbar supports code execution, room controls, and AI suggestions.
                            </p>
                            <a
                                href="#join-session"
                                className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
                            >
                                Launch a Room
                            </a>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-slate-100 shadow-xl dark:border-slate-700">
                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-rose-400"></span>
                                <span className="h-3 w-3 rounded-full bg-amber-400"></span>
                                <span className="h-3 w-3 rounded-full bg-emerald-400"></span>
                            </div>
                            <pre className="mt-5 overflow-x-auto text-sm leading-7 text-slate-300">{`// teammate joins the same room
socket.emit('join', { roomId, username: 'Alex' })

// both editors stay in sync
socket.emit('code-change', { roomId, code })

// use AI or Run without leaving the workspace`}</pre>
                        </div>
                    </div>
                </section>

                <section id="documentation" className="scroll-mt-24 px-4 py-16 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl space-y-8">
                        <div className="max-w-2xl space-y-3">
                            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-400">Docs</p>
                            <h2 className="text-3xl font-bold tracking-tight">Quick usage notes right on the home page</h2>
                            <p className="text-slate-600 dark:text-slate-400">
                                This section gives the Docs button a real destination and helps first-time users understand the flow before they join.
                            </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                            {docSteps.map((step) => (
                                <div key={step} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                    <p className="text-sm leading-7 text-slate-700 dark:text-slate-300">{step}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="pricing" className="scroll-mt-24 border-t border-stone-200 px-4 py-16 dark:border-slate-800 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl space-y-8">
                        <div className="max-w-2xl space-y-3">
                            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-400">Pricing</p>
                            <h2 className="text-3xl font-bold tracking-tight">No more placeholder pricing button</h2>
                            <p className="text-slate-600 dark:text-slate-400">
                                ForkSpace is currently positioned like an open project: free to use locally, and flexible if you want to self-host supporting services.
                            </p>
                        </div>

                        <div className="grid gap-6 md:grid-cols-2">
                            {pricingTiers.map((tier) => (
                                <article key={tier.name} className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                    <div className="flex items-center justify-between gap-4">
                                        <h3 className="text-xl font-semibold">{tier.name}</h3>
                                        <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">{tier.price}</span>
                                    </div>
                                    <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-400">{tier.description}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}

export default Login;
