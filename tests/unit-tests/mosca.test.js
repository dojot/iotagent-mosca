/* eslint-disable no-undef */

const Mosca = require("../../src/mosca");
const client = require("../moscaSetup").clientSetup;
const packet = require("../moscaSetup").packetSetup;
const config = require("../../src/config");
const agent = require("../moscaSetup").agentSetup;
const TLSSocket = require("tls").TLSSocket;
const mosca = new Mosca.MqttBackend();

jest.mock('fs');
jest.mock('tls');

const FOLDER_PRESENT_CONFIG = {'./mosca/certs/ca.crl': "TEST"};

describe("Testing Mosca functions", () => {

    beforeEach(() => {
        jest.resetModules();
        require("fs").__createMockFiles(FOLDER_PRESENT_CONFIG);
    });

    test("Should define the attribute agentCallback as the string passed as argument", () => {
        mosca.onMessage();
        expect(mosca.agentCallback).toBeUndefined();
    });

    test("Should define the attribute agentCallback as the string passed as argument", () => {
        mosca.onMessage('message');
        expect(mosca.agentCallback).toEqual('message');
    });

    test("Should define the attribute agentCallbackInternal as the string passed as argument", () => {
        mosca.onInternalMessage('message');
        expect(mosca.agentCallbackInternal).toEqual('message');
    });

    test("Should split a string passed as first argument and return a string that corresponds to value of array at index passed as second argument", () => {
        expect(mosca._getTopicParameter('tenant/deviceId/attrs', 1)).toEqual('deviceId');
    });

    test("Testing Condition 1: client.id follows the pattern tenant:deviceId)", (done) => {
        TLSSocket.mockImplementation(() => {
            const rv = Object.create(TLSSocket.prototype);
            rv.getPeerCertificate = function () {
                return {subject: {CN: agent.deviceId}};
            };
            return rv;
        });
        client.connection.stream = new TLSSocket(null);

        let newClient = {...client};
        newClient.id = null;

        mosca.authenticate(newClient, "admin", "admin", (callback) => {
            expect(mosca.cache.client).toBeUndefined();
            expect(callback).toBeNull();
            done();
        });

        mosca.authenticate(client, "admin", "admin", (callback) => {
            expect(mosca.cache.client).toBeUndefined();
            expect(callback).toBeNull();
            done();
        });

        newClient = {...client};
        newClient.id = '';
        delete newClient.connection.stream;

        mosca.authenticate(newClient, 'admin', 'admin', (callback) => {
            expect(callback).toBeNull();
            done();
        });

        newClient = {...client};
        TLSSocket.mockImplementation(() => {
            const rv = Object.create(TLSSocket.prototype);
            rv.getPeerCertificate = function () {
                return {subject: {CN: '98989'}};
            };
            return rv;
        });
        client.connection.stream = new TLSSocket(null);

        mosca.authenticate(newClient, 'admin', 'admin', (callback) => {
            expect(callback).toBeNull();
            done();
        });
    });

    test("Should split a string passed as first argument and return a debug message", () => {
        mosca.onMessage('message');
        mosca._processMessage(packet, client);
        expect(mosca.agentCallback).toEqual("message");
    });

    test("Should parse a string and return an object {tenant:'admin', device:'98787de'} or undefined", () => {
        expect(mosca.parseClientIdOrTopic("admin:98787de")).toEqual({tenant: 'admin', device: '98787de'});
        expect(mosca.parseClientIdOrTopic()).toBeUndefined();
        expect(mosca.parseClientIdOrTopic(null, "/admin/98787de/attrs")).toEqual({tenant: 'admin', device: '98787de'});
        expect(mosca.parseClientIdOrTopic(null, "admin:98787de")).toBeUndefined();
        expect(mosca.parseClientIdOrTopic(0, "98787de")).toBeUndefined();
    });

    test("Should check the authorization of device", async () => {
        await mosca._checkAuthorization(client, '/tenant/98787de/attrs', 'temperature', (callback) => {
            expect(mosca.cache.client).toBeUndefined();
            expect(callback).toBeNull();
            expect(callback).toBeFalsy();
        });

    });


    test("Should use unsecured mode", () => {
        config.allow_unsecured_mode = true;

        let newMosca = new Mosca.MqttBackend(agent);
        // console.log(newMosca.server.opts.interfaces[1]);

        expect(newMosca.server.opts.interfaces[1]).toBeDefined();
        expect(newMosca.server.opts.interfaces.length).toEqual(2);
        expect(newMosca.server.opts.interfaces[1]).toMatchObject({type: "mqtt", port: 1883});
        expect(newMosca.server.opts.interfaces[1].type).toEqual("mqtt");
        expect(newMosca.server.opts.interfaces[1].port).toEqual(1883);
    });

    test("Should check the authorization of device", () => {
        client.close = jest.fn(client.close);

        const newMosca = new Mosca.MqttBackend(agent);
        newMosca.cache.set(client.id, {tenant: 'admin', deviceId: 'u86fda', client: client});
        const cacheEntry = newMosca.cache.get(client.id);

        // console.log(cacheEntry);

        let disconnect = newMosca.disconnectDevice('admin', 'u86fda');
        expect(disconnect).toBeDefined();
        expect(disconnect.deviceId).toEqual('u86fda');
        expect(client.close).toHaveBeenCalled();
        expect(newMosca.moscaInterfaces).toBeUndefined();
        expect(cacheEntry.client).toBeDefined();
    });

    test("Should check the authorization of device", () => {
        client.close = jest.fn(client.close);

        const newMosca = new Mosca.MqttBackend(agent);
        newMosca.cache.set('admin:u86fda', {tenant: 'admin', deviceId: 'u86fda'});

        disconnect = newMosca.disconnectDevice();
        expect(disconnect).toBeUndefined();
    });

    test("Should check the authorization of device", () => {
        client.close = jest.fn(client.close);

        const newMosca = new Mosca.MqttBackend(agent);
        newMosca.cache.set('admin:u86fda', {});
        newMosca.disconnectDevice();

        expect(client.close).not.toHaveBeenCalled();
    });

    test("Should check the authorization of device", () => {
        client.close = jest.fn(client.close);

        const newMosca = new Mosca.MqttBackend(agent);
        newMosca.cache.set('admin:u86fda', {});

        cacheEntry = newMosca.cache.get(client.id);
        newMosca.disconnectDevice('admin', 'aaaaaa');

        expect(client.close).not.toHaveBeenCalled();
        expect(cacheEntry.deviceId).toBeUndefined();
    });
});
