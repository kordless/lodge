// includes
var sys = require("sys"),
    http = require("http");

// connection to the lodge server
var localhost = http.createClient(8080, host='localhost');

// log to local console and lodge
log = function(content) {
    sys.log(content);
    localpost = localhost.request('POST', '/inputs/d00dadc0ffee', {'host': 'localhost'});
    localpost.write(content);
    localpost.end();
};

// simple server object
sample = http.createServer(function (request, response) {
    var remoteip = request.connection.remoteAddress;
    // on connection end, log an access-combined like format
    response.writeHead(200, {"Content-Type": "text/html"});
    response.end("howdy partner");
    log(remoteip + ' "GET ' + request.url + '" "' + request.headers['user-agent'] + '"');
}).listen(8081);
