import React, { useEffect, useRef } from "react";
import Color from 'color';
import { Player } from "../main/GameReader";
// @ts-ignore
import alive from '../../static/alive.png';
// @ts-ignore
import dead from '../../static/dead.png';

export interface CanvasProps {
	src: string;
	color: string;
	shadow: string;
}

export interface AvatarProps {
	talking: boolean;
	borderColor: string;
	isAlive: boolean;
	player: Player;
	size: number;
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

export default function Avatar({ talking, borderColor, isAlive, player, size }: AvatarProps) {
	let color = playerColors[player.colorId];
	if (!color) color = playerColors[0];
	return (
		<div className="avatar" style={{
			borderColor: talking ? borderColor : 'transparent',
			borderWidth: Math.max(2, size / 40),
			width: size,
			height: size
		}} data-tip={player.isLocal ? undefined : player.name}>
			<Canvas src={isAlive ? alive : dead} color={color[0]} shadow={color[1]} />
		</div>
	);
}

function Canvas({ src, color, shadow }: CanvasProps) {
	const canvas = useRef<HTMLCanvasElement>(null);
	const image = useRef<HTMLImageElement>(null);

	useEffect(() => {
		if (!canvas.current || !image.current) return;
		const ctx = canvas.current.getContext('2d')!;

		canvas.current.width = image.current.width;
		canvas.current.height = image.current.height;

		ctx.drawImage(image.current, 0, 0);

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

	}, [src, color, shadow]);

	return (
		<>
			<img src={src} ref={image} style={{ display: 'none' }} />
			<canvas className='canvas' ref={canvas} />
		</>
	)
}