/* eslint-disable no-console */
import { EbecoPlatformConfig, PLATFORM_NAME } from '../src/settings';
import { Device, EbecoApi, LoginRequest, LoginResponse, MvcAjaxResponse } from '../src/lib/ebecoApi';
import { Logger } from 'homebridge';

import axios from 'axios';

/* Setup a mock for axios, we don't want to do any real API calls in the test suite.
 * Need the mockedAxios constant to allow us to have types correct in this test file
 */
// jest.mock('axios');
// const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedAxiosGet = axios.get = jest.fn();
const mockedAxiosPost = axios.post = jest.fn();


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
    mockedAxiosPost.mockImplementationOnce(() => Promise.resolve({
      data: successfulResponseWrapper,
    }));


    /* Setup the API client */
    const apiClient = new EbecoApi(logger, validConfig);
    expect(apiClient).toBeDefined();

    /* Call the login, and do some tests */
    await expect(apiClient.login()).resolves.toBe(successfulResponse);
    expect(mockedAxiosPost).toHaveBeenCalledWith(
      '/api/TokenAuth/Authenticate',
      expectedRequest,
    );

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
    mockedAxiosPost.mockImplementationOnce(() => Promise.resolve({
      data: failedResponseWrapper,
    }));
    
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

    mockedAxiosGet.mockImplementationOnce(() => Promise.resolve({
      data: successfulResponseWrapper,
    }));
    
    /* Call the get user device api, and do some tests */
    const apiClient = new EbecoApi(logger, validConfig);
    validConfig.accessToken = '24f76650-2ec6-44a7-a0bd-c0a846bc6c41';
    await expect(apiClient.getUserDevices()).resolves.toBe(expectedResponse);
    expect(mockedAxiosGet).toHaveBeenCalledWith(
      '/api/services/app/Devices/GetUserDevices',
      {
        headers: {
          Authorization: 'Bearer 24f76650-2ec6-44a7-a0bd-c0a846bc6c41',
        },
      },
    );

  });

  it('Test listing devices, with a re-authentication', async() => {
    
    console.log(axios.interceptors.response);
    
    /* Configure the GET mock and responses, 
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

    mockedAxiosGet
      /* First mock will return a 401 */
      .mockImplementationOnce(() => Promise.reject({
        status: 401,
      }))
      /* Then the next one will return data */
      .mockImplementationOnce(() => Promise.resolve({
        data: expectedDeviceResponseWrapper,
      }));

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
    mockedAxiosPost.mockImplementationOnce(() => Promise.resolve({
      data: expectedLoginResponseWrapper,
    }));
      

    /* Call the get user device api, and do some tests */
    const apiClient = new EbecoApi(logger, validConfig);
    await expect(apiClient.getUserDevices()).resolves.toBe(expectedDeviceResponse);
    expect(mockedAxiosGet).toHaveBeenCalledWith(
      '/api/services/app/Devices/GetUserDevices',
      {
        headers: {
          Authorization: 'Bearer cbffd7f1-7bd9-4ca9-9997-348dcb076576',
        },
      },
    );

    expect(mockedAxiosGet).toHaveBeenCalledTimes(2);
    expect(mockedAxiosPost).toHaveBeenCalledTimes(1);



  });

});