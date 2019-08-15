/**
 * Metric object
 */
class Metric {

    /**
     * The metric contructor
     * @param {string} tenant the tenant name
     */
    constructor(tenant) {
        this.tenant = tenant;
        this.connectedClients = 0;
        this.connectionLoad1min = 0;
        this.connectionsLoad5min = 0;
        this.connectionsLoad15min = 0;
        this.connectionsLoad1hour = 0;
        this.connectionsLoad1day = 0;

        // valid messages
        this.validMessages = {}
        this.validMessages.count = 0;
        this.validMessages.count1min = 0;
        this.validMessages.count1hour = 0;
        this.validMessages.count1day = 0;

        // invalid messages
        this.inValidMessages = {}
        this.inValidMessages.count = 0;
        this.inValidMessages.count1min = 0;
        this.inValidMessages.count1hour = 0;
        this.inValidMessages.count1day = 0;
    }
}

module.exports = Metric;