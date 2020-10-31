import React from "react";
import { ImpulseSpinner as Spinner } from "react-spinners-kit";
import { ipcRenderer } from 'electron';
import './css/menu.css';

export default function Menu() {
	return (
		<div className="root">
			<div className="menu">
				<span className="waiting">Waiting for Among Us</span>
				<Spinner frontColor="#9b59b6" backColor="#2C2F33" size={80} loading />
				<button className="button" onClick={() => {
					ipcRenderer.send('openGame');
				}}>Open Game</button>

			</div>
		</div>
	);
}