import React, { useState } from 'react';
// @ts-ignore
import chime from '../../../static/chime.mp3';
import { ExtendedAudioElement } from '../Voice';
import Button from '@material-ui/core/Button';
import makeStyles from '@material-ui/core/styles/makeStyles';

interface TestSpeakersProps {
	speaker: string;
}

const useStyles = makeStyles(() => ({
	button: {
		width: 'fit-content',
		margin: '5px auto',
	},
}));

const TestSpeakersButton: React.FC<TestSpeakersProps> = ({
	speaker,
}: TestSpeakersProps) => {
	const classes = useStyles();
	const [playing, setPlaying] = useState(false);
	const testSpeakers = () => {
		const audio = new Audio() as ExtendedAudioElement;
		audio.src = chime;

		if (speaker.toLowerCase() !== 'default') audio.setSinkId(speaker);

		audio.play();
		setPlaying(true);
		audio.addEventListener('pause', () => {
			setPlaying(false);
		});
	};

	return (
		<Button
			variant="contained"
			color="secondary"
			size="small"
			className={classes.button}
			onClick={testSpeakers}
			disabled={playing}
		>
			Test Speaker
		</Button>
	);
};

export default TestSpeakersButton;
