const express = require("express");
const logger = require("@dojot/dojot-module-logger").logger;
const Metric = require('./model/Metric');
const TAG = { filename: "metrics"};
const util = require('util');
const getUser = require('./utils/auth').userDataByToken;

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

    const callback = this._computeMetricsCallback(anonymousStr);
    this.metricsCallbacks[anonymousStr] = {}
    this.metricsCallbacks[anonymousStr].count = 0;
    this.metricsCallbacks[anonymousStr].maxClientConnected = 0;
    this.metricsCallbacks[anonymousStr].callback = setInterval(callback, 60000);
  }

  /**
   * Callback for compute metric for a given tenant
   *
   * @param {string} tenant string representing tenant
   */
  _computeMetricsCallback(tenant) {
    return () => {
      // increase counter
      this.metricsCallbacks[tenant].count += 1;
      const timerExpiredCount = this.metricsCallbacks[tenant].count;
      const tenantIndex = this.metrics.findIndex((te) => te.tenant === tenant);
      const connectedClients = this.metrics[tenantIndex].connectedClients;

      // valid messages
      const validMessagesCount = this.metrics[tenantIndex].validMessages.count;
      // invalid messages
      const invalidMessagesCount = this.metrics[tenantIndex].inValidMessages.count;

      if (connectedClients > this.metricsCallbacks[tenant].maxClientConnected) {
        this.metricsCallbacks[tenant].maxClientConnected = connectedClients;
      }

      const maxClientConnected = this.metricsCallbacks[tenant].maxClientConnected;

      // computing Load for 1 minute
      this.metrics[tenantIndex].connectionLoad1min = maxClientConnected / timerExpiredCount;
      this.metrics[tenantIndex].validMessages.count1min = validMessagesCount / timerExpiredCount;
      this.metrics[tenantIndex].inValidMessages.count1min = invalidMessagesCount / timerExpiredCount;
      logger.debug(`Computed metrics for connectedClient and message message count 1min on tenant ${tenant}`, TAG);

      // computing Load for 5 min (1*5)
      if ((timerExpiredCount % 5) === 0) {
        this.metrics[tenantIndex].connectionsLoad5min = maxClientConnected / (timerExpiredCount / 5);
        logger.debug(`Computed metrics for connectedClient 5min on tenant ${tenant}`, TAG);
      }

      // computing Load for 15 min (1*15)
      if ((timerExpiredCount % 15) === 0) {
        this.metrics[tenantIndex].connectionsLoad15min = maxClientConnected / (timerExpiredCount / 15);
        logger.debug(`Computed metrics for connectedClient 15min on tenant ${tenant}`, TAG);
      }

      // computing Load for 1 hour (1*60)
      if ((timerExpiredCount % 60) === 0) {
        this.metrics[tenantIndex].connectionsLoad1hour = maxClientConnected / (timerExpiredCount / 60);
        this.metrics[tenantIndex].validMessages.count1hour = validMessagesCount / (timerExpiredCount / 60);
        this.metrics[tenantIndex].inValidMessages.count1hour = invalidMessagesCount / (timerExpiredCount / 60);
        logger.debug(`Computed metrics for connectedClient 1h/60min on tenant ${tenant}`, TAG);
      }

      // computing Load for 1 day (1*24*60)
      if ((timerExpiredCount % 1440) === 0) {
        this.metrics[tenantIndex].connectionsLoad1day = maxClientConnected / (timerExpiredCount / 1440);
        this.metrics[tenantIndex].validMessages.count1hour = validMessagesCount / (timerExpiredCount / 1440);
        this.metrics[tenantIndex].inValidMessages.count1hour = invalidMessagesCount / (timerExpiredCount / 1440);
        logger.debug(`Computed metrics for connectedClient 1day/1440min on tenant ${tenant}`, TAG);
      }
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

      // the callbcak is been fired here
      const callback = this._computeMetricsCallback(tenant);
      this.metricsCallbacks[tenant] = {}
      this.metricsCallbacks[tenant].count = 0;
      this.metricsCallbacks[tenant].maxClientConnected = 0;
      this.metricsCallbacks[tenant].callback = setInterval(callback, 60000);
      this.logger.info(`Registered callback for -${tenant}- tenant to compute metrics`, TAG);
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
        this.metrics[tenantIndex].validMessages.count += 1;
        return;
      }
      this.metrics[tenantIndex].inValidMessages.count += 1;
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
      const tenant = payload.subject;

      if(tenant && dataKey) {
        logger.info(`Preparing payload object ${util.inspect(payload)}`, TAG);
        let tenantIndex = this.metrics.findIndex((te) => te.tenant === tenant);
        if (tenantIndex == -1) {
          tenantIndex = this.metrics.findIndex((te) => te.tenant === 'anonymous');
        }
        this.metrics[tenantIndex][dataKey] += payload[dataKey];
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

