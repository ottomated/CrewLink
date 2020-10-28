import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import Voice from './Voice';
import Menu from './Menu';
import { remote } from 'electron';

enum AppState { MENU, VOICE };

function App() {
	const [state, ] = useState<AppState>(AppState.MENU);
	let page;
	switch (state) {
		case AppState.MENU:
			page = <Menu />;
			break;
		case AppState.VOICE:
			page = <Voice />;
			break;
	}
	return (
		<div>

			<div className="titlebar">
				<svg viewBox="0 0 24 24" fill="white" width="20px" height="20px" onClick={() => {
					remote.getCurrentWindow().close();
				}}>
					<path d="M0 0h24v24H0z" fill="none" />
					<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
				</svg>
			</div>
			{page}
		</div>
	)
}

ReactDOM.render(<App />, document.getElementById('app'));