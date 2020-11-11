import React from "react";
import { ImpulseSpinner as Spinner } from "react-spinners-kit";
import { ipcRenderer } from 'electron';
import './css/menu.css';
import Footer from "./Footer";

export default function Menu({ errored }: { errored: boolean }) {
	return (
		<div className="root">
			<div className="menu">
				{errored ?
					<>
						<span className="waiting">Error</span>
						<span className="errormessage">
							Make sure that the Voice Server is correct in the settings and you are using the latest version of Among Us. If there was a recent update, CrewLink might not work for a few days.
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
}