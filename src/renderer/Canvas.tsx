import React, { useEffect, useRef } from "react";
import Color from 'color';

export interface CanvasProps {
	src: string;
	color: string;
	shadow: string;
}

export default function Canvas({ src, color, shadow }: CanvasProps) {
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
			<canvas className='canvas' ref={canvas}>

			</canvas>
		</>
	)
}