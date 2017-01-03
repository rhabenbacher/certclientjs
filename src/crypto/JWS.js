// JSON Web Signature

const RSA = require('rsa-compat').RSA;
const logger = require('./../util/logger');

class JWS {
    static genKeys() {
        return new Promise(resolve => {
            const bitlen = 2048;
            const exp = 65537;
            const options = {
                public: true,
                pem: true,
                internal: true
            };
            RSA.generateKeypair(bitlen, exp, options, (err, keypair) => {
                logger('New Keypair created');
                resolve(keypair);
            });
        });
    }
    static setKeypair(keypair) {
        this.keypair = keypair;
        //console.log(`Keypair:\n${JSON.stringify(this.keypair)}\n`);
    }
    static sign(dataJSON, nonce) {
        return JSON.stringify(RSA.signJws(this.keypair, new Buffer(JSON.stringify(dataJSON)), nonce));
    }
    static getChallengeResponse(challengeToken) {
        return challengeToken + '.' + RSA.thumbprint(this.keypair);
    }

    static generateCsrDerWeb64(keypair,domainArray) {
      return RSA.generateCsrDerWeb64(keypair, domainArray);
    }
}

module.exports = JWS;
