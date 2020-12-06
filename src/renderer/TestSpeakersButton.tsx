import React, { useContext } from 'react'
import { SettingsContext } from './contexts';
// @ts-ignore
import chime from '../../static/chime.mp3';

const TestSpeakersButton = () => {
    const [{ speaker }] = useContext(SettingsContext)

    const testSpeakers = () => {
        const audio = new Audio();
        audio.src = chime;

        if (speaker.toLowerCase() !== 'default')
            (audio as any).setSinkId(speaker)

        audio.play();
    }

    return <button className="test-speakers" onClick={testSpeakers}>Test Speaker</button>
}

export default TestSpeakersButton
