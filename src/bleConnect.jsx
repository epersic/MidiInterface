import React, { useEffect, useState, useRef } from 'react';
import { View, Button, Alert, PermissionsAndroid, Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import {Buffer} from 'buffer';
export async function sendMessage(device, message) {
    const serviceUUID = '00000180-0000-1000-8000-00805f9b34fb';
    const characteristicUUID = '0000dead-0000-1000-8000-00805f9b34fb';
    const base64Message = Buffer.from(message).toString('base64');

    const characteristics = await device.characteristicsForService(serviceUUID);

    const characteristic = characteristics.find(c => c.uuid === characteristicUUID);

    if (characteristic) {
        if (characteristic.isWritableWithResponse || characteristic.isWritableWithoutResponse) {
            await device.writeCharacteristicWithoutResponseForService(serviceUUID, characteristicUUID, base64Message);
            console.log('Message written to characteristic');
        } else {
            console.log('Characteristic is not writable');
        }
    } else {
        console.log('Characteristic not found');
    }
}


const BleConnect = () => {
    const [connectedDevice, setConnectedDevice] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const bleManagerRef = useRef(null); // Using useRef for bleManager
    
    useEffect(() => {
        // Initialize bleManager once the component mounts
        bleManagerRef.current = new BleManager();

        const requestPermission = async () => {
            try {
                const permissions = ['android.permission.ACCESS_FINE_LOCATION'];

                if (Platform.OS === 'android' && Platform.Version >= 31) {
                    permissions.push('android.permission.BLUETOOTH_SCAN');
                    permissions.push('android.permission.BLUETOOTH_CONNECT');
                }

                const grantedResults = await PermissionsAndroid.requestMultiple(
                    permissions
                );

                const allPermissionsGranted = Object.values(grantedResults).every(
                    result => result === PermissionsAndroid.RESULTS.GRANTED
                );

                if (allPermissionsGranted) {
                    console.log('All permissions granted');
                } else {
                    console.log('Not all permissions granted');
                }
            } catch (err) {
                console.warn(err);
            }
        };

        requestPermission();

        const subscription = bleManagerRef.current.onStateChange((state) => {
            if (state === 'PoweredOn') {
                console.log('Bluetooth is enabled');
                // Start scanning for devices when Bluetooth is enabled
                scanForDevices();
            } else {
                console.log('Bluetooth is not enabled');
                // Stop scanning if Bluetooth is not enabled
                bleManagerRef.current.stopDeviceScan();
            }
        }, true);

        return () => {
            subscription.remove();
            // Destroy bleManager when the component unmounts
            if (bleManagerRef.current) {
                bleManagerRef.current.destroy();
            }
        };
    }, []);

    useEffect(() => {
        const checkConnection = async () => {
            if (connectedDevice && bleManagerRef.current) {
                try {
                    const isConnected = await bleManagerRef.current.isDeviceConnected(
                        connectedDevice.id
                    );
                    console.log('isDeviceConnected result:', isConnected);
                    setIsConnected(isConnected);
                } catch (err) {
                    console.error('Failed to check device connection:', err);
                }
            }
        };

        checkConnection();
    }, [connectedDevice]);

    const scanForDevices = () => {
        console.log('Scanning for devices...');
        bleManagerRef.current.startDeviceScan(null, null, async (error, device) => {
            if (error) {
                console.error('Error scanning devices:', error);
                return;
            }

            if (device.name === 'MIDI_Controller') {
                console.log('Found MIDI_Controller:', device.id);
                bleManagerRef.current.stopDeviceScan();
                try {
                    console.log('Attempting to connect to:', device.id);
                    const connectedDevice = await device.connect();
                    await connectedDevice.discoverAllServicesAndCharacteristics();
                    await sendMessage(connectedDevice, 'O3002001');
                    console.log(
                        'Connected to:',
                        connectedDevice.id,
                        connectedDevice.name
                    );
                    setConnectedDevice(connectedDevice);
                } catch (err) {
                    console.error('Failed to connect with device:', err);
                }
            }
        });
    };

    const disconnect = async () => {
        if (connectedDevice && bleManagerRef.current) {
            try {
                if (connectedDevice.isConnected()) { // Check if the device is connected
                    console.log('Disconnecting from device:', connectedDevice.id);
                    await connectedDevice.cancelConnection();
                    setIsConnected(false);
                    setConnectedDevice(null);
                    console.log('Device disconnected successfully.');
                } else {
                    console.log('Device is not connected.');
                }
            } catch (err) {
                console.error('Failed to disconnect device:', err);
            }
        } else {
            console.log('No device or bleManager available to disconnect');
        }
    };
    

    return (
        <View>
            <Button
                title={isConnected ? 'Disconnect' : 'Connect'}
                onPress={isConnected ? disconnect : scanForDevices}
            />
        </View>
    );
};

export default BleConnect;
