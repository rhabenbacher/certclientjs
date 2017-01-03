// is the Certificate store still valid ?

const pem = require('certpem').certpem;
const logger = require('./util/logger');

module.exports = (cert) => {

  const now = new Date();
  if (!cert) return false;
  //logger('Certificate Info:');
  //logger(pem.debug(cert));

  // return Certificate validity in hours minus 10 minutes minimum validity
  const validity = (pem.info(cert).expiresAt - now - (1000*60*10)) / (1000*60*60);
  const info = (validity < 24) ? `Cert expires in ${Math.floor(validity)} hours` : `Cert expires in ${Math.floor(validity/24)} days`;
  logger(info);
  return validity;
};
