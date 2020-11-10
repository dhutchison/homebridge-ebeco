
<p align="center">

<img src="ebeco_homebridge.png" width="400">

</p>


# Homebridge Ebeco

## Introduction
In this plugin you will be able to add your <a href="https://www.ebeco.com" target="_blank">Ebeco</a> WiFi-ready EB-Therm 500 to HomeBridge and controling it through Siri and Home App.

## Installation

Assuming you have homebridge installed and set up, you can run below command to install this plugin

`npm install -g homebridge-ebeco`

Then, you can add the platform configuration to your config.json or you can configure it throguh the UI directly.

## Configuration

See `config-sample.json` for an example.

We will need to input your username and password for the Ebeco Connect app that you setup with the device.

```js
"platforms": [
    // This is the config for this plugin  
    {
      "platform": "Ebeco",
      "name": "Ebeco",
      "plugin_map": {
        "plugin_name": "homebridge-ebeco"
      },
      "username": "YOUR EBECO CONNECT USERNAME",
      "password": "YOUR EBECO CONNECT PASSWORD"
    }
    // End of the config
  ],
```

## Features Supported

* Heat On/Off and target tempeture

## Restrictions

* All the devices will be added if you have more than one, choosing which not to add will be added to if more people are asking for it.
* Making a schedule through the Ebeco Connect app will override the changes in the plugin. So setting up a degree here and having a schedule to change it to something else in the app later will override the plugin.

## Plugin Development

TODO: add in details of how this is developed & tested. Docker-compose file for mocking etc.

