//const RSA = require('rsa-compat').RSA;
const logger = require('./src/util/logger');
//const JWS = require('./src/JWS');
const http = require('http');
//const toPEM = require('./src/toPEM');
//const requestP = require('./src/requestP');
const https = require('https');
// const colors = require('colors');
const createCertificate = require('./src/createCertificate');
const saveCertsFile = require('./src/storecert/saveCertificates');
const saveCertsS3 = require('./src/storecert/saveS3certs');
const isCertificateValid = require('./src/isCertificateValid');
const readCertsFile = require('./src/storecert/readCertificates');
const readCertsS3 = require('./src/storecert/readS3certs');

const config = require("./" + (process.env.NODE_ENV || "devConf"));

const express = require('express');
const app = express();
const certpem = require('certpem');
const path = require('path');
const fs = require('fs');

 let state = {};


const httpsServer = (privateKeyPem, certPem) => {
    const options = {
        key: privateKeyPem,
        cert: certPem
    };
    return https.createServer(options, (request, response) => {
        logger('Received https request');
        response.writeHead(200);
        response.end(`<html>
                  <h1>Hello, I am an https server managing certificates on my own!!!!</h1>
                  </html>`);
    }).listen(config.server.httpsPort, () => logger(`Https Server listening on port ${config.server.httpsPort}`, 'green'));

};

const httpsServerExpress = (privateKeyPem, certPem) => {
    const options = {
        key: privateKeyPem,
        cert: certPem
    };
    return https.createServer(options, app).listen(config.server.httpsPort, () => logger(`Https Server listening on port ${config.server.httpsPort}`, 'green'));

};


const restartHttpsServer = (privateKeyPem, certPem) => {

    if (state.httpsServer) {
        logger('Stopping Https Server ....');
        state.httpsServer.close(() => {
            logger('Https Server closed!');
            logger('Now Https Server will be started again ....');
            state.httpsServer = httpsServerExpress(privateKeyPem, certPem);
        });
    } else {
        logger('Starting Https Server for the first time ....');
        state.httpsServer = httpsServerExpress(privateKeyPem, certPem);
    }
};

const saveCertificates = () => {
    if (config.storeCertificate.s3Bucket) {
        saveCertsS3(state, config.certFor.domain);
    } else {
        saveCertsFile(state, config.certFor.domain);
    }
};


const getNewCert = () =>{
  createCertificate().then( success => {
    state.certPem = success.certPem;
    state.accountKey = success.accountKey;
    state.certKey = success.certKey;
    saveCertificates(state, config.certFor.domain);
    restartHttpsServer(state.certKey.privateKeyPem.toString(), state.certPem);
  }, error => {} );

} ;

const getCertIfInvalid = () => {

    if (state.certPem && (isCertificateValid(state.certPem) > config.certFor.minValidHours)) {
        logger(`Certificate valid! Nothing to do ...`);

    } else {
        logger(`Certificate not valid! Create new ...`);
        getNewCert();
    }

};

const readCertificates = () => {
    if (config.storeCertificate.s3Bucket) {
        return Promise.all([readCertsS3.readCert(config.certFor.domain), readCertsS3.readCertKey(config.certFor.domain)])
            .then(([cert, certKey]) => {
                state.certKeyPem = certKey;
                state.certPem = cert;
            });
    } else {
        state.certKeyPem = readCertsFile.readCertKey(config.certFor.domain);
        state.certPem = readCertsFile.readCert(config.certFor.domain);
        return Promise.resolve();
    }
};

// main flow
readCertificates().then(() => {
    if (state.certPem && (isCertificateValid(state.certPem) >= 1)) {
        logger(`Certificate valid! Nothing to do ...`);
        restartHttpsServer(state.certKeyPem, state.certPem);
        // nächsten Check beauftragen
    } else {
        getCertIfInvalid();
    }

    const intervalms = config.certRequestInterval.minutes * 60000 + config.certRequestInterval.hours * 60 * 60000;
    setInterval(getCertIfInvalid, intervalms);
});

const pusage = require('pidusage');

const pustat = () => pusage.stat(process.pid, function(err, stat) {
    logger(`CPU: ${("  "+Math.round(stat.cpu)).slice(-3)} %  Mem:${("   "+Math.round(stat.memory / 1024 / 1024)).slice(-4)} MB`,'cyan');
});

// setInterval(pustat,10000);


app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/img', express.static(path.join(__dirname, 'public/img')));
// app.get('/',(req,res) => {
//   res.end('<html><h1>Hello World from Express https Server</h1></html>');
//
// });

app.engine('html', function (filePath, options, callback) { // define the template engine
  fs.readFile(filePath, function (err, content) {
    if (err) return callback(err);
    // and here starts the rendering
    // data is in the options object

    let rendered = content.toString().replace(/\{\{([\w]+)\}\}/g,(match,prop) => {
      if (options.hasOwnProperty(prop)) {
        return (Date.parse(options[prop])) ? options[prop].toLocaleString():options[prop];
      }
    });

    return callback(null, rendered);
  });
});
app.set('views', './public'); // specify the views directory
app.set('view engine', 'html'); // register the template engine

app.get('/hello', (req,res) => {
  res.type('json');
  res.status(200).json({"name":"Secure Node.js Server"});
});

app.get('/', function (req, res) {
  //logger(`Server Process Id: ${process.pid}`,'blue');
  const certDecoded = certpem.debug(state.certPem);
  const issuer = () => {
    let s = '/';
    certDecoded.issuer.types_and_values.map(val => s = s + val.value.value_block.value + '/');
    return s;
  };
  const certData = {
    // issuer: certDecoded.issuer.types_and_values[0].value.value_block.value,
    issuer : issuer(),
    certValidFrom:certDecoded.notBefore.value,
    certValidTo:certDecoded.notAfter.value

  };
  res.render('index', certData);
});
