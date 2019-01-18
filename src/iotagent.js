var Agent = require('@dojot/iotagent-nodejs').IoTAgent;
var logger = require("@dojot/dojot-module-logger").logger;
const MqttBackend = require("./mosca").MqttBackend;
const util = require("util");
const TAG = { filename: "iotagent"};

/**
 * Class responsible for message processing.
 */
class IoTAgent {

  /**
   * Constructor
   * @param {MqttBackend} mqttBackend The MQTT backend to be used by this agent
   */
  constructor() {
    // Base iot-agent
    logger.debug("Initializing IoT agent...", TAG);
    this.agent = new Agent();
    this.agent.init();
    logger.debug("... IoT agent was initialized", TAG);

    logger.debug("Initializing MQTT backend...", TAG);
    this.mqttBackend = new MqttBackend(this.agent);
    logger.debug("... MQTT backend was successfully initialized.");

    this.messageMonitor = {
      value: 0,
      monitor: undefined,
    };

    this._registerCallbacks();
  }

  initHealthCheck(healthChecker) {
    const monitor = {
      componentId: "1",
      componentName: "dojot-module",
      componentType: "process",
      measurementName: "number of messages",
      observedUnit: "messages",
      status: "pass",
    };
    this.messageMonitor.monitor = healthChecker.registerMonitor(monitor);
  }

  /**
   * Process a device removal event.
   *
   * This method will invoke the mqttBackend in order to disconnect the device
   * from the MQTT broker as it won't be used anymore.
   * @param {string} tenant The tenant associated to the generated event
   * @param {object} event The generated event
   */
  _processDeviceRemoval(tenant, event) {
    logger.info(`Received a device.remove message.`, TAG);
    this.mqttBackend.disconnectDevice(tenant, event.data.id);
  }

  /**
   * Process a device actuation event.
   *
   * This function will publish some data to `/tenant/deviceId/config` topic,
   * expecting that the device will be subcribed to it and therefore able to
   * receive this messsage. It is intended to do something in the device, like
   * set a particular target value for one of its actuators, reset it, etc.
   *
   * @param {string} tenant The tenant associated to the generated event
   * @param {object} event The generated event
   */
  _processDeviceActuation(tenant, event) {
    logger.info(`Received a device.configure message.`, TAG);
    // device id
    let deviceId = event.data.id;
    delete event.data.id;

    // topic
    // For now, we are still using slashes at the beginning. In the future,
    // this will be removed (and topics will look like 'admin/efac/config')
    // let topic = `${tenant}/${deviceId}/config`;
    let topic = `/${tenant}/${deviceId}/config`;

    // device
    let message = {
      'topic': topic,
      'payload': JSON.stringify(event.data.attrs),
      'qos': 0,
      'retain': false
    };

    // send data to device
    logger.debug(`Publishing to topic: ${topic}`, TAG);
    logger.debug(`Message is: ${util.inspect(message)}`, TAG);
    this.mqttBackend.server.publish(message, () => {
      logger.debug(`... message was successfully published.`, TAG);
    });
  }

  /**
   * Register all callbacks associated to this agent.
   *
   * This includes not only dojot callbacks (by calling agent.on() functions)
   * but also mqttBackend callbacks.
   */
  _registerCallbacks() {
    const boundProcessDeviceRemoval = this._processDeviceRemoval.bind(this);
    const boundProcessDeviceActuation = this._processDeviceActuation.bind(this);
    const boundProcessMessage = this._processMessage.bind(this);
    this.agent.on('iotagent.device', 'device.remove', boundProcessDeviceRemoval);
    this.agent.on('iotagent.device', 'device.configure', boundProcessDeviceActuation);
    this.mqttBackend.onMessage(boundProcessMessage);
  }

  _processMessage(tenant, deviceId, data) {
    logger.debug(`Received a message via MQTT`, TAG);
    //TODO: support only ISO string???
    logger.debug(`Generating metadata...`, TAG);
    let metadata = {};
    if ("timestamp" in data) {
      metadata = { timestamp: 0 };
      // If it is a number, just copy it. Probably Unix time.
      if (typeof data.timestamp === "number") {
        if (!isNaN(data.timestamp)) {
          metadata.timestamp = data.timestamp;
        }
        else {
          logger.warn("Received an invalid timestamp (NaN)", TAG);
          metadata = {};
        }
      }
      else {
        // If it is a ISO string...
        const parsed = Date.parse(data.timestamp);
        if (!isNaN(parsed)) {
          metadata.timestamp = parsed;
        }
        else {
          // Invalid timestamp.
          metadata = {};
        }
      }
    }
    logger.debug(`... metadata successfully generated.`, TAG);
    logger.debug(`Metadata is: ${util.inspect(metadata)}`, TAG);

    logger.debug(`Updating device attributes in dojot...`, TAG);
    this.agent.updateAttrs(deviceId, tenant, data, metadata);
    logger.debug(`... attribute update message was succesfully sent.`, TAG);

    this.messageMonitor.value += 1;
    this.messageMonitor.monitor.trigger(this.messageMonitor.value);
  }
}

module.exports = {
  IoTAgent
};
