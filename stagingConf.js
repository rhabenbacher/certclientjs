module.exports = {

    certFor: {
        domain: "yourdomain.com",
        contact: "mailto:admin@yourdomain.com",
        minValidHours: 24 * 88
    },
    certServer: {
        urlDirectory: 'https://acme-staging.api.letsencrypt.org/directory'
  //      urlDirectory: 'https://acme-v01.api.letsencrypt.org/directory'
    },

    httpChallenge: {
      port:80
    },

    authz: {
      pollingIntervalSeconds: 5,
      maxPollingRequests: 5
    },

    certRequestInterval : {
      minutes: 360,
      hours: 0
    },

    logger : {
      writeResHeader: true,
      writeResBody: true,
    },

    storeCertificate: {
      s3Bucket: 'bucket',
      s3AccesskeyId:'access key',
      s3SecretAccessKey:'secret',
    },

    server: {
      httpsPort: 8443                            // port to start the local server after obtaining the certificate
    }
};
