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
        this.connectionsLoad1min = 0;
        this.connectionsLoad5min = 0;
        this.connectionsLoad15min = 0;
        this.connectionsLoad1hour = 0;

        // valid messages
        this.validMessages = 0
        this.validMessagesLoad1min = 0;
        this.validMessagesLoad5min = 0;
        this.validMessagesLoad15min = 0;
        this.validMessagesLoad1hour = 0;

        // invalid messages
        this.inValidMessages = 0
        this.inValidMessagesLoad1min = 0;
        this.inValidMessagesLoad5min = 0;
        this.inValidMessagesLoad15min = 0;
        this.inValidMessagesLoad1hour = 0;

    }
}

module.exports = Metric;