
<p align="center">

<img src="ebeco_homebridge.png" width="400">

</p>


# Homebridge Ebeco

## Introduction
In this plugin you will be able to add your Ebeco WiFi-ready EB-Therm 500 to HomeBridge and controling it through Siri and Home App.

## Installation

Assuming you have homebridge installed and set up, you can run below command to install this plugin

`npm install -g homebridge-ebeco`

Then, you can add the platform configuration to your config.json or you can configure it throguh the UI directly.

## Configuration

See config-sample.json for example

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
      "name": "Ebeco",
      "username": "YOUR EBECO CONNECT USERNAME",
      "password": "YOUR EBECO CONNECT PASSWORD"
      }
    }
    // End of the config
  ],
```

## Features Supported

* Heat On/Off and target tempeture (If your device supports this)

