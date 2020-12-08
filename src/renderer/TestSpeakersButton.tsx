import React, { useContext } from 'react'
import { SettingsContext } from './App';
// @ts-ignore
import chime from '../../static/chime.mp3';
let audio = "";

const TestSpeakersButton = () => {
    const [{ speaker }] = useContext(SettingsContext)
    
    const testSpeakers = () => {

        if (speaker.toLowerCase() !== 'default')
            (audio as any).setSinkId(speaker)

            if (!audio) audio = getAudio();
            if (!isPlaying(audio)) audio.play();
    }

    return <button className="test-speakers" onClick={testSpeakers}>Test Speaker</button>
}

function getAudio(audio) {
    if (!audio) audio = new Audio(chime);
    return audio;
}

function isPlaying(audio) {
    return audio
        && audio.currentTime > 0
        && !audio.paused
        && !audio.ended
        && audio.readyState > 2;
}

export default TestSpeakersButton
