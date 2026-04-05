import { useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { ThemeContext } from '../../../Context/ThemeContext';
import { Monitor, Sun, Moon } from 'lucide-react';
import { clearAuthToken, getAuthHeaders, getAuthToken, onAuthChange } from '../../lib/auth';

function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const { theme, setTheme } = useContext(ThemeContext);
    const serverUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();

    const toggleMenu = () => {
        setIsMenuOpen((prev) => !prev);
    };

    const closeMenu = () => {
        setIsMenuOpen(false);
    };

    const handleScrollToJoin = () => {
        closeMenu();
        document.getElementById('join-session')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleScrollToAuth = () => {
        closeMenu();
        document.getElementById('auth-entry')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleScrollToSection = (sectionId) => {
        closeMenu();
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

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
                clearAuthToken();
                setCurrentUser(null);
            }
        };

        loadCurrentUser();

        const removeAuthListener = onAuthChange(loadCurrentUser);
        const handleStorage = () => loadCurrentUser();
        window.addEventListener('storage', handleStorage);

        return () => {
            removeAuthListener();
            window.removeEventListener('storage', handleStorage);
        };
    }, [serverUrl]);

    const handleSignOut = () => {
        clearAuthToken();
        closeMenu();
    };

    return (
        <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-md dark:border-gray-700 dark:bg-gray-900/95">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="rounded-lg bg-black p-1 dark:bg-white">
                            <img
                                src={theme === 'dark' ? '/favicon-dark.svg' : '/favicon.svg'}
                                alt="ForkSpace logo"
                                className="h-8 w-8 rounded-lg invert dark:invert-0"
                            />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                                ForkSpace
                            </h1>
                            <span className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
                                Interview practice and DSA mentoring rooms
                            </span>
                        </div>
                    </div>

                    <div className="hidden md:block">
                        <div className="ml-10 flex items-baseline space-x-8">
                            <button
                                type="button"
                                onClick={() => handleScrollToSection('how-it-works')}
                                className="px-3 py-2 text-sm font-medium text-gray-700 transition-colors duration-200 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                            >
                                How It Works
                            </button>
                            <button
                                type="button"
                                onClick={() => handleScrollToSection('use-cases')}
                                className="px-3 py-2 text-sm font-medium text-gray-700 transition-colors duration-200 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                            >
                                Use Cases
                            </button>
                            <button
                                type="button"
                                onClick={() => handleScrollToSection('quick-start')}
                                className="px-3 py-2 text-sm font-medium text-gray-700 transition-colors duration-200 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                            >
                                Quick Start
                            </button>
                        </div>
                    </div>

                    <div className="hidden items-center space-x-3 md:flex">
                        <div className="relative flex items-center rounded-lg border border-gray-200/50 bg-gray-50 p-0.5 backdrop-blur-sm dark:border-gray-700/50 dark:bg-gray-800/50">
                            <button
                                onClick={() => setTheme('light')}
                                className={`relative rounded-md p-1.5 transition-all duration-200 ${
                                    theme === 'light'
                                        ? 'bg-white text-amber-500 shadow-sm dark:bg-gray-700 dark:text-amber-400'
                                        : 'text-gray-400 hover:bg-white/50 hover:text-gray-600 dark:hover:bg-gray-700/50 dark:hover:text-gray-300'
                                }`}
                                aria-label="Light theme"
                                title="Light theme"
                            >
                                <Sun size={14} className="transition-colors duration-200" />
                            </button>
                            <button
                                onClick={() => setTheme('dark')}
                                className={`relative rounded-md p-1.5 transition-all duration-200 ${
                                    theme === 'dark'
                                        ? 'bg-gray-800 text-blue-400 shadow-sm dark:bg-gray-600 dark:text-blue-300'
                                        : 'text-gray-400 hover:bg-white/50 hover:text-gray-600 dark:hover:bg-gray-700/50 dark:hover:text-gray-300'
                                }`}
                                aria-label="Dark theme"
                                title="Dark theme"
                            >
                                <Moon size={14} className="transition-colors duration-200" />
                            </button>
                            <button
                                onClick={() => setTheme('system')}
                                className={`relative rounded-md p-1.5 transition-all duration-200 ${
                                    theme === 'system'
                                        ? 'bg-white text-emerald-500 shadow-sm dark:bg-gray-700 dark:text-emerald-400'
                                        : 'text-gray-400 hover:bg-white/50 hover:text-gray-600 dark:hover:bg-gray-700/50 dark:hover:text-gray-300'
                                }`}
                                aria-label="System theme"
                                title="System theme"
                            >
                                <Monitor size={14} className="transition-colors duration-200" />
                            </button>
                        </div>

                        <a
                            href="https://github.com/PiyushAryan/ForkSpace"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1.5 rounded-lg border border-gray-700 bg-black px-3 py-1.5 text-white shadow-sm transition-all duration-200 hover:scale-[1.02] hover:bg-gray-800 hover:shadow-md dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                            </svg>
                            <svg className="h-3.5 w-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                            <span className="text-xs font-medium">0</span>
                        </a>

                        {currentUser ? (
                            <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white/90 px-2 py-1.5 shadow-sm dark:border-gray-700 dark:bg-gray-800/90">
                                <button
                                    type="button"
                                    onClick={handleScrollToJoin}
                                    className="flex items-center gap-3 rounded-xl px-2 py-1 text-left transition hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-sm font-semibold text-white dark:bg-white dark:text-gray-900">
                                        {currentUser.name?.charAt(0)?.toUpperCase() || 'F'}
                                    </div>
                                    <div className="max-w-[160px]">
                                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{currentUser.name}</p>
                                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{currentUser.email}</p>
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSignOut}
                                    className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-900 dark:border-gray-600 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:text-white"
                                >
                                    Sign Out
                                </button>
                            </div>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={handleScrollToAuth}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 transition-colors duration-200 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                                >
                                    Sign In
                                </button>
                                <button
                                    type="button"
                                    onClick={handleScrollToAuth}
                                    className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-all duration-200 shadow-sm hover:bg-gray-800 hover:shadow-md"
                                >
                                    Create Account
                                </button>
                            </>
                        )}
                    </div>

                    <div className="md:hidden">
                        <button
                            onClick={toggleMenu}
                            className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-orange-500 dark:hover:bg-gray-800"
                            aria-expanded="false"
                        >
                            <span className="sr-only">Open main menu</span>
                            {!isMenuOpen ? (
                                <svg className="block h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            ) : (
                                <svg className="block h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {isMenuOpen && (
                <div className="md:hidden">
                    <div className="space-y-1 border-t border-gray-200 bg-white px-2 pb-3 pt-2 dark:border-gray-700 dark:bg-gray-900 sm:px-3">
                        <button
                            type="button"
                            onClick={() => handleScrollToSection('how-it-works')}
                            className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                        >
                            How It Works
                        </button>
                        <button
                            type="button"
                            onClick={() => handleScrollToSection('use-cases')}
                            className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                        >
                            Use Cases
                        </button>
                        <button
                            type="button"
                            onClick={() => handleScrollToSection('quick-start')}
                            className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                        >
                            Quick Start
                        </button>

                        <div className="border-t border-gray-200 pb-3 pt-4 dark:border-gray-700">
                            <div className="flex items-center justify-between px-3">
                                <div className="flex items-center space-x-1 rounded-lg bg-gray-50 p-0.5 dark:bg-gray-800/50">
                                    <button
                                        onClick={() => setTheme('light')}
                                        className={`rounded-md p-2 transition-all duration-200 ${
                                            theme === 'light'
                                                ? 'bg-white text-amber-500 shadow-sm dark:bg-gray-700'
                                                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                        }`}
                                        aria-label="Light theme"
                                    >
                                        <Sun size={16} />
                                    </button>
                                    <button
                                        onClick={() => setTheme('dark')}
                                        className={`rounded-md p-2 transition-all duration-200 ${
                                            theme === 'dark'
                                                ? 'bg-gray-800 text-blue-400 shadow-sm dark:bg-gray-600'
                                                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                        }`}
                                        aria-label="Dark theme"
                                    >
                                        <Moon size={16} />
                                    </button>
                                    <button
                                        onClick={() => setTheme('system')}
                                        className={`rounded-md p-2 transition-all duration-200 ${
                                            theme === 'system'
                                                ? 'bg-white text-emerald-500 shadow-sm dark:bg-gray-700'
                                                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                        }`}
                                        aria-label="System theme"
                                    >
                                        <Monitor size={16} />
                                    </button>
                                </div>

                                <a
                                    href="https://github.com/PiyushAryan/ForkSpace"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                                >
                                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
                                    </svg>
                                </a>
                            </div>

                            <div className="mt-3 space-y-2 px-3">
                                {currentUser ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleScrollToJoin}
                                            className="block w-full rounded-md bg-black px-3 py-2 text-left text-base font-medium text-white transition-all duration-200 dark:bg-white dark:text-gray-900"
                                        >
                                            Continue as {currentUser.name}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSignOut}
                                            className="block w-full rounded-md border border-gray-200 px-3 py-2 text-left text-base font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                                        >
                                            Sign Out
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleScrollToAuth}
                                            className="block w-full rounded-md px-3 py-2 text-left text-base font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                                        >
                                            Sign In
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleScrollToAuth}
                                            className="block w-full rounded-md bg-black px-3 py-2 text-base font-medium text-white transition-all duration-200 dark:bg-white dark:text-gray-900"
                                        >
                                            Create Account
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
}

export default Navbar;
