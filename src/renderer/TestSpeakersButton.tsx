import React from 'react';
// @ts-ignore
import chime from '../../static/chime.mp3';
import { ExtendedAudioElement } from './Voice';

interface TestSpeakersProps {
	speaker: string
}

const TestSpeakersButton: React.FC<TestSpeakersProps> = ({ speaker }: TestSpeakersProps) => {
	const testSpeakers = () => {
		const audio = new Audio() as ExtendedAudioElement;
		audio.src = chime;

		if (speaker.toLowerCase() !== 'default')
			audio.setSinkId(speaker);

		audio.play();
	};

	return (
		<button className="test-speakers" onClick={testSpeakers}>Test Speaker</button>
	);
};

export default TestSpeakersButton;
