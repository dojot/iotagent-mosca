const express = require("express");
const logger = require("@dojot/dojot-module-logger").logger;
const Metric = require('./model/Metric');
const util = require('util');
const movingAverage = require('moving-average');
const getUser = require('./utils/auth').userDataByToken;
const TAG = { filename: "metrics" };

/**
 * Metrics agent for IoT agent MQTT.
 */
class Metrics {
  constructor() {
    this.logger = logger;
    this.metrics = [];
    this.metricsCallbacks = {}

    // create the anonymous metric tenant
    const anonymousStr = 'anonymous';
    const anonymousMetric = new Metric(anonymousStr);
    this.metrics.push(anonymousMetric);
    this._registerLoad(anonymousStr);
  }

  _registerLoad(tenant) {

    const date = Date.now();
    const k = 60 * 1000; // constant

    const callback = this._computeMetricsCallback(tenant);
    this.metricsCallbacks[tenant] = {}

    /**
     * The metrics are computed using moving average.
     * This timer register a callback to be called each 10 seconds
     * Then sample and compute the metrics based on the
     * connected client, valid and invalid messages since the last timeout.
     */
    this.metricsCallbacks[tenant].callback = setInterval(callback, 10000);

    this.metricsCallbacks[tenant].lastIntervalConnectedClients = 0;
    this.metricsCallbacks[tenant].lastIntervalValidMessageCount = 0;
    this.metricsCallbacks[tenant].lastIntervalInValidMessageCount = 0;

    // 1min
    this.metricsCallbacks[tenant].connectionsLoad1min = movingAverage(1 * Number(k));
    this.metricsCallbacks[tenant].connectionsLoad1min.push(date, 0);

    this.metricsCallbacks[tenant].validMessagesLoad1min = movingAverage(1 * Number(k))
    this.metricsCallbacks[tenant].validMessagesLoad1min.push(date, 0);

    this.metricsCallbacks[tenant].inValidMessagesLoad1min = movingAverage(1 * Number(k))
    this.metricsCallbacks[tenant].inValidMessagesLoad1min.push(date, 0);

    // 5min
    this.metricsCallbacks[tenant].connectionsLoad5min = movingAverage(5 * Number(k));
    this.metricsCallbacks[tenant].connectionsLoad5min.push(date, 0);

    this.metricsCallbacks[tenant].validMessagesLoad5min = movingAverage(5 * Number(k));
    this.metricsCallbacks[tenant].validMessagesLoad5min.push(date, 0);

    this.metricsCallbacks[tenant].inValidMessagesLoad5min = movingAverage(5 * Number(k));
    this.metricsCallbacks[tenant].inValidMessagesLoad5min.push(date, 0);

    // 15min
    this.metricsCallbacks[tenant].connectionsLoad15min = movingAverage(15 * Number(k));
    this.metricsCallbacks[tenant].connectionsLoad15min.push(date, 0);

    this.metricsCallbacks[tenant].validMessagesLoad15min = movingAverage(15 * Number(k));
    this.metricsCallbacks[tenant].validMessagesLoad15min.push(date, 0);

    this.metricsCallbacks[tenant].inValidMessagesLoad15min = movingAverage(15 * Number(k));
    this.metricsCallbacks[tenant].inValidMessagesLoad15min.push(date, 0);

    // 1hour
    this.metricsCallbacks[tenant].connectionsLoad1hour = movingAverage(60 * Number(k));
    this.metricsCallbacks[tenant].connectionsLoad1hour.push(date, 0);

    this.metricsCallbacks[tenant].validMessagesLoad1hour = movingAverage(60 * Number(k));
    this.metricsCallbacks[tenant].validMessagesLoad1hour.push(date, 0);

    this.metricsCallbacks[tenant].inValidMessagesLoad1hour = movingAverage(60 * Number(k));
    this.metricsCallbacks[tenant].inValidMessagesLoad1hour.push(date, 0);

    this.logger.info(`Registered callback for -${tenant}- tenant to compute metrics`, TAG);
  }

