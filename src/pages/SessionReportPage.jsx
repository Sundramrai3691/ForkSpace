import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import axios from "axios";
import toast from "react-hot-toast";

function SessionReportPage() {
    const { shareId } = useParams();
    const [loading, setLoading] = useState(true);
    const [payload, setPayload] = useState(null);

    const rawServerUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();
    const serverUrl =
        rawServerUrl.includes(":5173") && !import.meta.env.VITE_SERVER_URL
            ? rawServerUrl.replace(":5173", ":5000")
            : rawServerUrl;

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await axios.get(
                    `${serverUrl}/api/session-intelligence/report/${shareId}`,
                );
                if (!cancelled) setPayload(res.data);
            } catch {
                toast.error("Report not found or server unavailable.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [shareId, serverUrl]);

    const report = payload?.report;

    return (
        <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] px-4 py-10 dark:bg-[linear-gradient(180deg,#020617_0%,#0f172a_52%,#020617_100%)]">
            <div className="mx-auto max-w-lg">
                <div className="mb-6 flex items-center justify-between gap-3">
                    <Link
                        to="/"
                        className="text-sm font-medium text-amber-700 hover:underline dark:text-amber-300"
                    >
                        Home
                    </Link>
                    <Link
                        to="/history/reports"
                        className="text-sm font-medium text-gray-600 hover:underline dark:text-gray-400"
                    >
                        Analysis Reports
                    </Link>
                </div>

                {loading ? (
                    <p className="text-center text-sm text-gray-600 dark:text-gray-400">Loading report…</p>
                ) : !report ? (
                    <p className="text-center text-sm text-gray-600 dark:text-gray-400">Nothing to show.</p>
                ) : (
                    <div className="rounded-[1.5rem] border border-gray-200/90 bg-white/95 p-6 shadow-lg dark:border-gray-700 dark:bg-slate-900/90">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                            Session Intelligence
                        </p>
                        <h1 className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
                            {payload.problemTitle || "Practice session"}
                        </h1>
                        <div className="mt-6">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                                Session score
                            </p>
                            <p className="mt-1 text-4xl font-bold text-gray-900 dark:text-white">{report.sessionScore}</p>
                        </div>
                        <div className="mt-6">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                                How you think
                            </p>
                            <p className="mt-1 text-sm leading-6 text-gray-800 dark:text-gray-200">{report.howYouThink}</p>
                        </div>
                        <div className="mt-6">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-700 dark:text-teal-300">
                                Strongest signals
                            </p>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-800 dark:text-gray-200">
                                {(report.strongestSignals || []).map((s, i) => (
                                    <li key={i}>{s}</li>
                                ))}
                            </ul>
                        </div>
                        <div className="mt-6">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-700 dark:text-rose-300">
                                Biggest gaps
                            </p>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-800 dark:text-gray-200">
                                {(report.biggestGaps || []).map((s, i) => (
                                    <li key={i}>{s}</li>
                                ))}
                            </ul>
                        </div>
                        <div className="mt-6">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                                Next steps
                            </p>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-800 dark:text-gray-200">
                                {(report.nextSteps || []).map((s, i) => (
                                    <li key={i}>{s}</li>
                                ))}
                            </ul>
                        </div>
                        <div className="mt-6">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                                Next practice targets
                            </p>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-800 dark:text-gray-200">
                                {(report.nextPracticeTargets || []).map((s, i) => (
                                    <li key={i}>{s}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default SessionReportPage;
