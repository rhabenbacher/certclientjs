// Save certificates in folder ./certificates

const folder = require("./../../" + (process.env.NODE_ENV || "devConf")).storeCertificate.fileFolder;
const fs = require('fs');
const logger = require('./../util/logger');

const writeFile = (filename,data) => {
  const fullFilename = folder + '/' + filename;
  try {
      fs.writeFileSync(fullFilename,data);
  } catch (e) {
      logger(`Could not write file: ${fullFilename}`,'red');
      return false;
  }
  logger(`Wrote file: ${fullFilename}`);
  return true;
};


module.exports = (data,domain) => {

  writeFile(`account-key.pem`,data.accountKey.privateKeyPem.toString());
  writeFile(`${domain}-key.pem`,data.certKey.privateKeyPem.toString());
  writeFile(`${domain}.pem`,data.certPem);

};
