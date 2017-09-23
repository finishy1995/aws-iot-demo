//
// Instantiate the AWS SDK and configuration objects.  The AWS SDK for 
// JavaScript (aws-sdk) is used for Cognito Identity/Authentication, and 
// the AWS IoT SDK for JavaScript (aws-iot-device-sdk) is used for the
// WebSocket connection to AWS IoT and device shadow APIs.
// 
var AWS = require('aws-sdk');
var AWSIoTData = require('aws-iot-device-sdk');
var AWSConfiguration = require('./aws-configuration.js');
var SmartLight = ['SmartLight1', 'SmartLight2'];
var SmartTemp = ['SmartTemp'];

console.log('Loaded AWS SDK for JavaScript and AWS IoT SDK for Node.js');

//
// Create a client id to use when connecting to AWS IoT.
//
var clientId = 'smart-home-browser-mqtt-' + (Math.floor((Math.random() * 100000) + 1));


//
// Initialize our configuration.
// Due to cn-north-1 BJS, we can not use cognito user pool to make the web more safe.
// Recommend to change the code using cognito with temporary certificate.
//
AWS.config = new AWS.Config({
	"accessKeyId": AWSConfiguration.key,
	"secretAccessKey": AWSConfiguration.secret,
	"region": AWSConfiguration.region
});

//
// Create the AWS IoT device object.  Note that the credentials must be 
// initialized with empty strings; when we successfully authenticate to
// the Cognito Identity Pool, the credentials will be dynamically updated.
//
var client = new AWS.IotData({
	endpoint: AWSConfiguration.host
});


//
// Get thing shadow status
//
function getThingShadowStatus(thingName, thingType) {
	var params = {
		thingName: thingName
	};
	client.getThingShadow(params, function(err, data) {
		if (err) console.log(err, err.stack);
		else {
			console.log(data);
			switch (thingType) {
				case 'Light':
					updateSmartLightStatus(thingName, data);
					break;
				case 'Temp':
					updateSmartTempStatus(thingName, data);
					break;
				default:
					console.log("Invalid thing type.");
			}
		}
	});
}

//
// Get all smart light status
//
function getAllSmartLightStatus() {
	for (var i = 0; i < SmartLight.length; i++)
		getThingShadowStatus(SmartLight[i], 'Light')
}

function getAllSmartTempStatus() {
	for (var i = 0; i < SmartTemp.length; i++) {
		getThingShadowStatus(SmartTemp[i], 'Temp')
	}
}

//
// Get all smart home items status
//
function getAllSmartHomeItemStatus() {
	getAllSmartLightStatus();
	getAllSmartTempStatus();
}

function updateAllSmartTempStatusInTime() {
	setInterval(getAllSmartTempStatus, 2000);
}

//
// Update smart light status in browser
//
function updateSmartLightStatus(thingName, data) {
	var thing = document.getElementById(thingName);
	var shadow = eval('(' + data.payload + ')');	
	if (shadow.state.reported.red != 0) {
		var thingOff = document.getElementById(thingName + 'Off');
		thingOff.innerHTML = '';

		thing.style.backgroundColor = "rgb(" + shadow.state.reported.red + "," + shadow.state.reported.green + "," + shadow.state.reported.blue + ")";
	}
	else {
		var thingOff = document.getElementById(thingName + 'Off');
		thingOff.innerHTML = 'OFF';

		thing.style.backgroundColor = "rgb(255, 255, 255)";
	}

	var thingR = document.getElementById(thingName + 'FormRInput');
	var thingG = document.getElementById(thingName + 'FormGInput');
	var thingB = document.getElementById(thingName + 'FormBInput');
	thingR.value = shadow.state.reported.red;
	thingG.value = shadow.state.reported.green;
	thingB.value = shadow.state.reported.blue;
}

function updateSmartTempStatus(thingName, data) {
	var thing = document.getElementById(thingName + 'Number');
	var shadow = eval('(' + data.payload + ')');

	thing.innerHTML = shadow.state.reported.temperature;
}

closeSmartLight = function (thingId) {
	var shadow = '{"state": {"desired": {"red": 0,"green": 0,"blue": 0}}}';

	var params = {
		payload: shadow,
		thingName: SmartLight[thingId]
	};
	client.updateThingShadow(params, function(err, data) {
		if (err) {
			console.log(err, err.stack);
			alert("发生了一些错误，请稍后重试！");
		}
		else {
			console.log(data);
			alert("操作成功，设备上线后应用。");
		}
	});
}

function checkSmartLightValue(value) {
	if (isNaN(value)) return false;
	if (value < 100) return false;
	if (value > 255) return false;

	return true;
}

changeSmartLightStatus = function(thingId) {
	var valueR = document.getElementById(SmartLight[thingId] + 'FormRInput').value;
	var valueG = document.getElementById(SmartLight[thingId] + 'FormGInput').value;
	var valueB = document.getElementById(SmartLight[thingId] + 'FormBInput').value;

	if (checkSmartLightValue(valueR) && checkSmartLightValue(valueG) && checkSmartLightValue(valueB)) {
		var shadow = '{"state": {"desired": {"red": ' + valueR + ',"green": ' + valueG + ',"blue": ' + valueB + '}}}';

		var params = {
			payload: shadow,
			thingName: SmartLight[thingId]
		};
		client.updateThingShadow(params, function(err, data) {
			if (err) {
				console.log(err, err.stack);
				alert("发生了一些错误，请稍后重试！");
			}
			else {
				console.log(data);
				alert("操作成功，设备上线后应用。");
			}
		});
	} else {
		alert("RGB 支持的区间为100至255，请设置正确的数值。");
	}
}

changeAirCon = function() {
	var message = '{"state": {"temperature": ' + document.getElementById(SmartTemp[0] + 'Number').innerHTML + '}';

	var params = {
		topic: 'airConditioningChange',
		payload: message,
		qos: 0
	};

	client.publish(params, function(err, data) {
		if (err) console.log(err, err.stack);
		else {
			console.log(data);
			alert("操作成功。");
		}
	});
}

updateSmartLightStatusById = function (thingId) {
	getThingShadowStatus(SmartLight[thingId], 'Light');
}

changeSmartTempAutoSpan = function (span) {
	if (span.className == "glyphicon glyphicon-plus SmartTempAutoButton") {
		span.className = "glyphicon glyphicon-minus SmartTempAutoButton";

		document.getElementById('SmartTempAutoOn').style.display = 'block';
		document.getElementById('SmartTempAutoOff').style.display = 'block';
		document.getElementById('SmartTempAutoBtn').style.display = 'block';
	} else {
		span.className = "glyphicon glyphicon-plus SmartTempAutoButton";

		document.getElementById('SmartTempAutoOn').style.display = 'none';
		document.getElementById('SmartTempAutoOff').style.display = 'none';
		document.getElementById('SmartTempAutoBtn').style.display = 'none';
	}
}

getAllSmartHomeItemStatus();
updateAllSmartTempStatusInTime();

