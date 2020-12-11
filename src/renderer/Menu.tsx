import React from 'react';
import { ImpulseSpinner as Spinner } from 'react-spinners-kit';
import { ipcRenderer } from 'electron';
import './css/menu.css';
import Footer from './Footer';

export interface MenuProps {
	errored: boolean
}

const Menu: React.FC<MenuProps> = function ({ errored }: MenuProps) {
	return (
		<div className="root">
			<div className="menu">
				{errored ?
					<>
						<span className="waiting">Error</span>
						<span className="errormessage">
							<ol>
								<li>Use a different Voice Server in settings</li>
								<li>Update Among Us</li>
								<li>Wait for 24 hours after Among Us updates</li>
							</ol>
						</span>
						<button className="button" onClick={() => {
							ipcRenderer.send('relaunch');
						}}>Relaunch App</button>
					</>
					:
					<>
						<span className="waiting">Waiting for Among Us</span>
						<Spinner frontColor="#9b59b6" backColor="#2C2F33" size={80} loading />
						<button className="button" onClick={() => {
							ipcRenderer.send('openGame');
						}}>Open Game</button>
					</>
				}
				<Footer />
			</div>
		</div>
	);
};

export default Menu;