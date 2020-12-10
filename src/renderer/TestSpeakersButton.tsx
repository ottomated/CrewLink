import React from 'react';
// @ts-ignore
import chime from '../../static/chime.mp3';

interface ITestSpeakersProps {
    speaker: string
}

const TestSpeakersButton: React.FunctionComponent<ITestSpeakersProps> = ({ speaker }) => {
	const testSpeakers = () => {
		const audio = new Audio();
		audio.src = chime;

		if (speaker.toLowerCase() !== 'default')
			(audio as any).setSinkId(speaker);

		audio.play();
	};

	return <button className="test-speakers" onClick={testSpeakers}>Test Speaker</button>;
};

export default TestSpeakersButton;
