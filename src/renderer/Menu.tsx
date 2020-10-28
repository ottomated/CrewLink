import React from "react";
import { RotateSpinner } from "react-spinners-kit";
import { ipcRenderer } from 'electron';
import './menu.css';

export default function Menu() {
	return (
		<div className="root">
			<div className="menu">
				<span className="waiting">Waiting for Among Us</span>
				<RotateSpinner color="#9b59b6" size={80} loading />
				<button className="button" onClick={() => {
					ipcRenderer.send('openGame');
				}}>Open Game</button>

			</div>
		</div>
	);
}