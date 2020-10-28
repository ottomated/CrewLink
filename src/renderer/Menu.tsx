import React from "react";
import { RotateSpinner } from "react-spinners-kit";
import { ipcRenderer } from 'electron';
import './menu.css';

export default function Menu() {
	return (
		<div className="root">
			<span className="waiting">Waiting for Among Us</span>
			<div className="spinner">
				<RotateSpinner color="#9b59b6" size={80} loading />
			</div>
			<button onClick={() => {
				ipcRenderer.send('openGame');
			}}>
				Open Game	
			</button>
		</div>
	);
}