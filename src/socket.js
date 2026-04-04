import { io } from "socket.io-client";


export async function connectSocket() {
    const rawServerUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();
    // Fallback for development if frontend is on 5173 and backend is on 5000
    const serverUrl = (rawServerUrl.includes(":5173") && !import.meta.env.VITE_SERVER_URL) 
        ? rawServerUrl.replace(":5173", ":5000") 
        : rawServerUrl;

    const socketOptions = {
        forceNew: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: Infinity,
        timeout: 10000,
        transports: ['polling', 'websocket'],
    };

        return io(serverUrl, socketOptions);
};
