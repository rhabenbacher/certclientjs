// Read certificates in folder ./certificates

const folder = require("./../../" + (process.env.NODE_ENV || "devConf")).storeCertificate.fileFolder;
const fs = require('fs');
const logger = require('./../util/logger');

const readFile = (filename) => {
  const fullFilename = folder + '/' + filename;
  let data;
  try {
      data = fs.readFileSync(fullFilename,'utf8');
  } catch (e) {
      logger(`Could not read file: ${fullFilename}`,'red');
//      console.error(e);
      return false;
  }
  logger(`Read file: ${fullFilename}`);
  return data;
};

exports.readAccountKey = () => readFile('account-key.pem');
exports.readCertKey = (domain) => readFile(`${domain}-key.pem`);
exports.readCert = (domain) => readFile(`${domain}.pem`);
