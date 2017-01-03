//TestConfiguration

module.exports = {

    certFor: {
        domain: "yourdomain.com",
        contact: "mailto:contact@domain.com",
        minValidHours: 22
    },
    certServer: {
        urlDirectory: 'http://localhost:4000/directory',
//        host: "localhost",
//        port: 4000
    },

    httpChallenge: {
      port:5002
    },

    authz: {
      pollingIntervalSeconds: 3,
      maxPollingRequests: 5
    },

    certRequestInterval : {
      minutes: 2,
      hours: 0
    },

    logger : {
      writeResHeader: true,
      writeResBody: true,
    },

    storeCertificate: {
      fileFolder:'./certificates'
    },

    server: {
      httpsPort: 8443                            // port to start the local server after obtaining the certificate
    }


};
