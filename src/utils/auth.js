
/* jshint node: true */
/* jshint esversion: 6 */

const b64decode = (data) => {
  if (typeof Buffer.from === 'function') {
    return Buffer.from(data, 'base64').toString();
  }
  return (Buffer.from(data, 'base64')).toString();
};

function userDataByToken(rawToken) {
  const tokenData = JSON.parse(b64decode(rawToken.split('.')[1]));
  return {
    username: tokenData.username,
    userid: tokenData.userid,
    profile: tokenData.profile,
    service: tokenData.service,
  };
}

module.exports = {
  b64decode, userDataByToken,
};