import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, Service, Characteristic } from 'homebridge';

import { EbecoApi } from './lib/ebecoApi';

import { EbecoPlatformConfig, PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { EbecoPlatformAccessory } from './platformAccessory';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class EbecoHomebridgePlatform implements DynamicPlatformPlugin {

  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  /* API Client to share between accessories */
  private _apiClient: EbecoApi;

  constructor(
    public readonly log: Logger,
    public readonly config: EbecoPlatformConfig,
    public readonly api: API,
  ) {

    /* Setup the API client. This will validate the configuration values required
     * to call the API. 
     */
    this._apiClient = new EbecoApi(this.log, this.config);

    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');

      /* Perform an initial login */
      this._apiClient.login()
        .then(loginResponse => {
          this.log.debug('Login: %o', loginResponse);
          this.log.info('Logged in to Ebeco API. Token valid for %s seconds', loginResponse.expireInSeconds);

          // run the method to discover / register your devices as accessories
          this.discoverDevices();
          
        })
        .catch(err => {
          this.log.error('Login failed %s', err);
        });

    });
  }

  /**
   * Get the configured API client. 
   */
  public get apiClient(): EbecoApi {
    return this._apiClient;
  }
  

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {

    /* Load devices */
    this._apiClient.getUserDevices()
      .then(devices => {
        this.log.debug('Devices: %o', devices);
        this.log.info('Discovered %s devices', devices.length);

        /* loop over the discovered devices and register each one if it has not already been registered */
        for (const device of devices) {

          this.log.info('Device id %s has name %s', device.id, device.displayName);

          /* Generate a unique id for the accessory this should be generated from
           * something globally unique, but constant, for example, the device serial
           * number or MAC address
           */
          const uuid = this.api.hap.uuid.generate(device.id.toString());

          /* See if an accessory with the same uuid has already been registered and restored from
           * the cached devices we stored in the `configureAccessory` method above
           */
          const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

          if (existingAccessory) {
            /* the accessory already exists */
            if (device) {
              this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

              /* Update the accessory with the new initial state */
              existingAccessory.context.device = device;
              this.api.updatePlatformAccessories([existingAccessory]);

              // create the accessory handler for the restored accessory
              // this is imported from `platformAccessory.ts`
              new EbecoPlatformAccessory(this, existingAccessory);
          
              // update accessory cache with any changes to the accessory details and information
              this.api.updatePlatformAccessories([existingAccessory]);
            } else if (!device) {
              //TODO: Handle this correctly, wrong place
              // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
              // remove platform accessories when no longer present
              this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
              this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
            }
          } else {
            // the accessory does not yet exist, so we need to create it
            this.log.info('Adding new accessory:', device.displayName);

            // create a new accessory
            const accessory = new this.api.platformAccessory(device.displayName, uuid);

            // store a copy of the device object in the `accessory.context`
            // the `context` property can be used to store any data about the accessory you may need
            accessory.context.device = device;

            // create the accessory handler for the newly create accessory
            // this is imported from `platformAccessory.ts`
            new EbecoPlatformAccessory(this, accessory);

            // link the accessory to your platform
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          }
        }
      })
      .catch(err => {
        this.log.error('Devices error: %s', err);
      });
  }
}
