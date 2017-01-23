
const logger = require('./util/logger');
const JWS = require('./crypto/JWS');
const http = require('http');
const toPEM = require('./crypto/toPEM');
const requestP = require('./util/requestP');
const https = require('https');
const config = require("./../" + (process.env.NODE_ENV || "devConf"));

let state = {};

const getUserAgent = () => `certclientjs/1.0 nodejs/${process.version}`;

const requestPGet = (url => requestP({
    hostname: require('url').parse(url).hostname,
    port: require('url').parse(url).port,
    protocol: require('url').parse(url).protocol,
    path: require('url').parse(url).path,
    method: 'GET',
    headers: {'User-Agent':getUserAgent()}
}, undefined, config.logger));

const requestPPost = ((url, body) =>
    requestP({
            hostname: require('url').parse(url).hostname,
            port: require('url').parse(url).port,
            protocol: require('url').parse(url).protocol,
            path: require('url').parse(url).path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'User-Agent':getUserAgent()
            }
        },
        body, config.logger));


const httpServerP = (challenge) => new Promise((resolve) => {
// server needed to answer the http challenge
    const challengePath = "/.well-known/acme-challenge/" + challenge.token;
    try {

    const server = http.createServer((req, response) => {
        if (require('url').parse(req.url).pathname === challengePath) {
            logger('HTTP server returning challenge response', 'cyan');
            response.writeHead(200);
            response.end(JWS.getChallengeResponse(challenge.token));
            resolve(server);

        } else {
            response.writeHead(200);
            response.end('Waiting to answer challenge.....');
        }
    });
    server.on('clientError', (err, socket) => {
      logger('Bad Request','red');
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    });

    server.listen(config.httpChallenge.port, ()=>{
      logger('http server waiting for challenge request on port '+config.httpChallenge.port);

    });
  } catch(err) {
    logger('Error creating http server to respond to challenge');
    console.log(err);
    reject(err);
  }

});

const initCertRequest = (data) => {
    state.accountKey = data;
    JWS.setKeypair(data);

    const getDir = (resolve, reject) => {
        logger('GET Dir');
        requestPGet(config.certServer.urlDirectory).then((res) => {
            state.directory = res.data;
            resolve(res);
        }, err => reject(err));
    };

    return new Promise(getDir);
};

const newArray = (element) => {
    let arr = [];
    arr.push(element);
    return arr;
};

const newReg = (data) => {

    const reg_body = JWS.sign({
        "resource": "new-reg",
        "contact": newArray(config.certFor.contact)
    }, data.headers['replay-nonce']);

    return requestPPost(state.directory['new-reg'], reg_body);
};

const getAgreement = (str) => {

    const regEx = /<([^;]+)>;rel=\"([\w\-]+)\"/;
    const strArr = str.split(/\,\s?/);
    let strMap = new Map();
    strArr.forEach(elem => {
        // console.log(elem);
        let strParsed = regEx.exec(elem);
        strMap.set(strParsed[2], strParsed[1]);
    });

    return strMap.get('terms-of-service');
};

const confirmTerms = (data) => {
    const reg_body = JWS.sign({
        "resource": "reg",
        "agreement": getAgreement(data.headers.link)
    }, data.headers['replay-nonce']);
    return requestPPost(data.headers.location, reg_body);
};

const newAuthz = (data) => {
    const authz_body = JWS.sign({
        "resource": "new-authz",
        "identifier": {
            "type": "dns",
            "value": config.certFor.domain
        }
    }, data.headers['replay-nonce']);
    return requestPPost(state.directory['new-authz'], authz_body);
};

