const express = require("express");
const logger = require("@dojot/dojot-module-logger").logger;

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
  }

  prepareNewTenantForMetric(tenant) {
    const metric = {
      "tenant": `${tenant}`,
      "connectedClients": 0,
      "connectionLoad1min": 0,
      "connectionsLoad5min": 0,
      "connectionsLoad15min": 0,
      "connectionsLoad1hour": 0,
      "connectionsLoad1day": 0,
      "validMessages": {
        "count": 0,
        "count1min": 0,
        "count1hour": 0,
        "count1day": 0
      },
      "inValidMessages": {
        "count": 0,
        "count1min": 0,
        "count1hour": 0,
        "count1day": 0
      }
    };
    this.newMetrics.push(metric);
    this.logger.error(this.newMetrics, "new Metric");
  }

  prepareDeletedTenantForMetric(tenant) {
    const tenantIndex = this.newMetrics.findIndex((te) => te.tenant === tenant)
    this.logger.error(`Must remove this one ${tenantIndex}`, "Jonas");
    this.newMetrics.splice(tenantIndex, 1);
    this.logger.error(this.newMetrics, "new Metric");
  }

  newPreparePayload(tenant, payloadData) {
    const tenantIndex = this.newMetrics.findIndex((te) => te.tenant === tenant);
    if (tenantIndex != -1) {
      this.newMetrics[tenantIndex][payloadData.subject] += payloadData.value;
    }
    logger.error(this.newMetrics);
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
      return res.status(200).json(metricsStore.lastMetricsInfo);
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

