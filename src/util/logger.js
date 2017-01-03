// Std. Logging slightly extended


const coloring = (s, color) => {
  let sc;
// check if terminal supports color
  if (!(/^screen|^xterm|^vt100|color|ansi|cygwin|linux/i.test(process.env.TERM)))
  {
    return s;
  }

  switch (color) {
    case 'red':return '\u001b[31m' + s + '\u001b[39m';
    case 'green':return '\u001b[32m' + s + '\u001b[39m';
    case 'yellow':return '\u001b[33m' + s + '\u001b[39m';
    case 'blue':return '\u001b[34m' + s + '\u001b[39m';
    case 'magenta':return '\u001b[35m' + s + '\u001b[39m';
    case 'cyan':return '\u001b[36m' + s + '\u001b[39m';
    case 'grey':return '\u001b[90m' + s + '\u001b[39m';
    default: return s;
  }
};

const logger = (m, color) => {

  const now = new Date().toISOString();
  let message = (Buffer.isBuffer(m)) ? 'Data Type: Buffer' : m;
  message = (typeof message === "object") ? JSON.stringify(message) : message;
  if (color) {
    message = coloring(message,color);
  }
  console.log(`[${now}]: ${message}`);
};

module.exports = logger;
