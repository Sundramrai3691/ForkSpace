import { useRef, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { ThemeContext } from '../../../Context/ThemeContext';
import { clearAuthToken, getAuthHeaders, getAuthToken, setAuthToken } from '../../lib/auth';

function FormComp() {
    const navigate = useNavigate();
    const roomIdRef = useRef(null);
    const usernameRef = useRef(null);
    const roleRef = useRef(null);
    const { theme } = useContext(ThemeContext);
    const serverUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();
    const [authMode, setAuthMode] = useState('login');
    const [authLoading, setAuthLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [history, setHistory] = useState({ rooms: [], runs: [] });
    const [authForm, setAuthForm] = useState({
        name: '',
        email: '',
        password: '',
    });

    const toastStyle = {
        borderRadius: '10px',
        background: theme === 'dark' ? '#1f2937' : '#fff',
        color: theme === 'dark' ? '#fff' : '#000',
    };

    const loadHistory = async () => {
        const token = getAuthToken();

        if (!token) {
            setHistory({ rooms: [], runs: [] });
            return;
        }

        setHistoryLoading(true);

        try {
            const [meResponse, historyResponse] = await Promise.all([
                axios.get(`${serverUrl}/api/auth/me`, {
                    headers: getAuthHeaders(),
                }),
                axios.get(`${serverUrl}/api/auth/history`, {
                    headers: getAuthHeaders(),
                }),
            ]);

            setCurrentUser(meResponse.data.user);
            setHistory(historyResponse.data);
        } catch {
            clearAuthToken();
            setCurrentUser(null);
            setHistory({ rooms: [], runs: [] });
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        loadHistory();
    }, []);

    useEffect(() => {
        if (currentUser && usernameRef.current && !usernameRef.current.value) {
            usernameRef.current.value = currentUser.name;
        }
    }, [currentUser]);

    const generateRoomId = (event) => {
        event.preventDefault();
        const roomId = Math.random().toString(36).substring(2, 10).toUpperCase();

        if (roomIdRef.current) {
            roomIdRef.current.value = roomId;
            roomIdRef.current.focus();
        }

        toast.success('Room ID generated successfully!', { style: toastStyle });
    };

    const joinRoom = (event) => {
        event.preventDefault();

        const roomId = roomIdRef.current?.value?.trim();
        const username = usernameRef.current?.value?.trim() || currentUser?.name;
        const role = roleRef.current?.value?.trim() || 'Peer';

        if (!roomId || !username) {
            toast.error('Please enter both Room ID and Username', { style: toastStyle });
            return;
        }

        navigate(`/editor/${roomId}`, {
            state: {
                username,
                role,
            }
        });
    };

    const handleAuthSubmit = async (event) => {
        event.preventDefault();
        setAuthLoading(true);

        try {
            const endpoint = authMode === 'signup' ? '/api/auth/register' : '/api/auth/login';
            const payload = authMode === 'signup'
                ? authForm
                : { email: authForm.email, password: authForm.password };
            const response = await axios.post(`${serverUrl}${endpoint}`, payload);

            setAuthToken(response.data.token);
            setCurrentUser(response.data.user);
            setAuthForm({ name: '', email: '', password: '' });
            toast.success(authMode === 'signup' ? 'Account created' : 'Signed in', { style: toastStyle });
            await loadHistory();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Authentication failed', { style: toastStyle });
        } finally {
            setAuthLoading(false);
        }
    };

    const handleSignOut = () => {
        clearAuthToken();
        setCurrentUser(null);
        setHistory({ rooms: [], runs: [] });
        toast.success('Signed out', { style: toastStyle });
    };

    return (
        <div className="flex items-center justify-center">
            <div className="relative w-full max-w-md">
                <div className="overflow-hidden rounded-[2rem] border border-gray-200 bg-white/95 shadow-2xl backdrop-blur-md dark:border-gray-700 dark:bg-gray-800/95">
                    <div className="border-b border-gray-100 px-8 pb-6 pt-8 text-center dark:border-gray-700">
                        <div className="mb-4 flex items-center justify-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900 dark:bg-gray-100">
                                <svg className="h-6 w-6 text-white dark:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m13 0H10m8-8H4a2 2 0 00-2 2v6a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2z" />
                                </svg>
                            </div>
                        </div>
                        <h1 className="mb-2 text-2xl font-bold text-black dark:text-white">
                            Welcome to ForkSpace
                        </h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Sign in to keep your rooms, problems, and recent runs.
                        </p>
                    </div>

                    <div className="space-y-6 p-8">
                        <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                            <div className="mb-4 flex rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800">
                                {['login', 'signup'].map((mode) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        onClick={() => setAuthMode(mode)}
                                        className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                                            authMode === mode
                                                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                                                : 'text-gray-600 dark:text-gray-300'
                                        }`}
                                    >
                                        {mode === 'login' ? 'Sign In' : 'Create Account'}
                                    </button>
                                ))}
                            </div>

                            {currentUser ? (
                                <div className="space-y-3">
                                    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{currentUser.name}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{currentUser.email}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleSignOut}
                                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:text-white"
                                    >
                                        Sign Out
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleAuthSubmit} className="space-y-3">
                                    {authMode === 'signup' && (
                                        <input
                                            type="text"
                                            value={authForm.name}
                                            onChange={(event) => setAuthForm((prev) => ({ ...prev, name: event.target.value }))}
                                            placeholder="Your name"
                                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-gray-100"
                                            required
                                        />
                                    )}
                                    <input
                                        type="email"
                                        value={authForm.email}
                                        onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
                                        placeholder="Email address"
                                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-gray-100"
                                        required
                                    />
                                    <input
                                        type="password"
                                        value={authForm.password}
                                        onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                                        placeholder="Password"
                                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-gray-100"
                                        required
                                    />
                                    <button
                                        type="submit"
                                        disabled={authLoading}
                                        className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                                    >
                                        {authLoading ? 'Please wait...' : authMode === 'signup' ? 'Create Account' : 'Sign In'}
                                    </button>
                                </form>
                            )}
                        </div>

                        <form onSubmit={joinRoom} className="space-y-6">
                            <div className="space-y-2">
                                <label
                                    htmlFor="roomId"
                                    className="block text-sm font-medium text-black dark:text-gray-300"
                                >
                                    Practice Room ID
                                </label>
                                <input
                                    type="text"
                                    id="roomId"
                                    ref={roomIdRef}
                                    placeholder="Enter practice room ID"
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition-all duration-200 placeholder:text-gray-500 focus:border-transparent focus:ring-2 focus:ring-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400 dark:focus:ring-gray-100"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label
                                    htmlFor="username"
                                    className="block text-sm font-medium text-black dark:text-gray-300"
                                >
                                    Display Name
                                </label>
                                <input
                                    type="text"
                                    id="username"
                                    ref={usernameRef}
                                    placeholder="Enter your name"
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition-all duration-200 placeholder:text-gray-500 focus:border-transparent focus:ring-2 focus:ring-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400 dark:focus:ring-gray-100"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label
                                    htmlFor="role"
                                    className="block text-sm font-medium text-black dark:text-gray-300"
                                >
                                    Session Role
                                </label>
                                <select
                                    id="role"
                                    ref={roleRef}
                                    defaultValue="Peer"
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition-all duration-200 focus:border-transparent focus:ring-2 focus:ring-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-gray-100"
                                >
                                    <option>Peer</option>
                                    <option>Candidate</option>
                                    <option>Interviewer</option>
                                    <option>Learner</option>
                                    <option>Mentor</option>
                                </select>
                            </div>

                            <div className="space-y-3">
                                <button
                                    type="submit"
                                    className="w-full rounded-xl bg-black px-4 py-3 font-medium text-white shadow-lg transition-all duration-200 hover:scale-[1.02] hover:bg-gray-800 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 dark:focus:ring-gray-100 dark:focus:ring-offset-gray-800"
                                >
                                    Join Practice Room
                                </button>

                                <button
                                    type="button"
                                    onClick={generateRoomId}
                                    className="w-full rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 font-medium text-black transition-all duration-200 hover:border-gray-300 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-600 dark:focus:ring-offset-gray-800"
                                >
                                    Generate Practice Room
                                </button>
                            </div>
                        </form>

                        {currentUser && (
                            <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                                <div className="mb-3 flex items-center justify-between">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Recent rooms</p>
                                    {historyLoading && <span className="text-xs text-gray-500 dark:text-gray-400">Loading...</span>}
                                </div>
                                <div className="space-y-2">
                                    {(history.rooms || []).length > 0 ? (
                                        history.rooms.slice(0, 4).map((room) => (
                                            <button
                                                key={room.roomId}
                                                type="button"
                                                onClick={() => {
                                                    if (roomIdRef.current) {
                                                        roomIdRef.current.value = room.roomId;
                                                    }
                                                    if (usernameRef.current) {
                                                        usernameRef.current.value = currentUser.name;
                                                    }
                                                }}
                                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-left transition hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
                                            >
                                                <p className="font-mono text-sm text-gray-900 dark:text-white">{room.roomId}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {room.problemTitle || 'Untitled Practice Problem'}
                                                </p>
                                            </button>
                                        ))
                                    ) : (
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Your saved rooms will appear here after you join and work in them.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-gray-100 bg-gray-50 px-8 py-6 dark:border-gray-700 dark:bg-gray-900/50">
                        <div className="text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Built with love by{' '}
                                <a
                                    href="https://pflix.vercel.app/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-gray-700 transition-colors duration-200 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                                >
                                    Sundram Rai
                                </a>
                            </p>
                        </div>
                    </div>
                </div>

                <div className="absolute -left-4 -top-4 h-8 w-8 rounded-full bg-gray-300 opacity-20 animate-pulse dark:bg-gray-600"></div>
                <div className="absolute -bottom-4 -right-4 h-6 w-6 rounded-full bg-gray-400 opacity-30 animate-pulse delay-1000 dark:bg-gray-500"></div>
            </div>
        </div>
    );
}

export default FormComp;
