/* eslint-disable no-console */
import { EbecoPlatformConfig, PLATFORM_NAME } from '../src/settings';
import { Device, EbecoApi, LoginRequest, LoginResponse, MvcAjaxResponse } from '../src/lib/ebecoApi';
import { Logger } from 'homebridge';

import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

describe('EbecoApi construction & validation', () => {

  /* Configure a mock logger that we need to supply */
  const logger: Logger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  };

  /* Configure a valid config, this will be used in multiple tests */
  const validConfig: EbecoPlatformConfig = {
    platform: PLATFORM_NAME,
    username: 'hello',
    password: 'world',
  };

  /* URLs we expect to be called for various operations */
  const authUrl = '/api/TokenAuth/Authenticate';
  const listDevicesUrl = '/api/services/app/Devices/GetUserDevices';

  /**
   * The base headers expected to be sent with all GET requests. 
   * This excludes Authorization which needs added seperately. 
   */
  const expectedGetHeaders = {
    'Abp.TenantId': '1',
    'Content-Type': 'application/json',
  };

  /**
   * Headers we expect to be sent when an authentication request is made
   */
  const expectedLoginHeaders = {
    'Abp.TenantId': '1',
    'Content-Type': 'application/json;charset=utf-8',
  };
  

  /* Validation message we expect when authentication details are not provided */
  const invalidConfigMessage = 'Not all required configuration values found. Need "username" and "password".';

  it('Validates that a missing username results in an error', () => {
    const configWithoutUsername: EbecoPlatformConfig = {
      platform: PLATFORM_NAME,
      password: 'world',
    };

    expect(() => new EbecoApi(logger, configWithoutUsername))
      .toThrow(invalidConfigMessage);
  });

  it('Validates that a missing password results in an error', () => {
    const configWithoutPassword: EbecoPlatformConfig = {
      platform: PLATFORM_NAME,
      username: 'hello',
    };

    expect(() => new EbecoApi(logger, configWithoutPassword))
      .toThrow(invalidConfigMessage);
  });

  it('Validates that with a username & password in the configuration it creates', () => {

    const apiClient = new EbecoApi(logger, validConfig);
    expect(apiClient).toBeDefined();

    /* Check the default API host was added */
    expect(validConfig.apiHost).toBe('https://ebecoconnect.com');
    expect(axios.defaults.baseURL).toBe(validConfig.apiHost);

  });

  it('Test successful login call', async() => {


    /* Define the request & response we expect, and configure the mock */
    const expectedRequest: LoginRequest = {
      userNameOrEmailAddress: 'hello',
      password: 'world',
    };
    const successfulResponse: LoginResponse = {
      accessToken: 'cbffd7f1-7bd9-4ca9-9997-348dcb076575',
      expireInSeconds: 84600,
      requiresTwoFactorVerification: false,
    };
    const successfulResponseWrapper: MvcAjaxResponse<LoginResponse> = {
      result: successfulResponse,
      success: true,
      unAuthorizedRequest: false,
    };

    const mockAdapter = new MockAdapter(axios);
    mockAdapter
      .onPost(authUrl, expectedRequest, expectedLoginHeaders)
      .reply(200, successfulResponseWrapper)
      /* Configuring an "any" response to add debug logging */
      .onAny()
      .reply(config => {
        console.log('Test successful login call: Mock request config was: %o', config);
        return [404, {}];
      });


    /* Setup the API client */
    const apiClient = new EbecoApi(logger, validConfig);
    expect(apiClient).toBeDefined();

    /* Call the login, and do some tests */
    await expect(apiClient.login()).resolves.toMatchObject(successfulResponse);

  });

  it('Test 2FA authentication failure', async() => {
    const failedResponse: LoginResponse = {
      accessToken: 'cbffd7f1-7bd9-4ca9-9997-348dcb076575',
      expireInSeconds: 84600,
      requiresTwoFactorVerification: true,
    };
    const failedResponseWrapper: MvcAjaxResponse<LoginResponse> = {
      result: failedResponse,
      success: true,
      unAuthorizedRequest: false,
    };

    const mockAdapter = new MockAdapter(axios);
    mockAdapter
      .onPost(authUrl)
      .reply(200, failedResponseWrapper);
    
    /* Call the login, and do some tests */
    const apiClient = new EbecoApi(logger, validConfig);
    await expect(apiClient.login()).rejects.toBe('Account requires two factor authentication');
  });

  it('Test listing devices successfully', async() => {

    const expectedResponse: Device[] = [
      {
        displayName: 'Test Device',
        powerOn: true,
        temperatureSet: 20,
        temperatureFloor: 21,
        temperatureRoom: 22,
        hasError: false,
        id: 1,
      },
    ];

    const successfulResponseWrapper: MvcAjaxResponse<Device[]> = {
      result: expectedResponse,
      success: true,
      unAuthorizedRequest: false,
    };

    console.log('Sending headers %o', {
      ...expectedGetHeaders,
      Authorization: 'Bearer 24f76650-2ec6-44a7-a0bd-c0a846bc6c41',
    });

    const mockAdapter = new MockAdapter(axios);
    mockAdapter
      .onGet(listDevicesUrl, undefined, {
        ...expectedGetHeaders,
        Authorization: 'Bearer 24f76650-2ec6-44a7-a0bd-c0a846bc6c41',
      })
      .reply(200, successfulResponseWrapper)
      /* Configuring an "any" response to add debug logging */
      .onAny()
      .reply(config => {
        console.log('Test listing devices successfully: Mock request config was: %o', config);
        return [404, {}];
      });
    
    /* Call the get user device api, and do some tests */
    const apiClient = new EbecoApi(logger, validConfig);
    validConfig.accessToken = '24f76650-2ec6-44a7-a0bd-c0a846bc6c41';
    await expect(apiClient.getUserDevices()).resolves.toMatchObject(expectedResponse);

  });

  it('Test listing devices, with a re-authentication', async() => {
    
    /* Configure the GET mock responses, 
     * which will be called when we try to load the device list 
     */
    const expectedDeviceResponse: Device[] = [
      {
        displayName: 'Test Device',
        powerOn: true,
        temperatureSet: 20,
        temperatureFloor: 21,
        temperatureRoom: 22,
        hasError: false,
        id: 1,
      },
    ];

    const expectedDeviceResponseWrapper: MvcAjaxResponse<Device[]> = {
      result: expectedDeviceResponse,
      success: true,
      unAuthorizedRequest: false,
    };

    /* Define the request & response we expect for a login POST, and configure the mock */
    const expectedLoginRequest: LoginRequest = {
      userNameOrEmailAddress: 'hello',
      password: 'world',
    };
    const expectedLoginResponse: LoginResponse = {
      accessToken: 'cbffd7f1-7bd9-4ca9-9997-348dcb076576',
      expireInSeconds: 84600,
      requiresTwoFactorVerification: false,
    };
    const expectedLoginResponseWrapper: MvcAjaxResponse<LoginResponse> = {
      result: expectedLoginResponse,
      success: true,
      unAuthorizedRequest: false,
    };

    /* Configure the mock adapter for all these requests */
    const mockAdapter = new MockAdapter(axios);
    mockAdapter
      /* First mock will return a 401 */
      .onGet(listDevicesUrl, {}, {
        ...expectedGetHeaders,
        Authorization: 'Bearer 24f76650-2ec6-44a7-a0bd-c0a846bc6c41',
      })
      .replyOnce(401, {})
      /* Then the next one will return data */
      .onGet(listDevicesUrl, {}, {
        ...expectedGetHeaders,
        Authorization: 'Bearer cbffd7f1-7bd9-4ca9-9997-348dcb076576',
      })
      .replyOnce(200, expectedDeviceResponseWrapper)
      /* Configure authentication request mock */
      .onPost(authUrl, expectedLoginRequest, expectedLoginHeaders)
      .reply(200, expectedLoginResponseWrapper)
      /* Configuring an "any" response to add debug logging */
      .onAny()
      .reply(config => {
        console.log('Test listing devices, with a re-authentication: Mock request config was: %o', config);
        return [404, {}];
      });

    /* Call the get user device api, and do some tests */
    validConfig.accessToken = '24f76650-2ec6-44a7-a0bd-c0a846bc6c41';
    const apiClient = new EbecoApi(logger, validConfig);
    await expect(apiClient.getUserDevices()).resolves.toMatchObject(expectedDeviceResponse);
    expect(validConfig.accessToken).toBe('cbffd7f1-7bd9-4ca9-9997-348dcb076576');
  });

});