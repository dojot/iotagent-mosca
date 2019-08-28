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
            expect(metric.validMessages.count).toEqual(0);
            expect(metric.inValidMessages.count).toEqual(0);
        });
    });

    it("Should count invalid message for anonimous message", () => {
        const metrics = new moscaMestrics.Metrics();
        metrics.prepareValidInvalidMessageMetric({subject: 'test-subject'});

        metrics.metrics.forEach(metric => {

            if (metric.tenant == 'anonymous') {
                expect(metric.validMessages.count).toEqual(0);
                expect(metric.inValidMessages.count).toEqual(1);
            } else {
                expect(metric.validMessages.count).toEqual(0);
                expect(metric.inValidMessages.count).toEqual(0)
            }
        });
    });

    it("Should count invalid message for anonymous message", () => {
        const metrics = new moscaMestrics.Metrics();
        metrics.prepareValidInvalidMessageMetric({subject: 'anonymous', count: -1 });

        metrics.metrics.forEach(metric => {

            if (metric.tenant == 'anonymous') {
                expect(metric.validMessages.count).toEqual(0);
                expect(metric.inValidMessages.count).toEqual(1);
            } else {
                expect(metric.validMessages.count).toEqual(0);
                expect(metric.inValidMessages.count).toEqual(0)
            }
        });
    });

    it("Should count valid message for anonymous message", () => {
        const metrics = new moscaMestrics.Metrics();
        metrics.prepareValidInvalidMessageMetric({subject: 'anonymous', count: 1 });

        metrics.metrics.forEach(metric => {

            if (metric.tenant == 'anonymous') {
                expect(metric.validMessages.count).toEqual(1);
                expect(metric.inValidMessages.count).toEqual(0);
            } else {
                expect(metric.validMessages.count).toEqual(0);
                expect(metric.inValidMessages.count).toEqual(0)
            }
        });
    });

    it("Should compute connectionsLoad1min for anonymous registered tenants", () => {
        const metrics = new moscaMestrics.Metrics();

        // anonymouns index is 0, is the fisrt tenant registered
        jest.runOnlyPendingTimers();

        // no clilent connected 1rst minute
        expect(metrics.metrics[0].connectionsLoad1min).toBe(0);

        // 1 clilent connected 2rst minute
        metrics.metrics[0].connectedClients = 1;
        jest.runOnlyPendingTimers();
        expect(metrics.metrics[0].connectionsLoad1min).toBe(1 / 2);

        // 1890 clilent connected 3rd minute
        metrics.metrics[0].connectedClients = 1890;
        jest.runOnlyPendingTimers();
        expect(metrics.metrics[0].connectionsLoad1min).toBe(1890 / 3);

        // no changes for 5m 1h and 1day
        expect(metrics.metrics[0].connectionsLoad1min).toBe(1890 / 3);
        expect(metrics.metrics[0].connectionsLoad5min).toBe(0);
        expect(metrics.metrics[0].connectionsLoad15min).toBe(0);
        expect(metrics.metrics[0].connectionsLoad1hour).toBe(0);
        expect(metrics.metrics[0].connectionsLoad1day).toBe(0);
    });

    it("Should compute metrics connectionsLoad5min for anonymous registered tenants", () => {
        const metrics = new moscaMestrics.Metrics();

        // anonymouns index is 0, is the fisrt tenant registered
        jest.runOnlyPendingTimers();

        // no clilent connected 1rst minute
        expect(metrics.metrics[0].connectionsLoad5min).toBe(0);

        // 1564 clilent connected after 5ve
        metrics.metrics[0].connectedClients = 1564;
        metrics.metricsCallbacks.anonymous.count = 4; // have been expired 4

        jest.runOnlyPendingTimers(); // expired 5 for the first time
        expect(metrics.metrics[0].connectionsLoad5min).toBe(1564 / (metrics.metricsCallbacks.anonymous.count / 5));

         // 18744 clilent connected after 5ve
         metrics.metrics[0].connectedClients = 18744;
         metrics.metricsCallbacks.anonymous.count = 9; // have been expired 9

         jest.runOnlyPendingTimers();
         expect(metrics.metrics[0].connectionsLoad5min).toBe(18744 / (metrics.metricsCallbacks.anonymous.count / 5));
         expect(metrics.metrics[0].connectionsLoad15min).toBe(0);
         expect(metrics.metrics[0].connectionsLoad1hour).toBe(0);
         expect(metrics.metrics[0].connectionsLoad1day).toBe(0);
    });

    it("Should compute metrics connectionsLoad15min for anonymous registered tenants", () => {
        const metrics = new moscaMestrics.Metrics();

        // anonymouns index is 0, is the fisrt tenant registered
        jest.runOnlyPendingTimers();

        // no clilent connected 1rst minute
        expect(metrics.metrics[0].connectionsLoad15min).toBe(0);

        // 15641 clilent connected
        metrics.metrics[0].connectedClients = 15641;
        metrics.metricsCallbacks.anonymous.count = 14;

        jest.runOnlyPendingTimers();
        expect(metrics.metrics[0].connectionsLoad15min).toBe(15641 / (metrics.metricsCallbacks.anonymous.count / 15));

         // 575154544 clilent connected
         metrics.metrics[0].connectedClients = 575154544;
         metrics.metricsCallbacks.anonymous.count = 29;

         jest.runOnlyPendingTimers();
         expect(metrics.metrics[0].connectionsLoad15min).toBe(575154544 / (metrics.metricsCallbacks.anonymous.count / 15));
         expect(metrics.metrics[0].connectionsLoad1hour).toBe(0);
         expect(metrics.metrics[0].connectionsLoad1day).toBe(0);
    });

    it("Should compute metrics connectionsLoad1hour for anonymous registered tenants", () => {
        const metrics = new moscaMestrics.Metrics();

        // anonymouns index is 0, is the fisrt tenant registered
        jest.runOnlyPendingTimers();

        // no clilent connected 1rst minute
        expect(metrics.metrics[0].connectionsLoad1hour).toBe(0);

        // 120 clilent connected
        metrics.metrics[0].connectedClients = 120;
        metrics.metricsCallbacks.anonymous.count = 59;

        jest.runOnlyPendingTimers();
        expect(metrics.metrics[0].connectionsLoad1hour).toBe(120 / (metrics.metricsCallbacks.anonymous.count / 60));

         // 4567787 clilent connected
         metrics.metrics[0].connectedClients = 4567787;
         metrics.metricsCallbacks.anonymous.count = 119;

         jest.runOnlyPendingTimers();
         expect(metrics.metrics[0].connectionsLoad1hour).toBe(4567787 / (metrics.metricsCallbacks.anonymous.count / 60));
         expect(metrics.metrics[0].connectionsLoad1day).toBe(0);
    });

    it("Should compute metrics connectionsLoad1day for anonymous registered tenants", () => {
        const metrics = new moscaMestrics.Metrics();

        // anonymouns index is 0, is the fisrt tenant registered
        jest.runOnlyPendingTimers();

        // no clilent connected 1rst minute
        expect(metrics.metrics[0].connectionsLoad1day).toBe(0);

        // 3467 clilent connected
        metrics.metrics[0].connectedClients = 3467;
        metrics.metricsCallbacks.anonymous.count = 1439;

        jest.runOnlyPendingTimers();
        expect(metrics.metrics[0].connectionsLoad1day).toBe(3467 / (metrics.metricsCallbacks.anonymous.count / 1440));

         // 45284841574 clilent connected
         metrics.metrics[0].connectedClients = 45284841574;
         metrics.metricsCallbacks.anonymous.count = 2879;

         jest.runOnlyPendingTimers();
         expect(metrics.metrics[0].connectionsLoad1day).toBe(45284841574 / (metrics.metricsCallbacks.anonymous.count / 1440));
    });
});
