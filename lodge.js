// includes
var sys = require("sys"),
    http = require("http"),
    net = require("net"),
    url = require("url");
    dgram = require('dgram');

// network objects
var syslogclient;

// TCP or UDP, we use a fall back approach and prefer TCP first and then UDP
var udp = false;

// log to local console 
var log = function(content) {
    sys.log(content);
};

// events handling
var EventEmitter = require('events').EventEmitter;
var syslogstart = new EventEmitter();
syslogstart.addListener('start', function() {
    if (syslogclient === undefined || syslogclient.readyState != "open") { 
	       syslogclient = net.createConnection(514, host='127.0.0.1');
       	       log("notice: starting connection to syslog server");
    } else {
       log("notice: syslog server connection already established");
    }

    syslogclient.setNoDelay(noDelay=true);
});

// open the tcp connection to the syslog server
 syslogstart.emit('start');

// handle exceptions for great udp justice
process.addListener("uncaughtException", function (err) {
    log("error: caught an exception - " + err);
    if(err.errno === process.ECONNREFUSED){
       log("Will fall back to utilize the udp socket");
       udp = true;
    }

    if (err.name === "AssertionError") throw err;
    if (++exception_count == 4) process.exit(0);
});

// write event to syslog server 
var forward_event = function(eventstamp, remoteip, content) {
    // craft header
    var header = eventstamp+" "+remoteip+" "+content+"\n";
   
    // Check if we are not using UDP 
    if (!udp) {
        if (syslogclient.readyState === "open") {
            // log("writing to syslog server: " + header.slice(0,80) + "...");
            syslogclient.write(header);
        } else {
            // try to restart the connection, but tell the client to go away
            log("notice: issuing syslog server restart");
            syslogstart.emit('start');
            return -1;
        }
    }	    
    else {
        var client = dgram.createSocket("udp4");
        var message = new Buffer(header);
        client.send(message, 0, message.length, 514,"127.0.0.1",
            function (err, bytes) {
                if (err) {
                    throw err;
                }
                // log("Wrote " + bytes + " bytes to UDP socket.");
                return;
            }
	);
   }
};

// key hash store
var hashes = {}
hashes['d00dadc0ffee'] = {'valid': 'true'};

// server object
lodge = http.createServer(function (request, response) {
    var content = "";
    var remoteip = request.connection.remoteAddress;

    // getting some data
    request.addListener("data", function(chunk) {
        content += chunk;
        if (content.length > 32768) {
            response.writeHead(413, {"Content-Type": "application/json"});
            response.write("{ 'response': 'false', 'message': 'error: oversized event' }\n");
            response.end();
            return;
        }
    });
    request.addListener("end", function() {
        var keyrequest;

        // check path
        pathname = url.parse(request.url, true).pathname; 
        if (pathname.match('/inputs/[a-zA-Z0-9-]+/?') === null) {
            response.writeHead(404, {"Content-Type": "application/json"});
            response.write("{ 'response': 'false', 'message': 'error: method not found' }\n");
            response.end();
            return;
        }
        // check for key
        key = pathname.split('/')[2]; 
        if (key === undefined || key === null || key == '') { 
            response.writeHead(400, {"Content-Type": "application/json"});
            response.write("{ 'response': 'false', 'message': 'error: no input key provided' }\n");
            response.end();
            return;
        } else {
            // check cache for key
            var cachekey = false;
            var valid = false;

            if (hashes[key] === undefined) {
                cachekey = false;
            } else {
                cachekey = true;
            }

            if (cachekey == false) {
                // key not valid 
                if (valid === null || valid === false) {
                    response.writeHead(400, {"Content-Type": "application/json"});
                    response.write("{ 'response': 'false', 'message': 'error: key not validated' }\n");
                    response.end();
		    return;
                } 
            } else {
                // craft a date syslog will recognize  
                var dt = new Date();
                var hours = dt.getHours();
                var minutes = dt.getMinutes();
                var seconds = dt.getSeconds();
                var month = dt.getMonth();
                var day = dt.getDate();
                var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                var eventstamp = months[month] + " " + day + " " + hours + ":" + minutes + ":" + seconds;
                fc = forward_event(eventstamp, remoteip, content);

                // if event wasn't forwarded, warn
                if (fc == -1) {
                    response.writeHead(500, {"Content-Type": "application/json"});
                    response.write("{ 'response': 'false', 'message': 'error: try again later' }\n");
                    response.end();
		    return;
                 }

                // notify user
                response.writeHead(201, {"Content-Type": "application/json"});
                response.write("{ 'response': 'true', 'message': 'info: event received', 'eventstamp': "+eventstamp+"  }\n");
                response.end();
                return;
            }
        }
    });
}).listen(8080);
