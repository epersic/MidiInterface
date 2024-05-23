
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Slider from '@react-native-community/slider';
import React, { useEffect, useState, useRef } from 'react';
import {  Button, Alert, PermissionsAndroid, Platform } from 'react-native';
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
          console.log('Message written to characteristic: '+message);
      } else { 
          console.log('Characteristic is not writable');
      }
  } else {
      console.log('Characteristic not found');
  }
}

const SliderWithScale = React.memo(({ value, onSlidingComplete, minimumValue, maximumValue, step }) => {
    const scale = [];
    for (let i = minimumValue; i <= maximumValue; i += step) {
      scale.push(i);
    }
  
    return (
      <View>
        <Slider value={value} onSlidingComplete={onSlidingComplete} minimumValue={minimumValue} maximumValue={maximumValue} step={step} />
        <View style={styles.scaleContainer}>
          {scale.map((val, index) => (
            <Text key={index} style={styles.scaleText}>{val}</Text>
          ))}
        </View>
      </View>
    );
  });

const MidiController = () => {
    const [notes, setNotes] = useState(Array(16).fill(false));
    const [pitchBend, setPitchBend] = useState(0);
    const [channel, setChannel] = useState(0);
    const [aftertouch, setAftertouch] = useState(0);
    const [programChange, setProgramChange] = useState(0);
    const [velocity, setVelocity] = useState(0);
    const [MidiChannel, setMidiChannel] = useState(0);
    const [channelValue, setChannelValue] = useState(0);
    const [connectedDevice, setConnectedDevice] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const bleManagerRef = useRef(null); 
    const [buttonPressCount, setButtonPressCount] = useState(0);

    const handleButtonPress = () => {
      if (buttonPressCount < 9) {
        setButtonPressCount(buttonPressCount + 1);
      }else{
        setButtonPressCount(0);
      }
    };

    useEffect(() => {
      
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

    const handleMidiMessage = (index) => {
      let midiMess = "";
      const newNotes = [...notes];
      newNotes[index] = !newNotes[index];
      setNotes(newNotes);
      
      midiMess = newNotes[index] ? 'O' : 'F';
      midiMess += MidiChannel.toString().padStart(2, '0')+(index+ buttonPressCount * 12).toString().padStart(3,'0')+Math.floor(velocity*100).toString().padStart(3,'0');
      sendMessage(connectedDevice,midiMess);
    };



    const handleValueChange = (newValue, sliderName) => {

      let midiMess = "";
      if(sliderName === 'Velocity') {
        setVelocity(newValue);
        return;
      }

      
      if(sliderName === 'MIDI Channel') {
        setMidiChannel(newValue);
      }
      else if (sliderName === 'Pitch Bend') {
        setPitchBend(newValue); 
      } else if (sliderName === 'Channel') {

        setChannel(newValue);
      } else if (sliderName === 'Aftertouch') {
        setAftertouch(newValue);
        midiMess = 'H' +MidiChannel.toString().padStart(2,'0')+ Math.floor(newValue*100).toString().padStart(3, '0');
        sendMessage(connectedDevice,midiMess);
      } else if (sliderName === 'Program Change') {
        setProgramChange(newValue);
        midiMess = 'R'+MidiChannel.toString().padStart(2, '0')+newValue.toString().padStart(3, '0');
        sendMessage(connectedDevice,midiMess);
      }else if (sliderName == 'ChannelValue') {
        setChannelValue(newValue);
        midiMess = 'C'+MidiChannel.toString().padStart(2, '0')+channel.toString().padStart(3, '0')+Math.floor(newValue*100).toString().padStart(3, '0');
        sendMessage(connectedDevice,midiMess);
      }
    };
   
  
    return (
      <View style={styles.container} >
        <Button
                title={isConnected ? 'Disconnect' : 'Connect'}
                onPress={isConnected ? disconnect : scanForDevices}
                style={{width: '100%'}}
            />
        {isConnected ? (<ScrollView>
        
        <Text style={styles.title}>MIDI Controller</Text>
        <View style={styles.buttonContainer}>
          {notes.map((note, index) => (
            <TouchableOpacity 
              key={index} 
              style={[styles.button, note ? styles.buttonOn : styles.buttonOff]} 
              onPress={() => handleMidiMessage(index)}
            >
              <Text style={styles.buttonText}>{index + 1 + buttonPressCount * 12}</Text>
            </TouchableOpacity>
          ))}
        </View>
          
          <View style={styles.sliderContainer}>
          <Text>Pitch Bend</Text>
          <Slider value={pitchBend} onSlidingComplete={(value) => handleValueChange(value, 'Pitch Bend')} />
          <Text>Channel Control</Text>
          <SliderWithScale 
            value={channel} 
            onSlidingComplete={(value) => handleValueChange(value, 'Channel')} 
            minimumValue={0 + buttonPressCount * 12} 
            maximumValue={12 + buttonPressCount * 12} 
            step={1} 
          />
          <Slider value={channelValue} onSlidingComplete={(value) => handleValueChange(value, 'ChannelValue')} />
          <Text>Aftertouch</Text>
          <Slider value={aftertouch} onSlidingComplete={(value) => handleValueChange(value, 'Aftertouch')} />
          <Text>Program Change</Text>
          <SliderWithScale value={programChange} onSlidingComplete={(value) => handleValueChange(value, 'Program Change')} minimumValue={0+ buttonPressCount * 12} maximumValue={9+ buttonPressCount * 12} step={1} />
          <Text>Velocity</Text>
          <Slider value={velocity} onValueChange={(value) => handleValueChange(value, 'Velocity')} />
          <Text>MIDI Channel</Text>
          <SliderWithScale value={MidiChannel} onSlidingComplete={(value) => handleValueChange(value, 'MIDI Channel')} minimumValue={0+ buttonPressCount * 12} maximumValue={12+ buttonPressCount * 12} step={1} />
        </View>
          <Button
        title="Increase Values"
        onPress={handleButtonPress}
        style={{width: '100%'}}
      />
        </ScrollView>) : null}
      </View>
    );
};

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#333',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column', // Add this line
    },
    buttonContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      marginBottom: 50,
      backgroundColor: '#555',
      borderRadius: 3,
    },
    button: {
      width: 50,
      height: 50,
      margin: 5,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#777'
    },
    buttonOn: {
      backgroundColor: '#999',
  
    },
    buttonOff: {
      backgroundColor: '#6b6e6c',
    },
    buttonText: {
      color: '#fff',
    },
    sliderContainer: {
      width: '80%',
      backgroundColor : '#555',
      alignSelf: 'center',
      borderRadius: 3,
    },
    scaleContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 18, 
      paddingLeft: '2%', 
      paddingRight: '2%',
      marginLeft: 2,
      marginRight: 2,
    },
  
    scaleText: {
      fontSize: 10, 
    },
    title: {
      fontSize: 34,
      fontWeight: 'bold',
      color: '#fff',
      marginBottom: 50, 
      alignSelf: 'center', 
  
    },
  });
  
export default MidiController;
