const AUTH_TOKEN_KEY = 'forkspace_auth_token';

export function getAuthToken() {
    return window.localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

export function setAuthToken(token) {
    if (!token) {
        window.localStorage.removeItem(AUTH_TOKEN_KEY);
        return;
    }

    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function getAuthHeaders() {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}
