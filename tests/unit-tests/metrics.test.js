/* eslint-disable no-undef */
"use strict";

/**
 * Unit tests for iotagent module
 *
 * This module has the following dependencies:
 *
 * - supertest
 */

const express = require("express");
const stopApp = require("../../src/app").stopApp;
const moscaMestrics = require("../../src/metrics");
const MetricModel = require('../../src/model/Metric')

const request = require("supertest");

const app = express();

//
// Mocking dependencies
//

// a helper function to make a POST request
function get(url, body) {
    const httpRequest = request(app).get(url);
    httpRequest.send(body);
    httpRequest.set('Accept', 'application/json');
    return httpRequest;
}

describe("Testing metrics functions", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.resetModules()
    });

    afterEach(() => {
        stopApp();
        jest.clearAllTimers()
    });

    it('Should return 401 status because no token was provided', async () => {

        let metricStore = new moscaMestrics.Metrics();
        app.use(moscaMestrics.getHTTPRouter(metricStore));
        let response = await get('/iotagent-mqtt/metrics', '');

        expect(response.status).toEqual(401);
    });

    it("Should not changes metrics because function expects an object as argument", () => {

        const metricsArray = [];
        const metricsWithAnonymous = new MetricModel();
        metricsWithAnonymous.tenant = 'anonymous';
        metricsArray.push(metricsWithAnonymous);

        const metrics = new moscaMestrics.Metrics();
        metrics.preparePayloadObject()
        expect(metrics.metrics).toEqual(metricsArray);

        metrics.preparePayloadObject(0);
        expect(metrics.metrics).toEqual(metricsArray);

        metrics.preparePayloadObject({ subject: 'test-subject'});
        expect(metrics.metrics).toEqual(metricsArray);

        metrics.preparePayloadObject({ connectedClients: -1});
        expect(metrics.metrics).toEqual(metricsArray);
    });

    it("Should modify the connectCLient Metric for anonymous tenant", () => {

        const metrics = new moscaMestrics.Metrics();
        metrics.preparePayloadObject({ subject: 'anonymous', connectedClients: 1 });
        expect(metrics.metrics[0].connectedClients).toEqual(1);

        metrics.preparePayloadObject({ subject: 'inexistent-tenant', connectedClients: 1 });
        expect(metrics.metrics[0].connectedClients).toEqual(2);
    });

    it("Should not prepare new Metric object for Tenant because of method expect a string parameter", () => {
        const metrics = new moscaMestrics.Metrics();
        metrics.prepareNewTenantForMetric();

        // only anonymous
        expect(metrics.metrics).toHaveLength(1);
        expect(Object.keys(metrics.metricsCallbacks)).toHaveLength(1);
    });

    it("Should not prepare new Metric object for Tenant because tenant already exist", () => {
        const metrics = new moscaMestrics.Metrics();
        metrics.prepareNewTenantForMetric('anonymous');

        expect(metrics.metrics).toHaveLength(1);
        expect(Object.keys(metrics.metricsCallbacks)).toHaveLength(1);
    });

    it("Should prepare new Metric object for Tenant", () => {
        const metrics = new moscaMestrics.Metrics();
        metrics.prepareNewTenantForMetric('test-tenant');

        expect(metrics.metrics).toHaveLength(2);
        expect(Object.keys(metrics.metricsCallbacks)).toHaveLength(2);
    });

    it("Should not delete Metric object for Tenant because function expect an argument", () => {
        const metrics = new moscaMestrics.Metrics();
        metrics.prepareDeletedTenantForMetric();

        // only anonymous
        expect(metrics.metrics).toHaveLength(1);
        expect(Object.keys(metrics.metricsCallbacks)).toHaveLength(1);
    });

    it("Should not delete Metric object for Tenant because metric was not registered", () => {
        const metrics = new moscaMestrics.Metrics();
        metrics.prepareDeletedTenantForMetric('inexistent-tenant');

        expect(metrics.metrics).toHaveLength(1);
        expect(Object.keys(metrics.metricsCallbacks)).toHaveLength(1);
    });

    it("Should delete Metric object for Tenant", () => {
        const metrics = new moscaMestrics.Metrics();
        metrics.prepareDeletedTenantForMetric('anonymous');

        expect(metrics.metrics).toHaveLength(0);
        expect(Object.keys(metrics.metricsCallbacks)).toHaveLength(0);
    });

    it("Should not count valid or invalid message", () => {
        const metrics = new moscaMestrics.Metrics();
        metrics.prepareValidInvalidMessageMetric();

        metrics.metrics.forEach(metric => {
            expect(metric.validMessages).toEqual(0);
            expect(metric.inValidMessages).toEqual(0);
        });
    });

    it("Should count invalid message for anonimous message", () => {
        const metrics = new moscaMestrics.Metrics();
        metrics.prepareValidInvalidMessageMetric({subject: 'test-subject'});

        metrics.metrics.forEach(metric => {

            if (metric.tenant == 'anonymous') {
                expect(metric.validMessages).toEqual(0);
                expect(metric.inValidMessages).toEqual(1);
            } else {
                expect(metric.validMessages).toEqual(0);
                expect(metric.inValidMessages).toEqual(0)
            }
        });
    });

    it("Should count invalid message for anonymous message", () => {
        const metrics = new moscaMestrics.Metrics();
        metrics.prepareValidInvalidMessageMetric({subject: 'anonymous', count: -1 });

        metrics.metrics.forEach(metric => {

            if (metric.tenant == 'anonymous') {
                expect(metric.validMessages).toEqual(0);
                expect(metric.inValidMessages).toEqual(1);
            } else {
                expect(metric.validMessages).toEqual(0);
                expect(metric.inValidMessages).toEqual(0)
            }
        });
    });

    it("Should count valid message for anonymous message", () => {
        const metrics = new moscaMestrics.Metrics();
        metrics.prepareValidInvalidMessageMetric({subject: 'anonymous', count: 1 });

        metrics.metrics.forEach(metric => {

            if (metric.tenant == 'anonymous') {
                expect(metric.validMessages).toEqual(1);
                expect(metric.inValidMessages).toEqual(0);
            } else {
                expect(metric.validMessages).toEqual(0);
                expect(metric.inValidMessages).toEqual(0)
            }
        });
    });

    it("Should test compute connectionsLoad1min movingAverage function", () => {
        const metrics = new moscaMestrics.Metrics();
        const moveAverageSpy = jest.spyOn(metrics.metricsCallbacks.anonymous.connectionsLoad1min, 'movingAverage');
        
        // anonymouns index is 0, is the fisrt tenant registered
        let connecteClients = 0;
        jest.runOnlyPendingTimers();

        // no client connected
        expect(moveAverageSpy).toBeCalledTimes(1);

        connecteClients = 1545415454;
        metrics.metrics[0].connectedClients = connecteClients;
        metrics.metricsCallbacks.anonymous.lastIntervalConnectedClients = connecteClients;
        jest.runOnlyPendingTimers();
        expect(moveAverageSpy).toBeCalledTimes(2);
    });

    it("Should test compute connectionsLoad15min movingAverage function", () => {
        const metrics = new moscaMestrics.Metrics();
        const moveAverageSpy = jest.spyOn(metrics.metricsCallbacks.anonymous.connectionsLoad5min, 'movingAverage');
        
        // anonymouns index is 0, is the fisrt tenant registered
        let connecteClients = 0;
        jest.runOnlyPendingTimers();

        // no client connected
        expect(moveAverageSpy).toBeCalledTimes(1);

        // 1 client connected
        connecteClients = 1542555;
        metrics.metrics[0].connectedClients = connecteClients;
        metrics.metricsCallbacks.anonymous.lastIntervalConnectedClients = connecteClients;
        jest.runOnlyPendingTimers();
        expect(moveAverageSpy).toBeCalledTimes(2);
    });

    it("Should test compute connectionsLoad15min movingAverage function", () => {
        const metrics = new moscaMestrics.Metrics();
        const moveAverageSpy = jest.spyOn(metrics.metricsCallbacks.anonymous.connectionsLoad15min, 'movingAverage');
        
        // anonymouns index is 0, is the fisrt tenant registered
        let connecteClients = 0;
        jest.runOnlyPendingTimers();

        // no client connected
        expect(moveAverageSpy).toBeCalledTimes(1);

        // 1 client connected
        connecteClients = 15;
        metrics.metrics[0].connectedClients = connecteClients;
        metrics.metricsCallbacks.anonymous.lastIntervalConnectedClients = connecteClients;
        jest.runOnlyPendingTimers();
        expect(moveAverageSpy).toBeCalledTimes(2);
    });

    it("Should test compute connectionsLoad1hour movingAverage function", () => {
        const metrics = new moscaMestrics.Metrics();
        const moveAverageSpy = jest.spyOn(metrics.metricsCallbacks.anonymous.connectionsLoad1hour, 'movingAverage');
        
        // anonymouns index is 0, is the fisrt tenant registered
        let connecteClients = 0;
        jest.runOnlyPendingTimers();

        // no client connected
        expect(moveAverageSpy).toBeCalledTimes(1);

        connecteClients = 1254;
        metrics.metrics[0].connectedClients = connecteClients;
        metrics.metricsCallbacks.anonymous.lastIntervalConnectedClients = connecteClients;
        jest.runOnlyPendingTimers();
        expect(moveAverageSpy).toBeCalledTimes(2);
    });
});
