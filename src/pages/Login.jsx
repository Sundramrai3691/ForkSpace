import FormComp from '../components/forms/FormComp';
import Navbar from '../components/common/Navbar';

const capabilityCards = [
    {
        title: 'Live Practice Editor',
        description: 'Mentor and learner stay in the same code view, so explanations and edits happen in real time.',
    },
    {
        title: 'DSA Run-and-Check Flow',
        description: 'Run C++, Python, or JavaScript solutions during practice and inspect the result immediately.',
    },
    {
        title: 'Room-Based Mentoring',
        description: 'Share one room code, keep the session focused, and avoid the friction of screen sharing.',
    },
];

const useCases = [
    {
        title: 'Mock Interviews',
        description: 'Practice DSA rounds with interviewer and candidate in the same room without setup overhead.',
    },
    {
        title: '1:1 DSA Mentoring',
        description: 'Walk through patterns, edge cases, and optimizations live while the learner edits alongside you.',
    },
    {
        title: 'Revision Sessions',
        description: 'Revisit solved problems, compare approaches, and quickly rerun examples before interviews.',
    },
];

const quickStartSteps = [
    'Create or paste a practice room ID and enter your name.',
    'Share the room code with your mentor, interviewer, or learner.',
    'Solve the problem together, run the solution, and iterate on feedback in the same room.',
];

function Login() {
    return (
        <div className="min-h-screen bg-stone-50 text-slate-900 dark:bg-slate-950 dark:text-white">
            <Navbar />

            <main>
                <section className="border-b border-stone-200 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_32%),linear-gradient(180deg,#fff8ef_0%,#f8fafc_48%,#f8fafc_100%)] px-4 py-16 dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.16),_transparent_28%),linear-gradient(180deg,#020617_0%,#0f172a_48%,#020617_100%)] sm:px-6 lg:px-8">
                    <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
                        <div className="space-y-8">
                            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-white/80 px-4 py-1.5 text-sm text-amber-900 shadow-sm backdrop-blur dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                                Realtime rooms for interview practice, DSA mentoring, and revision
                            </div>

                            <div className="space-y-5">
                                <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                                    Practice interviews and teach DSA live in one shared coding room.
                                </h1>
                                <p className="max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                                    ForkSpace helps mentors, interviewers, and learners open a room quickly, solve problems together, and run code without screen sharing or extra setup.
                                </p>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row">
                                <a
                                    href="#join-session"
                                    className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                                >
                                    Start a Practice Room
                                </a>
                                <a
                                    href="#quick-start"
                                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                                >
                                    Quick Start
                                </a>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-3">
                                <div className="rounded-2xl border border-stone-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                                    <p className="text-2xl font-bold">Practice</p>
                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Live interviewer and candidate workflow.</p>
                                </div>
                                <div className="rounded-2xl border border-stone-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                                    <p className="text-2xl font-bold">Mentor</p>
                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Explain patterns while editing together.</p>
                                </div>
                                <div className="rounded-2xl border border-stone-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                                    <p className="text-2xl font-bold">Run</p>
                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Compile and inspect solutions on the spot.</p>
                                </div>
                            </div>
                        </div>

                        <div id="join-session" className="scroll-mt-24">
                            <FormComp />
                        </div>
                    </div>
                </section>

                <section id="how-it-works" className="scroll-mt-24 px-4 py-16 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl space-y-8">
                        <div className="max-w-2xl space-y-3">
                            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-400">How It Works</p>
                            <h2 className="text-3xl font-bold tracking-tight">Designed around the interview-practice loop.</h2>
                            <p className="text-slate-600 dark:text-slate-400">
                                ForkSpace works best when it stays focused on one workflow: open a room, discuss the problem, code together, and run the solution immediately.
                            </p>
                        </div>

                        <div className="grid gap-6 md:grid-cols-3">
                            {capabilityCards.map((card) => (
                                <article key={card.title} className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                    <h3 className="text-xl font-semibold">{card.title}</h3>
                                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">{card.description}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="use-cases" className="scroll-mt-24 border-y border-stone-200 bg-stone-100/70 px-4 py-16 dark:border-slate-800 dark:bg-slate-900/40 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl space-y-8">
                        <div className="max-w-2xl space-y-3">
                            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-400">Use Cases</p>
                            <h2 className="text-3xl font-bold tracking-tight">Built for interview preparation and guided problem solving.</h2>
                            <p className="text-slate-600 dark:text-slate-400">
                                Instead of trying to be a full IDE, the product stays useful by centering on sessions where one person teaches, evaluates, or practices with another.
                            </p>
                        </div>

                        <div className="grid gap-6 md:grid-cols-3">
                            {useCases.map((item) => (
                                <article key={item.title} className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                    <h3 className="text-xl font-semibold">{item.title}</h3>
                                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">{item.description}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="quick-start" className="scroll-mt-24 px-4 py-16 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl space-y-8">
                        <div className="max-w-2xl space-y-3">
                            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-400">Quick Start</p>
                            <h2 className="text-3xl font-bold tracking-tight">Three steps to start a mock round or mentoring session.</h2>
                            <p className="text-slate-600 dark:text-slate-400">
                                This keeps the product grounded in the actual practice flow and helps first-time users get into a room quickly.
                            </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                            {quickStartSteps.map((step, index) => (
                                <div key={step} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                    <p className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-400">
                                        Step {index + 1}
                                    </p>
                                    <p className="text-sm leading-7 text-slate-700 dark:text-slate-300">{step}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}

export default Login;
