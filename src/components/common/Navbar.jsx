import { useState, useContext, useEffect, useRef } from 'react';
import axios from 'axios';
import { ThemeContext } from '../../../Context/ThemeContext';
import { Monitor, Sun, Moon } from 'lucide-react';
import { clearAuthToken, getAuthHeaders, getAuthToken, onAuthChange } from '../../lib/auth';
import AvatarGlyph from './AvatarGlyph';
import { AVATARS, getAvatarById } from '../../lib/avatars';

function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const { theme, setTheme } = useContext(ThemeContext);
    const profileRef = useRef(null);
    const serverUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();

    const closeMenu = () => {
        setIsMenuOpen(false);
    };

    const handleScrollToJoin = () => {
        closeMenu();
        setIsProfileOpen(false);
        document.getElementById('join-session')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const handleScrollToAuth = () => {
        closeMenu();
        setIsProfileOpen(false);
        document.getElementById('auth-entry')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleScrollToSection = (sectionId) => {
        closeMenu();
        setIsProfileOpen(false);
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

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setIsProfileOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSignOut = () => {
        clearAuthToken();
        setIsProfileOpen(false);
        setIsAvatarPickerOpen(false);
        closeMenu();
    };

    const handleAvatarUpdate = async (avatarId) => {
        if (!currentUser) return;
        try {
            const response = await axios.patch(
                `${serverUrl}/api/auth/avatar`,
                { avatarId },
                { headers: getAuthHeaders() },
            );
            setCurrentUser(response.data.user);
            setIsAvatarPickerOpen(false);
        } catch {
            // Keep menu stable even if update fails.
        }
    };

    const themeOptions = [
        { key: 'light', label: 'Light', icon: Sun },
        { key: 'dark', label: 'Dark', icon: Moon },
        { key: 'system', label: 'System', icon: Monitor },
    ];

    return (
        <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-md dark:border-gray-700 dark:bg-gray-900/95">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between gap-6">
                    <button
                        type="button"
                        onClick={handleScrollToJoin}
                        className="flex shrink-0 items-center gap-3"
                    >
                        <div className="rounded-lg bg-white p-1 shadow-sm ring-1 ring-black/5 dark:bg-white">
                            <img
                                src="/logo.png"
                                alt="ForkSpace logo"
                                className="h-8 w-8 rounded-lg object-contain"
                            />
                        </div>
                        <span className="text-lg font-bold text-gray-900 dark:text-white">ForkSpace</span>
                    </button>

                    <div className="hidden flex-nowrap items-center gap-8 md:flex">
                        <button
                            type="button"
                            onClick={() => handleScrollToSection('how-it-works')}
                            className="shrink-0 text-sm font-medium text-gray-700 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                        >
                            How It Works
                        </button>
                        <button
                            type="button"
                            onClick={() => handleScrollToSection('use-cases')}
                            className="shrink-0 text-sm font-medium text-gray-700 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                        >
                            Use Cases
                        </button>
                        <button
                            type="button"
                            onClick={handleScrollToJoin}
                            className="shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
                        >
                            Start a Room
                        </button>

                        <div className="relative" ref={profileRef}>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsProfileOpen((current) => !current);
                                    setIsAvatarPickerOpen(false);
                                }}
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-sm transition hover:border-gray-300 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:text-white"
                                aria-label="Open profile and theme menu"
                            >
                                <AvatarGlyph avatar={getAvatarById(currentUser?.avatarId)} className="h-4 w-4" />
                            </button>

                            {isProfileOpen && (
                                <div className="absolute right-0 top-12 z-20 w-56 rounded-2xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                                    {currentUser ? (
                                        <div className="border-b border-gray-100 px-2 pb-3 dark:border-gray-700">
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{currentUser.name}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{currentUser.email}</p>
                                        </div>
                                    ) : (
                                        <div className="border-b border-gray-100 px-2 pb-3 dark:border-gray-700">
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white">Theme and account</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Switch the look or sign in to save rooms.</p>
                                        </div>
                                    )}

                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                        {themeOptions.map((option) => {
                                            const Icon = option.icon;
                                            return (
                                                <button
                                                    key={option.key}
                                                    type="button"
                                                    onClick={() => setTheme(option.key)}
                                                    className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs transition ${
                                                        theme === option.key
                                                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                                                            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                                                    }`}
                                                >
                                                    <Icon size={14} />
                                                    {option.label}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-3 space-y-1">
                                        {currentUser ? (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsAvatarPickerOpen((prev) => !prev)}
                                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                                                >
                                                    Update avatar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleScrollToJoin}
                                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                                                >
                                                    Continue to room
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleSignOut}
                                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                                                >
                                                    Sign Out
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={handleScrollToAuth}
                                                className="block w-full rounded-xl px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                                            >
                                                Sign in to save rooms
                                            </button>
                                        )}
                                    </div>
                                    {currentUser && isAvatarPickerOpen && (
                                        <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-700">
                                            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                                                Choose avatar
                                            </p>
                                            <div className="grid grid-cols-3 gap-2">
                                                {AVATARS.map((avatar) => {
                                                    const isActive = currentUser.avatarId === avatar.id;
                                                    return (
                                                        <button
                                                            key={avatar.id}
                                                            type="button"
                                                            onClick={() => handleAvatarUpdate(avatar.id)}
                                                            className={`flex h-10 items-center justify-center rounded-xl border transition ${
                                                                isActive
                                                                    ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                                                                    : 'border-gray-200 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700'
                                                            }`}
                                                            title={avatar.name}
                                                        >
                                                            <AvatarGlyph avatar={avatar} className="h-4 w-4" />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="md:hidden">
                        <button
                            onClick={() => setIsMenuOpen((prev) => !prev)}
                            className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-orange-500 dark:hover:bg-gray-800"
                            aria-expanded={isMenuOpen}
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
                    <div className="space-y-2 border-t border-gray-200 bg-white px-4 pb-4 pt-3 dark:border-gray-700 dark:bg-gray-900">
                        <button
                            type="button"
                            onClick={() => handleScrollToSection('how-it-works')}
                            className="block w-full rounded-md px-3 py-2 text-left text-base font-medium text-gray-700 transition hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                        >
                            How It Works
                        </button>
                        <button
                            type="button"
                            onClick={() => handleScrollToSection('use-cases')}
                            className="block w-full rounded-md px-3 py-2 text-left text-base font-medium text-gray-700 transition hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                        >
                            Use Cases
                        </button>
                        <button
                            type="button"
                            onClick={handleScrollToJoin}
                            className="block w-full rounded-xl bg-amber-500 px-3 py-2 text-left text-base font-semibold text-slate-950 transition hover:bg-amber-400"
                        >
                            Start a Room
                        </button>

                        <div className="rounded-2xl border border-gray-200 px-3 py-3 dark:border-gray-700">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Theme</p>
                            <div className="mt-3 flex items-center gap-2">
                                {themeOptions.map((option) => {
                                    const Icon = option.icon;
                                    return (
                                        <button
                                            key={option.key}
                                            type="button"
                                            onClick={() => setTheme(option.key)}
                                            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                                                theme === option.key
                                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                                                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                                            }`}
                                        >
                                            <Icon size={14} />
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {currentUser ? (
                            <>
                                <button
                                    type="button"
                                    onClick={handleScrollToJoin}
                                    className="block w-full rounded-md px-3 py-2 text-left text-base font-medium text-gray-700 transition hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                                >
                                    Continue as {currentUser.name}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSignOut}
                                    className="block w-full rounded-md px-3 py-2 text-left text-base font-medium text-red-600 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                                >
                                    Sign Out
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={handleScrollToAuth}
                                className="block w-full rounded-md px-3 py-2 text-left text-base font-medium text-gray-700 transition hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                            >
                                Sign in to save rooms
                            </button>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
}

export default Navbar;
