//
// Require iot sdk and file system.
//
var awsIot = require('aws-iot-device-sdk');
var fs = require('fs');

//
// Replace it with your path, client, host, shadow and topic.
//
const KEYPATH = “Your_Private_Key_Path”;
const CERTPATH = "Your_Cert_Key_Path";
const CAPATH = "Your_RootCA_Key_Path";
const CLIENTID = “Your_Client_Id_Defined_By_Yourself”;
const HOST = “AWS_Host_Endpoint”; 
const SHADOW = “Shadow_Name”;
const TOPIC = “Topic_Name”;
const LOGTIME = 10000;

//
// Create a shadow instance
//
var thingShadows = awsIot.thingShadow({
    keyPath: KEYPATH,
    certPath: CERTPATH,
    caPath: CAPATH,
    clientId: CLIENTID,
    host: HOST
});

var clientTokenUpdate;

//
// TODO: Failover log collect
//
var logs = '';
var logsLock = false;

//
// Check if delta state is right.
//
function rgbChecked(deltaState) {
    var allowColor = ["red", "green", "blue"];

    for (var key in deltaState) {
        if (allowColor.indexOf(key) == -1 || deltaState[key] % 1 !== 0 || deltaState[key] > 255 || deltaState[key] < 0)
            return false;
    }

    return true;
}

//
// Simulated we can get recent light state by API or other ways.
// In this demo, we use a json file to record light state.
//
function getLightStateRecently() {
    var file = "./light-state.json";
    var result = JSON.parse(fs.readFileSync(file));

    return [result.state.red, result.state.green, result.state.blue];
}

//
// Simulated we can change recent light state by API or other ways.
//
function changeLightStateRecently(desiredState) {
    var state = {"state": desiredState, "timestamp": (new Date()).valueOf()};
    var file = "./light-state.json";
    var result = JSON.parse(fs.readFileSync(file));
   
    if (!state.state.hasOwnProperty("red")) state.state.red = result.state.red;
    if (!state.state.hasOwnProperty("green")) state.state.green = result.state.green;
    if (!state.state.hasOwnProperty("blue")) state.state.blue = result.state.blue;

    fs.writeFileSync(file, JSON.stringify(state));

    // Although we always get true here, we also need it when we use a really API.
    return true;
}


//
// Publish a topic for recording logs.
// Collect logs and publish them every LOGTIME seconds. It can reduce a vast of cost.
//
setInterval(function() {
    logsLock = true;

	if (logs !== '') {
		var message = logs;
		thingShadows.publish(TOPIC, message);
		logs = '';
	}

	logsLock = false;
}, LOGTIME);

//
// TODO: Improve it.
//
function logEvent(message) {
	if (!logsLock) {
		logs = logs + '\n' + message + ' @timestamp:' + (new Date()).valueOf();
	} else {
		setTimeout(logEvent(message), 500);
	}
}

//
// Print message and log it.
//
function printMessageAndLogIt(message) {
	console.log(message);
	logEvent(message);
}

//
// Handle thingShadows events
//
thingShadows.on('connect', function() {
	printMessageAndLogIt('Shadow connected.');

    // Register the shadow
    thingShadows.register(SHADOW, {}, function() {
        // Get recent light state
        var lightState = null;
        lightState = getLightStateRecently();

        // Update light shadow state
        if (lightState === null) {
            printMessageAndLogIt('Can not get recent light state.');
        } else {
            var lightStateReport = {"state":{"reported":{"red":lightState[0],"green":lightState[1],"blue":lightState[2]}}};
            clientTokenUpdate = thingShadows.update(SHADOW, lightStateReport);

            if (clientTokenUpdate === null) {
                printMessageAndLogIt('Update shadow failed, operation still in progress');
            }
        }
    });
});

//
// Action when thing is on.
//
thingShadows.on('status', function(thingName, stat, clientToken, stateObject) {
    printMessageAndLogIt('Received ' + stat + ' on ' + thingName + ': ' + JSON.stringify(stateObject));
});

thingShadows.on('delta', function(thingName, stateObject) {
    printMessageAndLogIt('Received delta on ' + thingName + ': ' + JSON.stringify(stateObject));

    // Check if delta state is right
    if (rgbChecked(stateObject.state)) {
        if (changeLightStateRecently(stateObject.state)) {
		lightState = getLightStateRecently();
                var lightStateReport = {"state":{"reported":{"red":lightState[0],"green":lightState[1],"blue":lightState[2]}}};
                clientTokenUpdate = thingShadows.update(SHADOW, lightStateReport);

                if (clientTokenUpdate === null) {
                    printMessageAndLogIt('Update shadow failed, operation still in progress');
                }
        } else {
            printMessageAndLogIt('Change light state failure.');
        }
    } else {
        var lightStateDesired = {"state": {"desired": null}};
        clientTokenUpdate = thingShadows.update(SHADOW, lightStateDesired);

        printMessageAndLogIt('Warning! We get a wrong delta value.' + JSON.stringify({"desired": stateObject.state, "timestamp": (new Date()).valueOf()}));

        if (clientTokenUpdate === null) {
            printMessageAndLogIt('Update shadow failed, operation still in progress');
        }
    }
});

thingShadows.on('timeout', function(thingName, clientToken) {
    printMessageAndLogIt('Received timeout on ' + thingName + ' with token: ' + clientToken);
});

thingShadows.on('close', function() {
    printMessageAndLogIt('Closed.');
    thingShadows.unregister(SHADOW);
});

thingShadows.on('reconnect', function() {
    printMessageAndLogIt('Reconnecting...');
});

thingShadows.on('offline', function() {
    printMessageAndLogIt('Offline now. Wait reconnecting.');
});

thingShadows.on('error', function(error) {
    printMessageAndLogIt('Error. ', error);
});

thingShadows.on('message', function(topic, payload) {
    printMessageAndLogIt('Message get.', topic, payload.toString());
});

