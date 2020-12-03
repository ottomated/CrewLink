import React, { useContext } from 'react'
import { SettingsContext } from './App';

const TestSpeakersButton = () => {
    const [{ speaker }] = useContext(SettingsContext)

    const testSpeakers = () => {
        const audio = new Audio();
        audio.src = "https://downloads.derock.dev/chime.mp3"

        if (speaker.toLowerCase() !== 'default')
            (audio as any).setSinkId(speaker)

        audio.play();
    }

    return <button onClick={testSpeakers}>Test Speaker</button>
}

export default TestSpeakersButton
