const AWS = require('aws-sdk/global');
const S3 = require('aws-sdk/clients/s3');
const config = require("./../../" + (process.env.NODE_ENV || "devConf"));
const logger = require("./../util/logger");

const readS3 = (key) => new Promise ((resolve) => {

  AWS.config.update({accessKeyId:config.storeCertificate.s3AccesskeyId,
                        secretAccessKey:config.storeCertificate.s3SecretAccessKey,
                        region:'eu-central-1',signatureVersion:'v4'});
  const s3 = new AWS.S3();
  s3.getObject({Bucket:config.storeCertificate.s3Bucket,
                Key:key}, (err,data) =>{

                  if (err) {
                    logger(`Error reading S3: ${err}`,'red');
                    resolve();

                  } else
                  {
                  logger(`Read ${key} from S3 Bucket ${config.storeCertificate.s3Bucket}`);
                  resolve(data.Body.toString());
                  }
                });
});

exports.readAccountKey = () => readS3('account-key.pem');
exports.readCertKey = (domain) => readS3(`${domain}-key.pem`);
exports.readCert = (domain) => readS3(`${domain}.pem`);
