import React, { useContext, useEffect, useState } from 'react'
import { SettingsContext } from './App';

const TestMicrophoneButton: React.FC = () => {
    const [{ microphone }] = useContext(SettingsContext)
    const [error, setError] = useState<boolean>(false)
    const [rms, setRms] = useState<number>(0)

    useEffect(() => {
        setError(false)

        const ctx = new AudioContext()
        const processor = ctx.createScriptProcessor(2048, 1, 1)
        processor.connect(ctx.destination)

        const handleProcess = (event: AudioProcessingEvent) => {
            if (Math.floor(event.timeStamp / 10) % 50 !== 0) return
    
            const input = event.inputBuffer.getChannelData(0)
            const total = input.reduce((acc, val) => acc + Math.abs(val), 0)
            const rms = Math.sqrt(total / input.length)
            setRms(rms)
        }

        navigator.mediaDevices.getUserMedia({ audio: { deviceId: microphone ?? 'default' } })
            .then((stream) => {
                const src = ctx.createMediaStreamSource(stream)
                src.connect(processor)
                processor.addEventListener('audioprocess', handleProcess)
            })
            .catch(() => setError(true))

        return () => {
            processor.removeEventListener('audioprocess', handleProcess)
        }
    }, [microphone])

    if (error) return <p style={{ fontSize: 12, color: 'red' }}>Could no connect to microphone</p>

    return <div style={{ width: 200, background: 'red', height: 20 }}><div style={{ background: 'green', width: `${rms * 2 * 100}%`, height: 20 }}></div></div>
}

export default TestMicrophoneButton