  /**
   * Callback for compute metric for a given tenant
   *
   * @param {string} tenant string representing tenant
   */
  _computeMetricsCallback(tenant) {
    return () => {

      let value = 0;
      let tenantIndex = this.metrics.findIndex((te) => te.tenant === tenant);

      const date = new Date();
      const lastInterValConnected = this.metricsCallbacks[tenant].lastIntervalConnectedClients;
      const lastInterValvalidMessages = this.metricsCallbacks[tenant].lastIntervalValidMessageCount;
      const lastInterValInValidMessages = this.metricsCallbacks[tenant].lastIntervalInValidMessageCount;

      // 1min
      this.metricsCallbacks[tenant].connectionsLoad1min.push(date, lastInterValConnected);
      this.metricsCallbacks[tenant].validMessagesLoad1min.push(date, lastInterValvalidMessages);
      this.metricsCallbacks[tenant].inValidMessagesLoad1min.push(date, lastInterValInValidMessages);

      // 5min
      this.metricsCallbacks[tenant].connectionsLoad5min.push(date, lastInterValConnected);
      this.metricsCallbacks[tenant].validMessagesLoad5min.push(date, lastInterValvalidMessages);
      this.metricsCallbacks[tenant].inValidMessagesLoad5min.push(date, lastInterValInValidMessages);

      // 15min
      this.metricsCallbacks[tenant].connectionsLoad15min.push(date, lastInterValConnected);
      this.metricsCallbacks[tenant].validMessagesLoad15min.push(date, lastInterValvalidMessages);
      this.metricsCallbacks[tenant].inValidMessagesLoad15min.push(date, lastInterValInValidMessages);

      // 1hour
      this.metricsCallbacks[tenant].connectionsLoad1hour.push(date, lastInterValConnected);
      this.metricsCallbacks[tenant].validMessagesLoad1hour.push(date, lastInterValvalidMessages);
      this.metricsCallbacks[tenant].inValidMessagesLoad1hour.push(date, lastInterValInValidMessages);

      // 1min
      value = this.metricsCallbacks[tenant].connectionsLoad1min.movingAverage();
      this.metrics[tenantIndex].connectionsLoad1min = Math.round(value * 100) / 100;
      value = this.metricsCallbacks[tenant].validMessagesLoad1min.movingAverage();
      this.metrics[tenantIndex].validMessagesLoad1min = Math.round(value * 100) / 100;
      value = this.metricsCallbacks[tenant].inValidMessagesLoad1min.movingAverage();
      this.metrics[tenantIndex].inValidMessagesLoad1min = Math.round(value * 100) / 100;

      // 5min
      value = this.metricsCallbacks[tenant].connectionsLoad5min.movingAverage();
      this.metrics[tenantIndex].connectionsLoad5min = Math.round(value * 100) / 100;
      value = this.metricsCallbacks[tenant].validMessagesLoad5min.movingAverage();
      this.metrics[tenantIndex].validMessagesLoad5min = Math.round(value * 100) / 100;
      value = this.metricsCallbacks[tenant].inValidMessagesLoad5min.movingAverage();
      this.metrics[tenantIndex].inValidMessagesLoad5min = Math.round(value * 100) / 100;

      // 15min
      value = this.metricsCallbacks[tenant].connectionsLoad15min.movingAverage();
      this.metrics[tenantIndex].connectionsLoad15min = Math.round(value * 100) / 100;
      value = this.metricsCallbacks[tenant].validMessagesLoad15min.movingAverage();
      this.metrics[tenantIndex].validMessagesLoad15min = Math.round(value * 100) / 100;
      value = this.metricsCallbacks[tenant].inValidMessagesLoad15min.movingAverage();
      this.metrics[tenantIndex].inValidMessagesLoad15min = Math.round(value * 100) / 100;

      // 1hour
      value = this.metricsCallbacks[tenant].connectionsLoad1hour.movingAverage();
      this.metrics[tenantIndex].connectionsLoad1hour = Math.round(value * 100) / 100;
      value = this.metricsCallbacks[tenant].validMessagesLoad1hour.movingAverage();
      this.metrics[tenantIndex].validMessagesLoad1hour = Math.round(value * 100) / 100;
      value = this.metricsCallbacks[tenant].inValidMessagesLoad1hour.movingAverage();
      this.metrics[tenantIndex].inValidMessagesLoad1hour = Math.round(value * 100) / 100;

      this.metricsCallbacks[tenant].lastIntervalConnectedClients = 0;
      this.metricsCallbacks[tenant].lastIntervalValidMessageCount = 0;
      this.metricsCallbacks[tenant].lastIntervalInValidMessageCount = 0;
      logger.debug(`Computed Metrics for tenant: ${tenant}`, TAG);
    };
  }

