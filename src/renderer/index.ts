if (typeof window !== 'undefined' && window.location) {
	const query = new URLSearchParams(window.location.search.substring(1));
	const view = query.get('view') || 'app';
	if (view === 'app') {
		import('./App');
	} else {
		import('./Overlay');
	}
}
