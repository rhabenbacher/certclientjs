//promisified HTTP request

const logger = require('./logger');


const requestP = ( (options,body,logOptions) => new Promise((resolve,reject) => {
  logger(` --- ${options.method} ${options.path} ---`,'magenta');

  const handleResponse = (res) => {
    let response = {statusCode:res.statusCode,headers:res.headers};
    let rawData;
    logger(`Status: ${res.statusCode}`,'yellow');

    if (logOptions && logOptions.writeResHeader)
    {
      logger(`HEADERS:`,'blue');
      logger(res.headers);
    }
    res.on('data',(chunk)=> rawData = (rawData === undefined) ? chunk : rawData+chunk);
    res.on('end', () => {
      response.data = (res.headers['content-type'].includes('json')) ? JSON.parse(rawData.toString()):rawData;
      if (logOptions && logOptions.writeResHeader)
      {
        logger('DATA:','blue');
        logger(response.data);
      }
      logger(`--- ${options.method} ${options.path} finished ---`,'magenta');
      resolve(response);
    });
  };

  let req = (options.protocol === "https:") ? require('https').request(options,handleResponse) : require('http').request(options,handleResponse);

  req.on('error', (e) => {
   logger(`problem with request: ${e.message}`);
   reject(e);
  });
  if (body) {req.end(body);}
  else req.end();

}));

module.exports = requestP;