const httpChallenge = (res) => {
    logger("Confirm http-01 challenge");
    const challenge = res.data.challenges.filter(entry => (entry.type === 'http-01'))[0];
    const authzUri = res.headers.location;

    const challenge_body = JWS.sign({
        "resource": "challenge",
        "keyAuthorization": JWS.getChallengeResponse(challenge.token)
    }, res.headers['replay-nonce']);
    return new Promise((resolve) => {
// Wait until the challenge confirmation request finished AND the challenge has been requested from the cert Server
        Promise.all([httpServerP(challenge), requestPPost(challenge.uri, challenge_body)])
            .then(([server, res]) => {
              // server is returned by httpServerP, res by requestPPost
                server.close();
                logger('http-01 challenge finished (Promise resolved) - request cert');
                res.challenge = challenge;
                res.authzUri = authzUri;
                resolve(res);
            });

        // httpServerP(challenge)
        // .then(() => requestPPost(challenge.uri, challenge_body))
        // .then((res) => {
        //     res.challenge = challenge;
        //     res.authzUri = authzUri;
        //     resolve(res);
        // });

    });

};


const authzStatus = (res) => {
    const uri = res.authzUri;
    let pollingCounter = 1, pollingTimeout = 0;

    const polling = (resolve, reject) => {
       // polling Timeout is increased every time by polling Interval
        pollingTimeout += config.authz.pollingIntervalSeconds * 1000;
        logger(`Polling the authorization status, run: ${pollingCounter}`);
        requestPGet(uri).then(res => {
            if (res.data.status === "valid") {
                resolve(res);
            } else {
                pollingCounter++;
                if (pollingCounter <= config.authz.maxPollingRequests) {
                    logger(`Waiting ${Math.round(pollingTimeout/1000)} sec for next polling`);
                    setTimeout(polling, pollingTimeout, resolve, reject);
                } else {
                    logger(`Stopped polling the authorization status after ${pollingCounter-1} times`, 'red');
                    reject();
                }
            }

        }, err => {
            logger(`Error polling authorization status: ${err.message}`, 'red');
            reject();
        });
    };
    return new Promise(polling);
};


const newCert = (res, csr) => {
    const cert_body = JWS.sign({
        "resource": "new-cert",
        "csr": csr
    }, res.headers['replay-nonce']);
    return new Promise((resolve, reject) => {
        requestPPost(state.directory['new-cert'], cert_body).then(response => {

            if (response.statusCode === 201) {
                // statusCode 201 shows that cerfificate is available in the response body
                logger('Certificate received!', 'yellow');
                // logger(toPEM(response.data));
                resolve(toPEM(response.data));
            } else {
                reject(response);
            }
        });
    });
};

const getNewCert = (res, csr) => {

    const processing = (resolve, reject) => {
        newCert(res, csr).then(certPem => {
            resolve(certPem);
        }, err => {
            if (err.data.type === "urn:acme:error:unauthorized") {
                logger("Send another new-cert request in 10 sec", 'red');
                setTimeout(() => {
                    newCert(err, csr).then(certPem => {
                      resolve(certPem);
                    }, err => {
                        logger(JSON.stringify(err.data), 'red');
                        reject();
                    });
                }, 10000);
            }
        });
    };

    return new Promise(processing);

};

const createCertificate = (resolve,reject) => {
    // create a new certificate and restart http
    logger('Get a new certificate', 'yellow');
    JWS.genKeys()
      .then(data => initCertRequest(data))
      .then(data => newReg(data))
      .then(data => confirmTerms(data))
      .then(data => newAuthz(data))
      .then(res => httpChallenge(res))
      .then(res => authzStatus(res))
      .then(res => {
          //new keys required to create CSR
          JWS.genKeys()
              .then(keypair => {
                  state.certKey = keypair;
                  return JWS.generateCsrDerWeb64(keypair, newArray(config.certFor.domain));
              })
              .then((csr) => getNewCert(res,csr))
              .then((certPem) => {
                logger('Certficate request process finished.','green');
//                storeCertAndRestartServer(certPem);
                    state.certPem = certPem;
                    resolve(state);
              });
      })
      .catch(err => {
              logger('Could not get certificate!', 'red');
              if (err && err.message) {
                  logger(`Message:${err.message}`, 'red');
                  console.log(err);
              }
              reject(err);
      });
};

module.exports = () => new Promise(createCertificate);
