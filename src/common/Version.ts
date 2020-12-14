let version = '';

if (typeof window !== 'undefined' && window.location) {
    const query = new URLSearchParams(window.location.search.substring(1));
    version = query.get('version') || '';
}

export const appVersion = version

export const isDevelopment = process.env.NODE_ENV !== 'production'