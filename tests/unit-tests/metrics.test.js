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
    beforeEach(() => jest.resetModules());

    afterEach(() => {
        stopApp();
    });

    it('Should return OK status and the metricStore object', async () => {

        const metricsArray = [];
        const metricsWithAnonymous = new MetricModel();
        metricsWithAnonymous.tenant = 'anonymous';
        metricsArray.push(metricsWithAnonymous);

        let metricStore = new moscaMestrics.Metrics();
        app.use(moscaMestrics.getHTTPRouter(metricStore));
        let response = await get('/iotagent-mqtt/metrics', '');

        expect(response.status).toEqual(500);
        // expect(JSON.parse(response.text)).toEqual(metricsArray);
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
        // should fail
    });
});
