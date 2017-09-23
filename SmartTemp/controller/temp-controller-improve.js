function increaseTemperature() {
	temp = Math.round(100 * (temp + DELTA)) / 100
}

function decreaseTemperature() {
	temp = Math.round(100 * (temp - DELTA)) / 100
}

function getColoredText(a, b) {
	return a < 50 ? b.blue + " (COLD!)".gray : a < 65 ? b.cyan + " (BRISK)".gray : a < 80 ? b.yellow + " (WARM)".gray : b.red + " (HOT!!)".gray
}

function run(a) {
	airConditioningIsOn ? decreaseTemperature() : increaseTemperature();
	var b = JSON.stringify({temperature: temp});
	device.publish(topic, b);
	console.log("Published ".gray + getColoredText(temp, b) + "to AWS IoT.".gray);
}

function reportState() {
	try {
		var a = {
			state: {
				reported: {
					airConditioningIsOn: airConditioningIsOn,
					temperature: temp
				}
			}
		},
		b = device.update(config.app.thingName, a);
		null === b && console.log("ERROR: Reporting state failed, operation still in progress".red);
	} catch(a) {
		console.log("ERROR: Unknown error reporting state.".red);
	}
}

var awsIot = require("aws-iot-device-sdk");
colors = require("colors");
config = require("./device.json");
randomClientId = String(Math.random()).replace(".", "");
sTopic = "airConditioningChange",

device = awsIot.thingShadow({
	keyPath : config.certs.privateKey,
	certPath: config.certs.certificate,
	caPath  : config.certs.rootCA,
	clientId: randomClientId,
	region  : config.region,
	host    : config.host
});

topic = config.topic,
airConditioningIsOn = false,
temp = 45,
DELTA = config.app.delta,
PUBLISH_INTERVAL = config.app.publishInterval,
STATUS_INTERVAL = config.app.statusInterval;

console.log("Connecting to AWS IoT...".blue),

device.on("connect", function() {
	console.log("Connected to AWS IoT.".blue),
	device.register(config.app.thingName),
	device.subscribe(sTopic);
	setInterval(run, PUBLISH_INTERVAL),
	setInterval(reportState, STATUS_INTERVAL)
});

device.on("status", function(a, b, c, d) {
	console.log("Reported current state: ".gray + JSON.stringify(d.state.reported).gray)
});

device.on("delta", function(a, b) {
	try {
		console.log("Reported state different from remote state.".gray);
		b.state.airConditioningIsOn != airConditioningIsOn ?
			(airConditioningIsOn = b.state.airConditioningIsOn, airConditioningIsOn ?
				console.log("Air conditioning is now on.".green):
				console.log("Air conditioning is now off.".red)):
			console.log("No new desired state found.".gray)
		} catch(a) {
			console.log("ERROR setting air conditioner.".red)
		}
	}
);

device.on('message', function(mTopic, payload) {
	console.log(mTopic.gray, payload.toString().red);
	airConditioningIsOn = !airConditioningIsOn;
});
