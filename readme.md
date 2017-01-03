# A Let's Encrypt Client built with node.js

It was built with *node.js 6.9.2* and *Express 4* in December 2016. For development I used the [Boulder](https://github.com/letsencrypt/boulder) Server.

![Image of Start Screen](https://cloud.githubusercontent.com/assets/14052089/21606582/cfa0e95e-d1b0-11e6-8763-63f7697eb54d.png)
![Image Screen2](https://cloud.githubusercontent.com/assets/14052089/21616107/8a661168-d1e0-11e6-9c02-be8d174495c2.png)


## About

This (createCertificate.js) is a node.js client for Let's Encrypt to automatize the management of https certificates. It comes with a tiny express.js server (server.js) for demonstration purposes.

It was built with the following design goals in mind:

* Use ES6 Promises and other ES6 features like const, let, etc...
* Store the certificate either on the filesystem or in an AWS S3 bucket
* Dockerize the client and the demo server for simple deployment
* Minimize dependencies to external packages



## Installation

After downloading the package, run:

    npm install .


## Configuration

The configuration is expected to be present in the **NODE_ENV** environment variable.

### There are 3 configuration files included:

* **devConf.js** - pointing to a local Boulder server on port 4000 and storing the certificate in the sub-directory *certificates*
* **testConf.js** - communicating with the staging area of Let's Encrypt and storing the certificate in an s3 bucket
* **prodConf.js** - get the real certificate from Let's Encrypt and store it an s3 bucket


### You have to adapt at least one configuration file

#### Enter your domain and an email contact

    certFor: {
        domain: "dummy.com", // your domain
        contact: "admin@dummy.com", // a valid email address to be contacted by letsencrypt
        ....
    },

#### Configure the directory url of the Let's Encrypt server

    certServer: {
          urlDirectory: 'https://acme-v01.api.letsencrypt.org/directory' // the url of the letsencrypt server to request the directory of all operations
    }


#### Store the certificate as file

    storeCertificate: {
      fileFolder:'./yourfolder'                   // store cert to a local directory - used only if the parameter s3Bucket is not present
    }

#### Alternative: Store the certficate in an AWS S3 bucket

    storeCertificate: {
      s3Bucket: 'your bucket',                    // s3 bucket name
      s3AccesskeyId:'your access key id',         // AWS access key id
      s3SecretAccessKey:'your secret access key' // AWS secret access key
    }

For more details see **Configuration object**



## Start the client locally

    npm run < dev | test | prod >

E.g. To test the certificate client with the staging area of Let's Encrypt, run:

    npm run test



## Spin up the client with Docker  

### build the container

    docker-compose build

### start the client in the container

    docker-compose up -d

The configuration can be set in the Dockerfile

    ...
    CMD ["npm","run","test"]  // "test" is the configuration, File testConf.js is used

### show container logs    

    docker-compose logs


## Overview of the certificate request process

### The certificate is obtained via a series of POST and GET requests to the Let's encrypt server

You get a list of the available operations via sending a **GET directory** to the Let's encrypt server.

As of Jan.2, 2017 you got the following reply in the message body:

    {
      "key-change": "https://acme-v01.api.letsencrypt.org/acme/key-change",
      "new-authz": "https://acme-v01.api.letsencrypt.org/acme/new-authz",
      "new-cert": "https://acme-v01.api.letsencrypt.org/acme/new-cert",
      "new-reg": "https://acme-v01.api.letsencrypt.org/acme/new-reg",
      "revoke-cert": "https://acme-v01.api.letsencrypt.org/acme/revoke-cert"
    }

In the message header a replay nounce is provided which will be used for the next operation.


### All POST requests are signed and contain a replay nounce in the request header


The next operation is **new-reg**.
In addition to the **resource** attribute, which is present in every POST message body, you are sending the contact email address in an array.

Via the **JWS.sign** class method the body is signed.

    const reg_body = JWS.sign({
        "resource": "new-reg",
        "contact": newArray(config.certFor.contact)
    }, data.headers['replay-nonce']);

The body has to be signed in JSON Web Signature format.

> A JSON Web Signature (abbreviated JWS) is an IETF proposed standard for signing arbitrary JSON. This is used as the basis for a variety of web based technologies including JSON Web Token.
>
> Wikipedia

The JWS.sign (./src/crypto/JWS.js) class method uses the account key pair and the nounce to sign the body

    static sign(dataJSON, nonce) {
        return JSON.stringify(RSA.signJws(this.keypair, new Buffer(JSON.stringify(dataJSON)), nonce));
    }

For more details look at    

* [JSON Web Signature](https://tools.ietf.org/html/rfc7515)
* [rsa-compat@npm](https://www.npmjs.com/package/rsa-compat)



### Except for the certificate, which is returned in binary format all response messages are in JSON format

The POST new-reg returns the following message:

    {"id":592910,"key":{"kty":"RSA","n":"sywJCQJyahAFMxrffFpVBdA1Rp6W001uan6KEZ_gDnIh5Z7ZnxVa3T8QzA-lYhPSmfnvsh66jzU8L2WqnHVWe7wd0iusYbvUfUwRpLmzJAGFq-0NVGHL-wsmWBRKFpES-hVeyJw77OzqA2Qr_sBpY7whz1x0sze-Ls69q20n4HfEMQUvk9p9JG4LuWvobb4L4R68LvqsnZKQhrI1c9do7_O4ZvQ10yndsmbYUe06knFGRL-sGjFmDPvrRHZ5SspOVdYucrQjhNAfeJ8N1WMAA070vfTJtSgsgAuidFLjCDqLQbgJjm81Sx9SySVuUav_NyiheEfbeIlOF1wX-PagTQ","e":"AQAB"},"contact":["mailto:contact@yourdomain.com"],"initialIp":"10.10.1.1","createdAt":"2017-01-02T16:16:09.812737123Z","Status":"valid"}

In the header the replay nounce for the next request is provided. If successful, the status is 201.    


### Flow

The flow is synchronized via [ES6 Promises](http://exploringjs.com/es6/ch_promises.html)

#### 1. Generate Account keys

    JWS.genKeys()


#### 2. GET directory - Get a list of operations

    .then(data => initCertRequest(data))

#### 3. POST new-reg - Register the account

    .then(data => newReg(data))


#### 4. POST reg/<id> - Confirm the Terms of Service

    .then(data => confirmTerms(data))


#### 5. POST new-authz - Preauthorize the certificate issuance

    .then(data => newAuthz(data))


#### 6.1. POST challenge/<challenge Url> - Confirm the http Challenge     
#### 6.2. Start an http Server to reply to challenge request from the Let's Encrypt server


    .then(res => httpChallenge(res))


#### 7. GET authz/<id> - Poll the authorization status

    .then(res => authzStatus(res))


#### 8. Generate a new key for the certificate

      JWS.genKeys()


#### 9. Generate a certificate signing request (CSR) for this new key

> In Public Key Infrastructure (PKI) systems, a Certificate Signing Request (also CSR or certification request) is a message sent from an applicant to a Certificate Authority in order to apply for a digital identity certificate. The most common format for CSRs is the PKCS #10 specification and another is the Signed Public Key and Challenge SPKAC format generated by some Web browsers.
>
> Wikipedia

     JWS.generateCsrDerWeb64(keypair, newArray(config.certFor.domain));


#### 10. Post new-cert

    .then((csr) => getNewCert(res,csr))

The respons is in binary format.    


#### 11. Store the certificate and restart the demo server

     storeCertAndRestartServer(certPem);




## Dependencies to external packages


### required by the Let's Encrypt client

* [aws-sdk](https://www.npmjs.com/package/aws-sdk) - to access the AWS s3bucket
* [certpem](https://www.npmjs.com/package/certpem) - get infos from a certificate encoded in the PEM format
* [rsa-compat](https://www.npmjs.com/package/rsa-compat) - handling the cryptography like creating keys, signing messages, etc

### required by the demo server

* [express](http://expressjs.com/) - web framework for node.js  
* [pidusage](https://www.npmjs.com/package/pidusage) - cross platform cpu and memory usage
* [tachyons](http://tachyons.io/) - atomic CSS framework



## Configuration Object

The configuration is a JSON object.

    certFor: {
        domain: "dummy.com", // your domain
        contact: "admin@dummy.com", // a valid email address to be contacted by letsencrypt
        minValidHours: 24 * 88 // When the cert is valid for less time than minValidHours then start to request a new certificate
    },
    certServer: {
          urlDirectory: 'https://acme-v01.api.letsencrypt.org/directory' // the url of the letsencrypt server to request the directory of all operations
    },

    httpChallenge: {
      port:80  // the port where the client is serving the http challenge to the letsencrypt server
    },

    authz: {
      pollingIntervalSeconds: 5, // the polling interval to check if the certificate is ready (added each time to the timeout for the next polling)
      maxPollingRequests: 5 // maximum polling requests
    },

    certRequestInterval : {
      minutes: 360,  // minutes before checking the next time if the certificate is still valid
      hours: 0       // hours before checking the next time if the certificate is still valid
    },               // both parameters are added up

    logger : {
      writeResHeader: true, // write response headers of each http request to the console
      writeResBody: true,   // write response body of each http request to the console
    },

    storeCertificate: {
      s3Bucket: 'your bucket',                    // s3 bucket name
      s3AccesskeyId:'your access key id',         // AWS access key id
      s3SecretAccessKey:'your secret access key', // AWS secret access key
      fileFolder:'./yourfolder'                   // store cert to a local directory - used only if the parameter s3Bucket is not present
    },

    server: {
      httpsPort: 8443                            // port to start the local server after obtaining the certificate
    }
