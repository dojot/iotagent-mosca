/* eslint-disable no-undef */
"use strict";

/**
 * Unit tests for iotagent app file
 *
 * This module has the following dependencies:
 *
 * - express
*/

const App = require("../../src/app");
const moscaMestrics = require("../../src/metrics");
const HealthChecker = require("../../src/healthcheck").AgentHealthChecker;

//
// Mocking dependencies
//
// jest.mock("express");
//

describe("Testing app functions", () => {
    // store the original implementation
    const originalStop = App.closeApp;
    const originalInit = App.initApp;

    // mock add with the original implementation
    App.stopApp = jest.fn(originalStop);
    App.initApp = jest.fn(originalInit);

    beforeEach(() => jest.resetModules());

    afterEach(() => {
        App.stopApp();
    });

    afterAll(() => {
        App.stopApp();
    });

    it("Test initApp", async () => {
        // App.initApp = jest.fn(App.initApp);
        const metricStore = new moscaMestrics.Metrics();
        const healthcheck = new HealthChecker();

        App.initApp(healthcheck, metricStore);
        await expect(App.initApp).toBeCalled();
        await expect(originalInit).toBeDefined();
        await expect(App.initApp).toBeTruthy();

        // spy the calls to add
        await expect(App.stopApp()).toBeFalsy();
    });
});
