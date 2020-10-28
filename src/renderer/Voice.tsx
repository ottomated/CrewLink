import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
// @ts-ignore
import alive from '../../static/alive.png';
// @ts-ignore
import dead from '../../static/dead.png';
import Canvas from './Canvas';
import audioActivity from 'audio-activity';

interface Offer {
	offer: RTCSessionDescriptionInit;
	from: string;
}
interface Answer {
	answer: RTCSessionDescriptionInit;
	from: string;
}
interface PeerConnections {
	[peer: string]: RTCPeerConnection;
}
interface InCall {
	[peer: string]: boolean;
}
interface AudioElements {
	[peer: string]: HTMLAudioElement[];
}

export default function Voice() {

	const [talking, setTalking] = useState(false);

	useEffect(() => {
		const socket = io('ws://10.0.0.58:5679', { transports: ['websocket'] });
		const peerConnections: PeerConnections = {};
		const inCall: InCall = {};
		const audioElements: AudioElements = {};
		let audioListener: any;

		navigator.getUserMedia({ video: false, audio: true }, async (stream) => {

			audioListener = audioActivity(stream, (level) => {
				setTalking(level > 0.1);
			});

			function createPeerConnection(peer: string) {
				const connection = new RTCPeerConnection();
				peerConnections[peer] = connection;


				connection.ontrack = ({ streams }) => {
					audioElements[peer] = [];
					for (let stream of streams) {
						let audio = document.createElement('audio');
						document.body.appendChild(audio);
						audioElements[peer].push(audio);
						audio.srcObject = stream;
						audio.autoplay = true;
						audio.controls = true;
					}
				};
				connection.onconnectionstatechange = () => {
					if (connection.connectionState === 'failed') {
						inCall[peer] = false;
						connection.close();
						delete peerConnections[peer];
						for (let element of audioElements[peer]) {
							document.body.removeChild(element);
						}
						delete audioElements[peer];
					}
				};
				stream.getTracks().forEach(track => connection.addTrack(track, stream));
				return connection;
			}
			socket.emit('join');
			socket.on('join', async (peer: string) => {
				// Connect to microphone
				const connection = createPeerConnection(peer);

				const offer = await connection.createOffer();
				await connection.setLocalDescription(new RTCSessionDescription(offer));
				socket.emit('offer', {
					offer: await connection.createOffer(),
					to: peer
				});
			});

			socket.on('offer', async ({ offer, from }: Offer) => {
				let connection = peerConnections[from];
				if (!connection) {
					connection = createPeerConnection(from);
				}
				await connection.setRemoteDescription(new RTCSessionDescription(offer));
				const answer = await connection.createAnswer();
				await connection.setLocalDescription(new RTCSessionDescription(answer));
				socket.emit('answer', {
					answer,
					to: from
				});
			});
			socket.on('answer', async ({ answer, from }: Answer) => {
				const connection = peerConnections[from];
				await connection.setRemoteDescription(new RTCSessionDescription(answer));
				if (!inCall[from]) {
					inCall[from] = true;
					const offer = await connection.createOffer();
					await connection.setLocalDescription(new RTCSessionDescription(offer));
					socket.emit('offer', {
						offer,
						to: from
					});
				}
			});

		}, (error) => {
			console.error(error);
		});

		return () => {
			socket.close();
			audioListener.destroy();
		}
	}, []);
	return (
		<div className="root">
			<div className="avatar" style={{ borderColor: talking ? '#9b59b6' : 'transparent' }}>
				<Canvas src={dead} color="#C51111" shadow="#7A0838" />
			</div>
			<span className="username">
				Ottomated
			</span>
			<span className="code">
				MENU
			</span>
		</div>
	)
}