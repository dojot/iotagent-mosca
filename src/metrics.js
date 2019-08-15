const express = require("express");
const logger = require("@dojot/dojot-module-logger").logger;
const Metric = require('./model/Metric');

/**
 * Metrics agent for IoT agent MQTT.
 */
class Metrics {
  constructor() {
    this.lastMetricsInfo = {
      connectedClients: null,
      connectionsLoad1min: null,
      connectionsLoad5min: null,
      connectionsLoad15min: null,
      messagesLoad1min: null,
      messagesLoad5min: null,
      messagesLoad15min: null
    };
    this.logger = logger;
    this.newMetrics = [];

    // create the anonymous metric tenant
    const anonymousMetric = new Metric('anonymous');
    this.newMetrics.push(anonymousMetric);
  }

  prepareNewTenantForMetric(tenant) {
    const metric = new Metric(tenant);
    this.newMetrics.push(metric);
    this.logger.error(this.newMetrics, "just-for-test");
  }

  prepareDeletedTenantForMetric(tenant) {
    const tenantIndex = this.newMetrics.findIndex((te) => te.tenant === tenant);
    this.newMetrics.splice(tenantIndex, 1);
    this.logger.error(this.newMetrics, 'just-for-test');
  }

  newPreparePayload(payload) {
    const tenant = payload.subject;
    const dataKey = Object.keys(payload)[1];

    let tenantIndex = this.newMetrics.findIndex((te) => te.tenant === tenant);
    if (tenantIndex == -1) {
      tenantIndex = this.newMetrics.findIndex((te) => te.tenant === 'anonymous');
    }

    this.newMetrics[tenantIndex][dataKey] += payload[dataKey];
    logger.error(this.newMetrics, 'just-for-test');
  }

  preparePayloadObject(payloadTopic, payloadValue) {
    this.lastMetricsInfo[`${payloadTopic}`] = `${payloadValue}`;
    this.logger.debug(`Published metric: ${payloadTopic}=${payloadValue}`);
  }
}
function getHTTPRouter(metricsStore) {
  const router = new express.Router();
  router.get('/iotagent-mqtt/metrics', (req, res) => {
    if (metricsStore.lastMetricsInfo) {
      return res.status(200).json(metricsStore.newMetrics);
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

