import { io } from "socket.io-client";


export async function connectSocket() {
    const serverUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();

    const socketOptions = {
        forceNew: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: Infinity,
        timeout: 10000,
        transports: ['polling', 'websocket'],
    };

        return io(serverUrl, socketOptions);
};
