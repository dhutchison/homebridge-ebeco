import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback } from 'homebridge';

import { EbecoHomebridgePlatform } from './platform';
import { Device, DeviceUpdateRequest } from './lib/ebecoApi';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class EbecoPlatformAccessory {

  private service: Service;

  constructor(
    private readonly platform: EbecoHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Ebeco')
      .setCharacteristic(this.platform.Characteristic.Model, 'EB-Therm 500')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.id);

    /* Get the service if it exists, otherwise create a new service */
    this.service = this.accessory.getService(this.platform.Service.Thermostat) || 
      this.accessory.addService(this.platform.Service.Thermostat);

    /* Set the service name, this is what is displayed as the default name on the Home app */
    this.service.setCharacteristic(this.platform.Characteristic.Name, 
      accessory.context.device.displayName);

    /* Configure the valid values we have for TargetHeatingCoolingState */
    let validTargetValues: number[];
    if (this.platform.config.includeOffOption === undefined || this.platform.config.includeOffOption) {
      validTargetValues = [
        this.platform.Characteristic.TargetHeatingCoolingState.HEAT,
        this.platform.Characteristic.TargetHeatingCoolingState.OFF,
      ];
    } else {
      validTargetValues = [
        this.platform.Characteristic.TargetHeatingCoolingState.HEAT,
      ];
    }

    /* Set the "required characteristics" based on the initial device state we got. 
     *
     * Also configure 'set' methods for characteristics we want to control. Not setting up
     * any 'get' methods, we will periodically poll the ebeco API instead of doing it 
     * on-demand.  
     * 
     * See https://developers.homebridge.io/#/service/Thermostat
     * */

    this.service.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
      .updateValue(this.getCurrentHeatingCoolingStateForDevice(accessory.context.device));
    
    this.service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .setProps({
        validValues: validTargetValues,
      })
      .updateValue(this.getTargetHeatingCoolingStateForDevice(accessory.context.device))
      .on('set', this.setTargetHeatingCoolingState.bind(this));
    
    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .updateValue(this.getCurrentTemperatureForDevice(accessory.context.device));
    
    this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .updateValue(accessory.context.device.temperatureSet)
      .on('set', this.setTargetTemperature.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
      .updateValue(this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS);
    

    /* Update the state of the plugin periodically, instead of on-demand. 
     * Poll frquency is in milliseconds.
     */
    const pollDuration = this.platform.config.pollFrequency || 10000;
    this.platform.log.info('Polling for device status updates every %s ms', pollDuration);
    setInterval(() => {

      this.platform.log.debug('Getting updated device state on timer');

      this.getUpdatedDeviceState()
        .then(device => {
          this.service.updateCharacteristic(
            this.platform.Characteristic.CurrentHeatingCoolingState, 
            this.getCurrentHeatingCoolingStateForDevice(device));

          this.service.updateCharacteristic(
            this.platform.Characteristic.TargetHeatingCoolingState, 
            this.getTargetHeatingCoolingStateForDevice(device));
      
          this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, 
            this.getCurrentTemperatureForDevice(device));

          this.service.updateCharacteristic(this.platform.Characteristic.TargetTemperature, 
            device.temperatureSet);
      
        })
        .catch(err => {
          this.platform.log.error('Failed to load updated device state: %s', err);
        });

      
    }, pollDuration);
  }


  private getCurrentTemperatureForDevice(device: Device): number {
    return device.temperatureRoom;
  }

  private getCurrentHeatingCoolingStateForDevice(device: Device) {
    return device.powerOn ? 
      this.platform.Characteristic.CurrentHeatingCoolingState.HEAT : 
      this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
  }

  private getTargetHeatingCoolingStateForDevice(device: Device) {
    return device.powerOn ? 
      this.platform.Characteristic.TargetHeatingCoolingState.HEAT : 
      this.platform.Characteristic.TargetHeatingCoolingState.OFF;
  }

  /**
   * Get the updated state for this device. 
   * 
   * TODO: Change to use the individual device API. 
   */
  private getUpdatedDeviceState(): Promise<Device> {

    return new Promise<Device>((resolve, reject) => {
      this.platform.apiClient.getUserDevices()
        .then(devices => {
          const foundDevice = devices.find(value => value.id === this.accessory.context.device.id);

          if(foundDevice) {
            this.accessory.context.lastState = foundDevice;

            this.platform.log.debug('Updated device state %o', foundDevice);

            resolve(foundDevice);
          } else {
            this.platform.log.warn('Could not find device for id: %s', this.accessory.context.device.id);
            reject('Could not find device for id: ' + this.accessory.context.device.id);
          }
        }).catch(err => {
          this.platform.log.error('Failed to load updated device state: %o', err);
          reject(err);
        });
    });

  }

  /**
   * Set the target termperature for the themostat. 
   * @param value the new value
   * @param callback the homebridge callback to invoke after the request has been sent to the device. 
   */
  private setTargetTemperature(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    const newTemp = value as number;

    const updatedDeviceState: DeviceUpdateRequest = {
      id: this.accessory.context.device.id,
      powerOn: true,
      temperatureSet: newTemp,
    };

    this.platform.log.debug('setTargetTemperature -> %o', updatedDeviceState);

    this.platform.apiClient.updateDeviceState(updatedDeviceState)
      .then(success => {
        if (success) {
          /* API reported a successful update */
          callback(null, value);
        } else {
          /* API reported the state was not updated, fail */
          callback(new Error('Update to device state was not successful'));
        }
      })
      .catch(err => callback(err));
  }

  /**
   * Set the target power state for the themostat. 
   * @param value the new value
   * @param callback the homebridge callback to invoke after the request has been sent to the device. 
   */
  private setTargetHeatingCoolingState(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    if (this.isOffOptionAllowed()) {
      /* We allow an off option, can call the API if the value has changed */
      const newPowerOnState: boolean = (value as number) === this.platform.Characteristic.TargetHeatingCoolingState.HEAT;

      if (newPowerOnState !== this.accessory.context.lastState.powerOn) {
        /* State has changed, call the API to perform an update */
        const updatedDeviceState: DeviceUpdateRequest = {
          id: this.accessory.context.device.id,
          powerOn: newPowerOnState,
          temperatureSet: this.accessory.context.lastState.temperatureSet,
        };
    
        this.platform.log.debug('setTargetHeatingCoolingState -> %o', updatedDeviceState);
    
        this.platform.apiClient.updateDeviceState(updatedDeviceState)
          .then(success => {
            if (success) {
              /* API reported a successful update */
              callback(null, value);
            } else {
              /* API reported the state was not updated, fail */
              callback(new Error('Update to device state was not successful'));
            }
          })
          .catch(err => callback(err));

      } else {
        /* Already at the right state, just call the callback */
        callback(null, value);
      }


    } else {
      /* We can only have a heat option, just call the callback */
      callback(null, this.platform.Characteristic.TargetHeaterCoolerState.HEAT);
    }

  }

  /**
   * Helper method to determine if we are allowed to have an "off" value for TargetHeaterCoolerState.
   * 
   * @returns true if "off" is allowed, otherwise false. 
   */
  private isOffOptionAllowed(): boolean {
    return (this.platform.config.includeOffOption === undefined || this.platform.config.includeOffOption);
  }

}
