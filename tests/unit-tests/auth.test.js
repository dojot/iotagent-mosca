/* eslint-disable no-undef */
"use strict";

/**
 * unit test for utils/auth.js file
 *
 * Creted at: August 22, 2019
 * Author: dojot/developers
 *
 * This module has no dependencies
 */
const auth = require('../../src/utils/auth');

 describe("Auth Helper", () => {

     it("should return an undefined user by a invalid token", () => {

        const parseUserByToken = auth.userDataByToken;

        const testToken = "test.eyJ0eXAiOiJKV1QiLCJhbGciOiJzb21ldGluZyJ9.test";
        const user = parseUserByToken(testToken);
        expect(user).toEqual({
            username: undefined,
            userid: undefined,
            profile: undefined,
            service: undefined
        });
     });

     it("should decode a base64", () => {

        const authBase64Decoder = auth.b64decode;
        const encoded = Buffer.from("sample-str").toString('base64');
        const decoded = authBase64Decoder(encoded);
        expect(decoded).toBe("sample-str");
     });
 });