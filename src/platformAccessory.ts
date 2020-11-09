import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback } from 'homebridge';

import { EbecoHomebridgePlatform } from './platform';
import { Device, DeviceUpdateRequest, EbecoApi } from './lib/ebecoApi';

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
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'accessory.context.device.id');

    /* Get the service if it exists, otherwise create a new service */
    this.service = this.accessory.getService(this.platform.Service.Thermostat) || 
      this.accessory.addService(this.platform.Service.Thermostat);

    /* Set the service name, this is what is displayed as the default name on the Home app */
    this.service.setCharacteristic(this.platform.Characteristic.Name, 
      accessory.context.device.displayName);

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
      .updateValue(this.getTargetHeatingCoolingStateForDevice(accessory.context.device));
    
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
      
          this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.getCurrentTemperatureForDevice(device));

          this.service.updateCharacteristic(this.platform.Characteristic.TargetTemperature, device.temperatureSet);
      
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

    const apiClient = new EbecoApi(this.platform, this.platform.log, this.platform.config);

    return new Promise<Device>((resolve, reject) => {
      apiClient.getUserDevices()
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

    const apiClient = new EbecoApi(this.platform, this.platform.log, this.platform.config);
    apiClient.updateDeviceState(updatedDeviceState)
      .then(success => callback(null, success))
      .catch(err => callback(err));
  }

}
