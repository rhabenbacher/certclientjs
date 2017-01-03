const AWS = require('aws-sdk/global');
const S3 = require('aws-sdk/clients/s3');
const config = require("./../../" + (process.env.NODE_ENV || "devConf"));
const logger = require("./../util/logger");

const writeS3 = (key,strdata) => {

  AWS.config.update({accessKeyId:config.storeCertificate.s3AccesskeyId,
                        secretAccessKey:config.storeCertificate.s3SecretAccessKey,
                        region:'eu-central-1',signatureVersion:'v4'});
  const s3 = new AWS.S3();
  s3.putObject({Bucket:config.storeCertificate.s3Bucket,
                Key:key,
                Body:strdata}, (err,data) =>{

                  if (err) {
                    logger(`Error writing S3: ${err}`,'red');
                  }
                  if (data) {
                    logger(`Written ${key} to S3 Bucket ${config.storeCertificate.s3Bucket}`);
                  }
                });
};

module.exports = (data,domain) => {

  writeS3(`account-key.pem`,data.accountKey.privateKeyPem.toString());
  writeS3(`${domain}-key.pem`,data.certKey.privateKeyPem.toString());
  writeS3(`${domain}.pem`,data.certPem);

};
