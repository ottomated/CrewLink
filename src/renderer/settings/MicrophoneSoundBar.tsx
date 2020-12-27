import LinearProgress from '@material-ui/core/LinearProgress';
import Typography from '@material-ui/core/Typography';
import React, { useEffect, useState } from 'react';
import makeStyles from '@material-ui/core/styles/makeStyles';

interface TestMicProps {
	microphone: string;
}

const useStyles = makeStyles((theme) => ({
	root: {
		display: 'flex',
		width: '100%',
		marginBottom: theme.spacing(2),
	},
	bar: {
		height: 8,
		margin: '5px auto',
		width: 200,
	},
	inner: {
		transition: 'transform .05s linear',
	},
}));

const TestMicrophoneButton: React.FC<TestMicProps> = function ({
	microphone,
}: TestMicProps) {
	const classes = useStyles();
	const [error, setError] = useState<boolean>(false);
	const [rms, setRms] = useState<number>(0);

	useEffect(() => {
		setError(false);

		const ctx = new AudioContext();
		const processor = ctx.createScriptProcessor(2048, 1, 1);
		processor.connect(ctx.destination);

		const minUpdateRate = 50;
		let lastRefreshTime = 0;

		const handleProcess = (event: AudioProcessingEvent) => {
			// limit update frequency
			if (event.timeStamp - lastRefreshTime < minUpdateRate) {
				return;
			}

			// update last refresh time
			lastRefreshTime = event.timeStamp;

			const input = event.inputBuffer.getChannelData(0);
			const total = input.reduce((acc, val) => acc + Math.abs(val), 0);
			const rms = Math.min(0.5, Math.sqrt(total / input.length));
			setRms(rms);
		};

		navigator.mediaDevices
			.getUserMedia({
				audio: { deviceId: microphone ?? 'default' },
				video: false,
			})
			.then((stream) => {
				const src = ctx.createMediaStreamSource(stream);
				src.connect(processor);
				processor.addEventListener('audioprocess', handleProcess);
			})
			.catch(() => setError(true));

		return () => {
			processor.removeEventListener('audioprocess', handleProcess);
		};
	}, [microphone]);

	if (error) {
		return (
			<Typography color="error">Could not connect to microphone</Typography>
		);
	} else {
		return (
			<div className={classes.root}>
				<LinearProgress
					classes={{
						root: classes.bar,
						bar: classes.inner,
					}}
					color="secondary"
					variant="determinate"
					value={rms * 2 * 100}
				/>
			</div>
		);
	}
};

export default TestMicrophoneButton;
