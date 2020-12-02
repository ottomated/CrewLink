import React, { useEffect, useRef } from "react";
import Color from 'color';
import { Player } from "../main/GameReader";
// @ts-ignore
import alive from '../../static/alive.png';
// @ts-ignore
import dead from '../../static/dead.png';
import { backLayerHats, hatOffsets, hats, skins } from "./cosmetics";
import Tooltip from "react-tooltip-lite";

export interface CanvasProps {
	src: string;
	hat: number;
	skin: number;
	color: string;
	shadow: string;
	isAlive: boolean;
}

export interface AvatarProps {
	talking: boolean;
	borderColor: string;
	isAlive: boolean;
	player: Player;
	size: number;
	deafened?: boolean;
	muted?: boolean;
}

const playerColors = [
	['#C51111', '#7A0838',],
	['#132ED1', '#09158E',],
	['#117F2D', '#0A4D2E',],
	['#ED54BA', '#AB2BAD',],
	['#EF7D0D', '#B33E15',],
	['#F5F557', '#C38823',],
	['#3F474E', '#1E1F26',],
	['#D6E0F0', '#8394BF',],
	['#6B2FBB', '#3B177C',],
	['#71491E', '#5E2615',],
	['#38FEDC', '#24A8BE',],
	['#50EF39', '#15A742',]
];

export default function Avatar({ talking, deafened, muted, borderColor, isAlive, player, size }: AvatarProps) {
	let color = playerColors[player.colorId];
	if (!color) color = playerColors[0];
	return (
		<Tooltip useHover={!player.isLocal} content={player.name} padding={5}>
			<div className="avatar" style={{
				borderColor: talking ? borderColor : 'transparent',
				borderWidth: Math.max(2, size / 40),
				width: size,
				height: size
			}}>
				<Canvas src={isAlive ? alive : dead} hat={player.hatId - 1} skin={player.skinId - 1} isAlive={isAlive} color={color[0]} shadow={color[1]} />
				{
					deafened &&
					<svg viewBox="0 0 24 24" fill="white" width="28px" height="28px"><path d="M0 0h24v24H0z" fill="none" /><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>

					|| muted && !deafened &&
					<svg viewBox="0 0 24 24" fill="white" width="28px" height="28px"><path d="M0 0h24v24H0z" fill="none" /><path d="M 17.575 13.2582 A 6.1486 6.1486 90 0 0 17.9025 11.2726 V 10.0417 a 0.6155 0.6155 90 0 0 -1.2309 0 v 1.2309 c 0 0.3372 -0.0333 0.6647 -0.0985 0.9835 l 1.002 1.002 z m -3.1045 2.1173 A 4.9238 4.9238 90 0 1 6.8238 11.2726 V 10.0417 a 0.6155 0.6155 90 0 0 -1.2309 0 v 1.2309 a 6.1548 6.1548 90 0 0 5.5393 6.124 V 19.8894 h -3.6928 a 0.6155 0.6155 90 0 0 0 1.2309 h 8.6167 a 0.6155 0.6155 90 0 0 0 -1.2309 h -3.6928 v -2.4927 a 6.1215 6.1215 90 0 0 2.9913 -1.1362 l -0.8838 -0.885 z M 15.4405 11.125 V 5.1178 a 3.6928 3.6928 90 0 0 -7.1912 -1.1854 L 15.4405 11.1237 z M 8.0548 8.9585 l 5.5221 5.5221 A 3.6928 3.6928 90 0 1 8.0548 11.2726 V 8.9596 z m 10.6428 8.9047 l -14.7715 -14.7715 l 0.8715 -0.8715 l 14.7715 14.7715 l -0.8715 0.8703 z"/></svg>
				}
			</div>

		</Tooltip>
	);
}

function Canvas({ src, hat, skin, color, shadow, isAlive }: CanvasProps) {
	const canvas = useRef<HTMLCanvasElement>(null);
	const hatImg = useRef<HTMLImageElement>(null);
	const skinImg = useRef<HTMLImageElement>(null);
	const image = useRef<HTMLImageElement>(null);

	useEffect(() => {
		(async () => {
			if (!canvas.current || !image.current || !hatImg.current || !skinImg.current) return;
			const ctx = canvas.current.getContext('2d')!;

			if (!image.current.complete) {
				await new Promise(r => image!.current!.onload = r);
			}
			if (!hatImg.current.complete) {
				await new Promise(r => hatImg!.current!.onload = r);
			}
			if (!skinImg.current.complete) {
				await new Promise(r => skinImg!.current!.onload = r);
			}

			canvas.current.width = image.current.width;
			canvas.current.height = image.current.height;
			ctx.clearRect(0, 0, canvas.current.width, canvas.current.height);
			ctx.drawImage(image.current, 0, 0);

			function drawHat() {
				let hatY = 17 - hatOffsets[hat];
				ctx.drawImage(hatImg.current!, 0, hatY > 0 ? 0 : -hatY, hatImg.current!.width, hatImg.current!.height, canvas.current!.width / 2 - hatImg.current!.width / 2 + 2, Math.max(hatY, 0), hatImg.current!.width, hatImg.current!.height);
			}


			let data = ctx.getImageData(0, 0, image.current.width, image.current.height);
			for (let i = 0; i < data.data.length; i += 4) {
				let r = data.data[i],
					g = data.data[i + 1],
					b = data.data[i + 2];
				if (r !== 255 || g !== 255 || b !== 255) {
					let pixelColor = Color('#000000')
						.mix(Color(shadow), b / 255)
						.mix(Color(color), r / 255)
						.mix(Color('#9acad5'), g / 255);
					data.data[i] = pixelColor.red();
					data.data[i + 1] = pixelColor.green();
					data.data[i + 2] = pixelColor.blue();
				}
			}
			ctx.putImageData(data, 0, 0);
			if (isAlive) {
				if (backLayerHats.has(hat))
					ctx.globalCompositeOperation = 'destination-over';
				drawHat();
				ctx.globalCompositeOperation = 'source-over';

				ctx.drawImage(skinImg.current, 25, 46);
			}
		})();

	}, [src, color, shadow, hat, skin, isAlive]);

	return (
		<>
			<img src={src} ref={image} style={{ display: 'none' }} />
			<img src={hats[hat]} ref={hatImg} style={{ display: 'none' }} />
			<img src={skins[skin]} ref={skinImg} style={{ display: 'none' }} />
			<canvas className='canvas' ref={canvas} />
		</>
	)
}