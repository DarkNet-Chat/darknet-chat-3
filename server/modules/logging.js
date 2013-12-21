var winston = require("winston");

var consoleTransport = new (winston.transports.Console)({ prettyPrint: true, colorize: true, timestamp: true, level: "verbose" });
var mongoTransport = new (require("winston-mongodb").MongoDB)({ db: "DarkNetChat", level: 0 });

var logger = new (winston.Logger)({
        transports: [ consoleTransport, mongoTransport ]
});

var logLevels = {
        levels: {
                verbose: 0,
                info: 1,
                warn: 2,
                debug: 3,
                error: 4,
                exception: 5
        },
        colors: {
                verbose: "green",
                info: "cyan",
                warn: "yellow",
                debug: "purple",
                error: "red",
                exception: "red"
        }
};

logger.setLevels(logLevels.levels);
winston.addColors(logLevels.colors);

exports.verbose = logger.verbose;
exports.info = logger.info;
exports.warn = logger.warn;
exports.debug = logger.debug;
exports.error = logger.error;
exports.exception = logger.exception;
