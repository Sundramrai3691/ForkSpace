import { io } from "socket.io-client";


export async function connectSocket() {
    const rawServerUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();
    // Fallback for development if frontend is on 5173 and backend is on 5000
    const serverUrl = (rawServerUrl.includes(":5173") && !import.meta.env.VITE_SERVER_URL) 
        ? rawServerUrl.replace(":5173", ":5000") 
        : rawServerUrl;
    const altServerUrl = serverUrl.includes("localhost:5000")
        ? serverUrl.replace("localhost:5000", "127.0.0.1:5000")
        : null;

    const socketOptions = {
        forceNew: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: Infinity,
        timeout: 10000,
        // Prefer websocket to avoid noisy polling/XHR refused errors in dev.
        transports: ['websocket'],
        rememberUpgrade: true,
    };

    const primary = io(serverUrl, socketOptions);
    if (!altServerUrl || altServerUrl === serverUrl) {
        return primary;
    }

    return new Promise((resolve) => {
        let settled = false;
        const fallbackTimer = setTimeout(() => {
            if (settled) return;
            const fallback = io(altServerUrl, socketOptions);
            fallback.on("connect", () => {
                if (settled) return;
                settled = true;
                primary.disconnect();
                resolve(fallback);
            });
            fallback.on("connect_error", () => {
                // Keep primary retries alive as final fallback.
                if (!settled) {
                    settled = true;
                    resolve(primary);
                }
            });
        }, 1000);

        primary.on("connect", () => {
            if (settled) return;
            settled = true;
            clearTimeout(fallbackTimer);
            resolve(primary);
        });
        primary.on("connect_error", () => {
            if (settled) return;
            // let fallback timer path try 127.0.0.1
        });
    });
};