  prepareNewTenantForMetric(tenant) {

    if(tenant) {

      const tenantIndex = this.metrics.findIndex((te) => te.tenant === tenant);

      if (tenantIndex !== -1) {
        logger.warn(`Tenant ${tenant} already have metric computed -Ignoring`, TAG);
        return;
      }
      const metric = new Metric(tenant);
      this.metrics.push(metric);
      this._registerLoad(tenant);
    }
  }

  prepareValidInvalidMessageMetric(payload) {

    logger.info(`Preparing payload object ${util.inspect(payload)}`, TAG);

    try {
      const tenant = payload.subject;
      let tenantIndex = this.metrics.findIndex((te) => te.tenant === tenant);
      if (tenantIndex == -1) {
        tenantIndex = this.metrics.findIndex((te) => te.tenant === 'anonymous');
      }

      if(payload.count == 1) {
        this.metrics[tenantIndex].validMessages += 1;
        this.metricsCallbacks[tenant].lastIntervalValidMessageCount += 1;
        return;
      }
      this.metrics[tenantIndex].inValidMessages += 1;
      this.metricsCallbacks[tenant].lastIntervalInValidMessageCount += 1;
    } catch (error) {
      logger.warn(`Error ${error} - preparing valid or invalid, payload metric`, TAG);
    }
  }

  prepareDeletedTenantForMetric(tenant) {

    if(!tenant) {
      logger.warn(`Expected a tenant as argument - received ${tenant}`, TAG);
      return;
    }

    const tenantIndex = this.metrics.findIndex((te) => te.tenant === tenant);

    if (tenantIndex === -1) {
      logger.warn(`Tenant doesn't exist, nothing to delete`, TAG);
      return;
    }

    // remove the tenant
    this.metrics.splice(tenantIndex, 1);

    // stop the timeOut and run it again and delete the object
    clearInterval(this.metricsCallbacks[tenant].callback);
    delete this.metricsCallbacks[tenant];
    this.logger.info(`Deleted callback for ${tenant}-tenant`, TAG);
  }

  preparePayloadObject(payload) {

    try {
      const dataKey = Object.keys(payload)[1];
      let tenant = payload.subject;

      if(tenant && dataKey) {
        logger.info(`Preparing payload object ${util.inspect(payload)}`, TAG);
        let tenantIndex = this.metrics.findIndex((te) => te.tenant === tenant);
        if (tenantIndex == -1) {
          tenantIndex = this.metrics.findIndex((te) => te.tenant === 'anonymous');
          tenant = 'anonymous';
        }
        this.metrics[tenantIndex][dataKey] += payload[dataKey];
        this.metricsCallbacks[tenant].lastIntervalConnectedClients += payload[dataKey];

      }
    } catch (error) {
      logger.warn(`Error ${error} preparing payload Object`, TAG);
    }
  }
}
function getHTTPRouter(metricsStore) {
  const router = new express.Router();
  router.get('/iotagent-mqtt/metrics', (req, res) => {

    if (metricsStore.metrics) {
      const rawToken = req.get('authorization');
      if (rawToken) {
        const currentUser = getUser(rawToken);
        let tenantIndex = metricsStore.metrics.findIndex((te) => te.tenant === currentUser.service);
        if (tenantIndex == -1) {
          tenantIndex = metricsStore.metrics.findIndex((te) => te.tenant === 'anonymous');
        }
        return res.status(200).json(metricsStore.metrics[tenantIndex]);
      }
      return res.status(401).json({ status: 'error', errors: ['Unauthorized'] });
    }
    logger.debug(`Something unexpected happened`);
    return res.status(500).json({ status: 'error', errors: [] });
  });
  return router;
}

module.exports = {
  Metrics,
  getHTTPRouter
};

