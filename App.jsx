import React, { useState, useEffect } from 'react';
import MidiController from './src/mikseta';
import BleConnect from './src/bleConnect';

const App = () => {
    const [showMidiController, setShowMidiController] = useState(false);
    const [isConnectedState, setIsConnectedState] = useState(false);

    useEffect(() => {
        setShowMidiController(isConnectedState);
    }, [isConnectedState]);

    const handleConnectionChange = (isConnected) => {
        console.log('isConnected in App:', isConnected);
        setIsConnectedState(isConnected);
    };

    return (
        <MidiController/>

    );
};

export default App;