/* eslint-disable no-console */
import { EbecoPlatformConfig, PLATFORM_NAME } from '../src/settings';
import { EbecoApi, LoginRequest, LoginResponse, MvcAjaxResponse } from '../src/lib/ebecoApi';
import { Logger } from 'homebridge';

import axios from 'axios';

/* Setup a mock for axios, we don't want to do any real API calls in the test suite.
 * Need the mockedAxios constant to allow us to have types correct in this test file
 */
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

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
    expect(mockedAxios.defaults.baseURL).toBe(validConfig.apiHost);

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
    mockedAxios.post.mockImplementationOnce(() => Promise.resolve({
      data: successfulResponseWrapper,
    }));


    /* Setup the API client */
    const apiClient = new EbecoApi(logger, validConfig);
    expect(apiClient).toBeDefined();

    /* Call the login, and do some tests */
    await expect(apiClient.login()).resolves.toBe(successfulResponse);
    expect(mockedAxios.post).toHaveBeenCalledWith(
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
    mockedAxios.post.mockImplementationOnce(() => Promise.resolve({
      data: failedResponseWrapper,
    }));
    
    /* Call the login, and do some tests */
    const apiClient = new EbecoApi(logger, validConfig);
    await expect(apiClient.login()).rejects.toBe('Account requires two factor authentication');
  });

});