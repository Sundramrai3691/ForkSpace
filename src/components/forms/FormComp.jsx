import { useRef, useContext } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'react-hot-toast';
import { ThemeContext } from '../../../Context/ThemeContext';

function FormComp() {
    const navigate = useNavigate();
    const roomIdRef = useRef(null);
    const usernameRef = useRef();
    const { theme } = useContext(ThemeContext);

    const toastStyle = {
        borderRadius: '10px',
        background: theme === 'dark' ? '#1f2937' : '#fff',
        color: theme === 'dark' ? '#fff' : '#000',
    };

    const generateRoomId = (e) => {
        e.preventDefault();
        const roomId = Math.random().toString(36).substring(2, 10).toUpperCase();

        if (roomIdRef.current) {
            roomIdRef.current.value = roomId;
            roomIdRef.current.focus();
        }

        toast.success('Room ID generated successfully!', { style: toastStyle });
    };

    const joinRoom = (e) => {
        e.preventDefault();

        const roomId = roomIdRef.current?.value?.trim();
        const username = usernameRef.current?.value?.trim();

        if (!roomId || !username) {
            toast.error('Please enter both Room ID and Username', { style: toastStyle });
            return;
        }

        navigate(`/editor/${roomId}`, {
            state: {
                username,
            }
        });
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
                            Start a mock interview or DSA mentoring room
                        </p>
                    </div>

                    <form onSubmit={joinRoom} className="space-y-6 p-8">
                        <div className="space-y-2">
                            <label
                                htmlFor="roomId"
                                className="block text-sm font-medium text-black dark:text-gray-300"
                            >
                                Practice Room ID
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    id="roomId"
                                    ref={roomIdRef}
                                    placeholder="Enter practice room ID"
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition-all duration-200 placeholder:text-gray-500 focus:border-transparent focus:ring-2 focus:ring-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400 dark:focus:ring-gray-100"
                                    required
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label
                                htmlFor="username"
                                className="block text-sm font-medium text-black dark:text-gray-300"
                            >
                                Display Name
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    id="username"
                                    ref={usernameRef}
                                    placeholder="Enter your name"
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition-all duration-200 placeholder:text-gray-500 focus:border-transparent focus:ring-2 focus:ring-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400 dark:focus:ring-gray-100"
                                    required
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button
                                type="submit"
                                className="w-full rounded-xl bg-black px-4 py-3 font-medium text-white shadow-lg transition-all duration-200 hover:scale-[1.02] hover:bg-gray-800 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 dark:focus:ring-gray-100 dark:focus:ring-offset-gray-800"
                            >
                                Join Practice Room
                            </button>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200 dark:border-gray-600"></div>
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-white px-3 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                        or
                                    </span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={generateRoomId}
                                className="w-full rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 font-medium text-black transition-all duration-200 hover:border-gray-300 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-600 dark:focus:ring-offset-gray-800"
                            >
                                <div className="flex items-center justify-center space-x-2">
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    <span>Generate Practice Room</span>
                                </div>
                            </button>
                        </div>
                    </form>

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
