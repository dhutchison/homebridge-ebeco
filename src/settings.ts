import { PlatformConfig } from 'homebridge';

/**
 * This is the name of the platform that users will use to register the plugin in the Homebridge config.json
 */
export const PLATFORM_NAME = 'Ebeco';

/**
 * This must match the name of your plugin as defined the package.json
 */
export const PLUGIN_NAME = 'homebridge-ebeco';

/**
 * Enum defining the temperature sensors we can use
 */
export enum TemperatureSensor {
    FLOOR,
    ROOM
}


/**
 * Interface which defines the fields that can be expected in our Platform Config. 
 */
export interface EbecoPlatformConfig extends PlatformConfig {

    /**
     * User's username for the Ebeco platform
     */
    username?: string;

    /**
     * User's password for the Ebeco platform
     */
    password?: string;

    /**
     * Boolean indicating if there should be an "off" option. If this is set
     * to false, only temperature can be controlled.
     */
    includeOffOption?: boolean;

    /**
     * Frequency of API poll requests (in milliseconds)
     */
    pollFrequency?: number;

    /**
     * Optional configuration value for the API host. 
     * 
     * This may be changed for development purposes. 
     */
    apiHost?: string;

    /**
     * Access token. This will not be directly configured by an end user, 
     * but will be updated by the plugin as a result of an authentication request. 
     */
    accessToken?: string;

    /**
     * The temperature sensor to use.
     * 
     * This is optional as older versions of the plugin did not
     * have this setting. If it is not configured a default will 
     * be set on startup. 
     */
    temperatureSensor?: TemperatureSensor;
}