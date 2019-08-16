const express = require("express");
const logger = require("@dojot/dojot-module-logger").logger;
const Metric = require('./model/Metric');
const TAG = "metrics";

/**
 * Metrics agent for IoT agent MQTT.
 */
class Metrics {
  constructor() {
    this.logger = logger;
    this.metrics = [];
    this.metricsCallbacks = {}

    // create the anonymous metric tenant
    const anonymousStr = 'anonymous'
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

      if (connectedClients > this.metricsCallbacks[tenant].maxClientConnected) {
        this.metricsCallbacks[tenant].maxClientConnected = connectedClients;
      }

      const maxClientConnected = this.metricsCallbacks[tenant].maxClientConnected;

      // computing Load for 1 minute
      this.metrics[tenantIndex].connectionLoad1min = maxClientConnected / timerExpiredCount;
      console.log("compute 1min: ", maxClientConnected, timerExpiredCount);

      // computing Load for 5 min
      if ((timerExpiredCount % 5) === 0) {
        console.log("5 min");
        this.metrics[tenantIndex].connectionsLoad5min = maxClientConnected / (timerExpiredCount / 5);
      }

      // computing Load for 15 min
      if ((timerExpiredCount % (1 * 15)) === 0) {
        console.log("15 min")
        this.metrics[tenantIndex].connectionsLoad15min = maxClientConnected / (timerExpiredCount / 15);
      }

      // computing Load for 1 hour
      if ((timerExpiredCount % (1 * 60)) === 0) {
        console.log("1h")
        this.metrics[tenantIndex].connectionsLoad1hour = maxClientConnected / (timerExpiredCount / 60);
      }

      // computing Load for 1 day
      if ((timerExpiredCount % (1 * 24 * 60)) === 0) {
        console.log("1 day")
        this.metrics[tenantIndex].connectionsLoad1day = maxClientConnected / (timerExpiredCount / (24 * 60));
      }

      this.connectionsLoad5min = 0;
      this.connectionsLoad15min = 0;
      this.connectionsLoad1hour = 0;
      this.connectionsLoad1day = 0;

    };
  }

  prepareNewTenantForMetric(tenant) {
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

  prepareDeletedTenantForMetric(tenant) {
    const tenantIndex = this.metrics.findIndex((te) => te.tenant === tenant);
    this.metrics.splice(tenantIndex, 1);

    // stop the timeOut and run it again and delete the object
    clearInterval(this.metricsCallbacks[tenant].callback);
    delete this.metricsCallbacks[tenant];
    this.logger.info(`Deleted callback for ${tenant}-tenant`, 'just-for-test');
  }

  newPreparePayload(payload) {
    const tenant = payload.subject;
    const dataKey = Object.keys(payload)[1];

    let tenantIndex = this.metrics.findIndex((te) => te.tenant === tenant);
    if (tenantIndex == -1) {
      tenantIndex = this.metrics.findIndex((te) => te.tenant === 'anonymous');
    }

    this.metrics[tenantIndex][dataKey] += payload[dataKey];
    logger.error(this.metrics, 'just-for-test');
  }

  preparePayloadObject(payloadTopic, payloadValue) {
    // this.lastMetricsInfo[`${payloadTopic}`] = `${payloadValue}`;
    this.logger.debug(`Published metric: ${payloadTopic}=${payloadValue}`);
  }
}
function getHTTPRouter(metricsStore) {
  const router = new express.Router();
  router.get('/iotagent-mqtt/metrics', (req, res) => {
    if (metricsStore.metrics) {
      return res.status(200).json(metricsStore.metrics);
    } else {
      logger.debug(`Something unexpected happened`);
      return res.status(500).json({ status: 'error', errors: [] });
    }
  });
  return router;
}

module.exports = {
  Metrics,
  getHTTPRouter
};

