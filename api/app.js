/*
# Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# 
# Licensed under the Apache License, Version 2.0 (the "License").
# You may not use this file except in compliance with the License.
# A copy of the License is located at
# 
#     http://www.apache.org/licenses/LICENSE-2.0
# 
# or in the "license" file accompanying this file. This file is distributed 
# on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either 
# express or implied. See the License for the specific language governing 
# permissions and limitations under the License.
#
*/

'use strict';
var log4js = require('log4js');
log4js.configure({
	appenders: {
	  out: { type: 'stdout' },
	},
	categories: {
	  default: { appenders: ['out'], level: 'info' },
	}
});
var logger = log4js.getLogger('AssetAPI');
const WebSocketServer = require('ws');
var express = require('express');
var bodyParser = require('body-parser');
var http = require('http');
var util = require('util');
var app = express();
var cors = require('cors');
var hfc = require('fabric-client');
const uuidv4 = require('uuid/v4');

var connection = require('./lib/connection.js');
var query = require('./lib/query.js');
var invoke = require('./lib/invoke.js');
var blockListener = require('./lib/blocklistener.js');

hfc.addConfigFile('config.json');
var host = 'localhost';
var port = 3000;
var username = "tayeeb";
var orgName = "mc1";
var channelName = hfc.getConfigSetting('channelName');
var chaincodeName = hfc.getConfigSetting('chaincodeName');
var peers = hfc.getConfigSetting('peers');
///////////////////////////////////////////////////////////////////////////////
//////////////////////////////// SET CONFIGURATIONS ///////////////////////////
///////////////////////////////////////////////////////////////////////////////
app.options('*', cors());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: false
}));
app.use(function(req, res, next) {
	logger.info(' ##### New request for URL %s',req.originalUrl);
	return next();
});

//wrapper to handle errors thrown by async functions. We can catch all
//errors thrown by async functions in a single place, here in this function,
//rather than having a try-catch in every function below. The 'next' statement
//used here will invoke the error handler function - see the end of this script
const awaitHandler = (fn) => {
	return async (req, res, next) => {
		try {
			await fn(req, res, next)
		} 
		catch (err) {
			next(err)
		}
	}
}

///////////////////////////////////////////////////////////////////////////////
//////////////////////////////// START SERVER /////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
var server = http.createServer(app).listen(port, function() {});
logger.info('****************** SERVER STARTED ************************');
logger.info('***************  Listening on: http://%s:%s  ******************',host,port);
server.timeout = 240000;

function getErrorMessage(field) {
	var response = {
		success: false,
		message: field + ' field is missing or Invalid in the request'
	};
	return response;
}

///////////////////////////////////////////////////////////////////////////////
//////////////////////////////// START WEBSOCKET SERVER ///////////////////////
///////////////////////////////////////////////////////////////////////////////
const wss = new WebSocketServer.Server({ server });
wss.on('connection', function connection(ws) {
	logger.info('****************** WEBSOCKET SERVER - received connection ************************');
	ws.on('message', function incoming(message) {
		console.log('##### Websocket Server received message: %s', message);
	});

	ws.send('something');
});

///////////////////////////////////////////////////////////////////////////////
///////////////////////// REST ENDPOINTS START HERE ///////////////////////////
///////////////////////////////////////////////////////////////////////////////
// Health check - can be called by load balancer to check health of REST API
app.get('/health', awaitHandler(async (req, res) => {
	res.sendStatus(200);
}));

// Register and enroll user. A user must be registered and enrolled before any queries 
// or transactions can be invoked
app.post('/enrollUser', awaitHandler(async (req, res) => {
	logger.info('================ POST on Users');
	username = req.body.username;
	orgName = req.body.orgName;
	logger.info('##### End point : /users');
	logger.info('##### POST on Users- username : ' + username);
	logger.info('##### POST on Users - userorg  : ' + orgName);
	let response = await connection.getRegisteredUser(username, orgName, true);
	logger.info('##### POST on Users - returned from registering the username %s for organization %s', username, orgName);
    logger.info('##### POST on Users - getRegisteredUser response secret %s', response.secret);
    logger.info('##### POST on Users - getRegisteredUser response secret %s', response.message);
    if (response && typeof response !== 'string') {
        logger.info('##### POST on Users - Successfully registered the username %s for organization %s', username, orgName);
		logger.info('##### POST on Users - getRegisteredUser response %s', response);
		// Now that we have a username & org, we can start the block listener
		await blockListener.startBlockListener(channelName, username, orgName, wss);
		res.json(response);
	} else {
		logger.error('##### POST on Users - Failed to register the username %s for organization %s with::%s', username, orgName, response);
		res.json({success: false, message: response});
	}
}));

/************************************************************************************
 * Owner methods
 ************************************************************************************/

// GET Owner
app.get('/getUser', awaitHandler(async (req, res) => {
	logger.info('================ GET on Owner');
	let args = {};
	let fcn = "getAllUsers";

    logger.info('##### GET on Owner - username : ' + username);
	logger.info('##### GET on Owner - userOrg : ' + orgName);
	logger.info('##### GET on Owner - channelName : ' + channelName);
	logger.info('##### GET on Owner - chaincodeName : ' + chaincodeName);
	logger.info('##### GET on Owner - fcn : ' + fcn);
	logger.info('##### GET on Owner - args : ' + JSON.stringify(args));
	logger.info('##### GET on Owner - peers : ' + peers);

    let message = await query.queryChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
 	res.send(message);
}));

// GET a specific Owner
app.get('/getUser/:UserName', awaitHandler(async (req, res) => {
	logger.info('================ GET on Owner by ID');
	logger.info('Owner username : ' + req.params);
	let args = req.params;
	let fcn = "getUser";

    logger.info('##### GET on Owner by username - username : ' + username);
	logger.info('##### GET on Owner by username - userOrg : ' + orgName);
	logger.info('##### GET on Owner by username - channelName : ' + channelName);
	logger.info('##### GET on Owner by username - chaincodeName : ' + chaincodeName);
	logger.info('##### GET on Owner by username - fcn : ' + fcn);
	logger.info('##### GET on Owner by username - args : ' + JSON.stringify(args));
	logger.info('##### GET on Owner by username - peers : ' + peers);

    let message = await query.queryChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
 	res.send(message);
}));

// GET the Transactions for a specific Owner
app.get('/getUser/:UserName/transactions', awaitHandler(async (req, res) => {
	logger.info('================ GET on Transactions for Owner');
	logger.info('Owner username : ' + req.params);
	let args = req.params;
	let fcn = "queryHistoryForKey";

    logger.info('##### GET on Transactions for Owner - username : ' + username);
	logger.info('##### GET on Transactions for Owner - userOrg : ' + orgName);
	logger.info('##### GET on Transactions for Owner - channelName : ' + channelName);
	logger.info('##### GET on Transactions for Owner - chaincodeName : ' + chaincodeName);
	logger.info('##### GET on Transactions for Owner - fcn : ' + fcn);
	logger.info('##### GET on Transactions for Owner - args : ' + JSON.stringify(args));
	logger.info('##### GET on Transactions for Owner - peers : ' + peers);

    let message = await query.queryChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
 	res.send(message);
}));

// POST Owner
app.post('/addUser', awaitHandler(async (req, res) => {
	logger.info('================ POST on Owner');
	var args = req.body;
	var fcn = "addUser";

    logger.info('##### POST on Owner - username : ' + username);
	logger.info('##### POST on Owner - userOrg : ' + orgName);
	logger.info('##### POST on Owner - channelName : ' + channelName);
	logger.info('##### POST on Owner - chaincodeName : ' + chaincodeName);
	logger.info('##### POST on Owner - fcn : ' + fcn);
	logger.info('##### POST on Owner - args : ' + JSON.stringify(args));
	logger.info('##### POST on Owner - peers : ' + peers);

	let message = await invoke.invokeChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
	res.send(message);
}));


/************************************************************************************
 * Asset methods
 ************************************************************************************/

// GET Owner
app.get('/getAsset', awaitHandler(async (req, res) => {
	logger.info('================ GET on Owner');
	let args = {};
	let fcn = "getAllTokens";

    logger.info('##### GET on Asset - username : ' + username);
	logger.info('##### GET on Asset - userOrg : ' + orgName);
	logger.info('##### GET on Asset - channelName : ' + channelName);
	logger.info('##### GET on Asset - chaincodeName : ' + chaincodeName);
	logger.info('##### GET on Asset - fcn : ' + fcn);
	logger.info('##### GET on Asset - args : ' + JSON.stringify(args));
	logger.info('##### GET on Asset - peers : ' + peers);

    let message = await query.queryChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
 	res.send(message);
}));

// GET a specific Owner
app.get('/getAsset/:AssetId', awaitHandler(async (req, res) => {
	logger.info('================ GET on Owner by ID');
	logger.info('Asset username : ' + req.params);
	let args = req.params;
	let fcn = "getAsset";

    logger.info('##### GET on Owner by username - username : ' + username);
	logger.info('##### GET on Owner by username - userOrg : ' + orgName);
	logger.info('##### GET on Owner by username - channelName : ' + channelName);
	logger.info('##### GET on Owner by username - chaincodeName : ' + chaincodeName);
	logger.info('##### GET on Owner by username - fcn : ' + fcn);
	logger.info('##### GET on Owner by username - args : ' + JSON.stringify(args));
	logger.info('##### GET on Owner by username - peers : ' + peers);

    let message = await query.queryChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
 	res.send(message);
}));

// GET the Transactions for a specific Owner
app.get('/getAsset/:AssetId/transactions', awaitHandler(async (req, res) => {
	logger.info('================ GET on Transactions for Owner');
	logger.info('Owner username : ' + req.params);
	let args = req.params;
	let fcn = "queryHistoryForKey";

    logger.info('##### GET on Transactions for Owner - username : ' + username);
	logger.info('##### GET on Transactions for Owner - userOrg : ' + orgName);
	logger.info('##### GET on Transactions for Owner - channelName : ' + channelName);
	logger.info('##### GET on Transactions for Owner - chaincodeName : ' + chaincodeName);
	logger.info('##### GET on Transactions for Owner - fcn : ' + fcn);
	logger.info('##### GET on Transactions for Owner - args : ' + JSON.stringify(args));
	logger.info('##### GET on Transactions for Owner - peers : ' + peers);

    let message = await query.queryChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
 	res.send(message);
}));

// POST Owner
app.post('/createAsset', awaitHandler(async (req, res) => {
	logger.info('================ POST on Owner');
	var args = req.body;
	var fcn = "createAsset";

    logger.info('##### POST on Owner - username : ' + username);
	logger.info('##### POST on Owner - userOrg : ' + orgName);
	logger.info('##### POST on Owner - channelName : ' + channelName);
	logger.info('##### POST on Owner - chaincodeName : ' + chaincodeName);
	logger.info('##### POST on Owner - fcn : ' + fcn);
	logger.info('##### POST on Owner - args : ' + JSON.stringify(args));
	logger.info('##### POST on Owner - peers : ' + peers);

	let message = await invoke.invokeChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
	res.send(message);
}));

/************************************************************************************
 * Transaction methods
 ************************************************************************************/

// GET Transaction
app.get('/transactions', awaitHandler(async (req, res) => {
	logger.info('================ GET on Transaction');
	let args = {};
	let fcn = "getAllTransactions";

    logger.info('##### GET on Transaction - username : ' + username);
	logger.info('##### GET on Transaction - userOrg : ' + orgName);
	logger.info('##### GET on Transaction - channelName : ' + channelName);
	logger.info('##### GET on Transaction - chaincodeName : ' + chaincodeName);
	logger.info('##### GET on Transaction - fcn : ' + fcn);
	logger.info('##### GET on Transaction - args : ' + JSON.stringify(args));
	logger.info('##### GET on Transaction - peers : ' + peers);

    let message = await query.queryChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
 	res.send(message);
}));

// GET a specific Transaction
app.get('/transactions/:transactionId', awaitHandler(async (req, res) => {
	logger.info('================ GET on Transaction by ID');
	logger.info('Transaction ID : ' + req.params);
	let args = req.params;
	let fcn = "getTransactionForId";

    logger.info('##### GET on Transaction - username : ' + username);
	logger.info('##### GET on Transaction - userOrg : ' + orgName);
	logger.info('##### GET on Transaction - channelName : ' + channelName);
	logger.info('##### GET on Transaction - chaincodeName : ' + chaincodeName);
	logger.info('##### GET on Transaction - fcn : ' + fcn);
	logger.info('##### GET on Transaction - args : ' + JSON.stringify(args));
	logger.info('##### GET on Transaction - peers : ' + peers);

    let message = await query.queryChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
 	res.send(message);
}));


// POST Transaction
app.post('/transferAsset', awaitHandler(async (req, res) => {
	logger.info('================ POST on Transaction');
	let assetid = req.body.assetid;
	let senderid = req.body.senderid;
	let receiverid = req.body.receiverid;
	let args = [];
	args.push(assetid);
	args.push(senderid);
	args.push(receiverid);

	var fcn = "transferAsset";

    logger.info('##### POST on Transaction - username : ' + username);
	logger.info('##### POST on Transaction - userOrg : ' + orgName);
	logger.info('##### POST on Transaction - channelName : ' + channelName);
	logger.info('##### POST on Transaction - chaincodeName : ' + chaincodeName);
	logger.info('##### POST on Transaction - fcn : ' + fcn);
	logger.info('##### POST on Transaction - args : ' + JSON.stringify(args));
	logger.info('##### POST on Transaction - peers : ' + peers);

	let message = await invoke.invokeChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
	res.send(message);
}));

/************************************************************************************
 * Blockchain metadata methods
 ************************************************************************************/

// GET details of a blockchain transaction using the record key (i.e. the key used to store the transaction
// in the world state)
app.get('/blockinfos/:docType/keys/:key', awaitHandler(async (req, res) => {
	logger.info('================ GET on blockinfo');
	logger.info('Key is : ' + req.params);
	let args = req.params;
	let fcn = "queryHistoryForKey";
	
	logger.info('##### GET on blockinfo - username : ' + username);
	logger.info('##### GET on blockinfo - userOrg : ' + orgName);
	logger.info('##### GET on blockinfo - channelName : ' + channelName);
	logger.info('##### GET on blockinfo - chaincodeName : ' + chaincodeName);
	logger.info('##### GET on blockinfo - fcn : ' + fcn);
	logger.info('##### GET on blockinfo - args : ' + JSON.stringify(args));
	logger.info('##### GET on blockinfo - peers : ' + peers);

	let history = await query.queryChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
	logger.info('##### GET on blockinfo - queryHistoryForKey : ' + util.inspect(history));
	res.send(history);
}));


/************************************************************************************
 * Error handler
 ************************************************************************************/

app.use(function(error, req, res, next) {
	res.status(500).json({ error: error.toString() });
});

/************************************************************************************
 * MC methods
 ************************************************************************************/

// GET MC
// app.get('/querymcs', awaitHandler(async (req, res) => {
// 	logger.info('================ GET on MC');
// 	let args = {};
// 	let fcn = "queryAllMCs";

//     logger.info('##### GET on MC - username : ' + username);
// 	logger.info('##### GET on MC - userOrg : ' + orgName);
// 	logger.info('##### GET on MC - channelName : ' + channelName);
// 	logger.info('##### GET on MC - chaincodeName : ' + chaincodeName);
// 	logger.info('##### GET on MC - fcn : ' + fcn);
// 	logger.info('##### GET on MC - args : ' + JSON.stringify(args));
// 	logger.info('##### GET on MC - peers : ' + peers);

//     let message = await query.queryChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
//  	res.send(message);
// }));

// GET a specific MC
// app.get('/querymcs/:mcRegistrationNumber', awaitHandler(async (req, res) => {
// 	logger.info('================ GET on MC by ID');
// 	logger.info('MC RegistrationNumber : ' + req.params);
// 	let args = req.params;
// 	let fcn = "queryMC";

//     logger.info('##### GET on MC - username : ' + username);
// 	logger.info('##### GET on MC - userOrg : ' + orgName);
// 	logger.info('##### GET on MC - channelName : ' + channelName);
// 	logger.info('##### GET on MC - chaincodeName : ' + chaincodeName);
// 	logger.info('##### GET on MC - fcn : ' + fcn);
// 	logger.info('##### GET on MC - args : ' + JSON.stringify(args));
// 	logger.info('##### GET on MC - peers : ' + peers);

//     let message = await query.queryChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
//  	res.send(message);
// }));

// GET the Transactions for a specific MC
// app.get('/querymcs/:mcRegistrationNumber/transactions', awaitHandler(async (req, res) => {
// 	logger.info('================ GET on Transactions for MC');
// 	logger.info('MC mcRegistrationNumber : ' + req.params);
// 	let args = req.params;
// 	let fcn = "queryTransactionsForMC";

//     logger.info('##### GET on Transactions for MC - username : ' + username);
// 	logger.info('##### GET on Transactions for MC - userOrg : ' + orgName);
// 	logger.info('##### GET on Transactions for MC - channelName : ' + channelName);
// 	logger.info('##### GET on Transactions for MC - chaincodeName : ' + chaincodeName);
// 	logger.info('##### GET on Transactions for MC - fcn : ' + fcn);
// 	logger.info('##### GET on Transactions for MC - args : ' + JSON.stringify(args));
// 	logger.info('##### GET on Transactions for MC - peers : ' + peers);

//     let message = await query.queryChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
//  	res.send(message);
// }));

// GET the Spend for a specific MC
// app.get('/querymcs/:mcRegistrationNumber/spend', awaitHandler(async (req, res) => {
// 	logger.info('================ GET on Spend for MC');
// 	logger.info('MC mcRegistrationNumber : ' + req.params);
// 	let args = req.params;
// 	let fcn = "querySpendForMC";

//     logger.info('##### GET on Spend for MC - username : ' + username);
// 	logger.info('##### GET on Spend for MC - userOrg : ' + orgName);
// 	logger.info('##### GET on Spend for MC - channelName : ' + channelName);
// 	logger.info('##### GET on Spend for MC - chaincodeName : ' + chaincodeName);
// 	logger.info('##### GET on Spend for MC - fcn : ' + fcn);
// 	logger.info('##### GET on Spend for MC - args : ' + JSON.stringify(args));
// 	logger.info('##### GET on Spend for MC - peers : ' + peers);

//     let message = await query.queryChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
//  	res.send(message);
// }));


// POST MC
// app.post('/mcs', awaitHandler(async (req, res) => {
// 	logger.info('================ POST on MC');
// 	var args = req.body;
// 	var fcn = "createMC";

//     logger.info('##### POST on MC - username : ' + username);
// 	logger.info('##### POST on MC - userOrg : ' + orgName);
// 	logger.info('##### POST on MC - channelName : ' + channelName);
// 	logger.info('##### POST on MC - chaincodeName : ' + chaincodeName);
// 	logger.info('##### POST on MC - fcn : ' + fcn);
// 	logger.info('##### POST on MC - args : ' + JSON.stringify(args));
// 	logger.info('##### POST on MC - peers : ' + peers);

// 	let message = await invoke.invokeChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
// 	res.send(message);
// }));


// GET the SpendAllocation records for a specific Transaction
// app.get('/transactions/:transactionId/spendallocations', awaitHandler(async (req, res) => {
// 	logger.info('================ GET on SpendAllocation for Transaction');
// 	logger.info('Transaction ID : ' + req.params);
// 	let args = req.params;
// 	let fcn = "querySpendAllocationForTransaction";

//     logger.info('##### GET on SpendAllocation for Transaction - username : ' + username);
// 	logger.info('##### GET on SpendAllocation for Transaction - userOrg : ' + orgName);
// 	logger.info('##### GET on SpendAllocation for Transaction - channelName : ' + channelName);
// 	logger.info('##### GET on SpendAllocation for Transaction - chaincodeName : ' + chaincodeName);
// 	logger.info('##### GET on SpendAllocation for Transaction - fcn : ' + fcn);
// 	logger.info('##### GET on SpendAllocation for Transaction - args : ' + JSON.stringify(args));
// 	logger.info('##### GET on SpendAllocation for Transaction - peers : ' + peers);

//     let message = await query.queryChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
//  	res.send(message);
// }));


/************************************************************************************
 * Spend methods
 ************************************************************************************/

// GET Spend
// app.get('/spend', awaitHandler(async (req, res) => {
// 	logger.info('================ GET on Spend');
// 	let args = {};
// 	let fcn = "queryAllSpend";

//     logger.info('##### GET on Spend - username : ' + username);
// 	logger.info('##### GET on Spend - userOrg : ' + orgName);
// 	logger.info('##### GET on Spend - channelName : ' + channelName);
// 	logger.info('##### GET on Spend - chaincodeName : ' + chaincodeName);
// 	logger.info('##### GET on Spend - fcn : ' + fcn);
// 	logger.info('##### GET on Spend - args : ' + JSON.stringify(args));
// 	logger.info('##### GET on Spend - peers : ' + peers);

//     let message = await query.queryChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
//  	res.send(message);
// }));

// GET a specific Spend
// app.get('/spend/:spendId', awaitHandler(async (req, res) => {
// 	logger.info('================ GET on Spend by ID');
// 	logger.info('Spend ID : ' + req.params);
// 	let args = req.params;
// 	let fcn = "querySpend";

//     logger.info('##### GET on Spend - username : ' + username);
// 	logger.info('##### GET on Spend - userOrg : ' + orgName);
// 	logger.info('##### GET on Spend - channelName : ' + channelName);
// 	logger.info('##### GET on Spend - chaincodeName : ' + chaincodeName);
// 	logger.info('##### GET on Spend - fcn : ' + fcn);
// 	logger.info('##### GET on Spend - args : ' + JSON.stringify(args));
// 	logger.info('##### GET on Spend - peers : ' + peers);

//     let message = await query.queryChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
//  	res.send(message);
// }));

// GET the SpendAllocation records for a specific Spend
// app.get('/spend/:spendId/spendallocations', awaitHandler(async (req, res) => {
// 	logger.info('================ GET on SpendAllocation for Spend');
// 	logger.info('Transaction ID : ' + req.params);
// 	let args = req.params;
// 	let fcn = "querySpendAllocationForSpend";

//     logger.info('##### GET on SpendAllocation for Spend - username : ' + username);
// 	logger.info('##### GET on SpendAllocation for Spend - userOrg : ' + orgName);
// 	logger.info('##### GET on SpendAllocation for Spend - channelName : ' + channelName);
// 	logger.info('##### GET on SpendAllocation for Spend - chaincodeName : ' + chaincodeName);
// 	logger.info('##### GET on SpendAllocation for Spend - fcn : ' + fcn);
// 	logger.info('##### GET on SpendAllocation for Spend - args : ' + JSON.stringify(args));
// 	logger.info('##### GET on SpendAllocation for Spend - peers : ' + peers);

//     let message = await query.queryChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
//  	res.send(message);
// }));


// POST Spend
// app.post('/spend', awaitHandler(async (req, res) => {
// 	logger.info('================ dummySpend');
// 	var args = req.body;
// 	var fcn = "createSpend";

//     logger.info('##### dummySpend - username : ' + username);
// 	logger.info('##### dummySpend - userOrg : ' + orgName);
// 	logger.info('##### dummySpend - channelName : ' + channelName);
// 	logger.info('##### dummySpend - chaincodeName : ' + chaincodeName);
// 	logger.info('##### dummySpend - fcn : ' + fcn);
// 	logger.info('##### dummySpend - args : ' + JSON.stringify(args));
// 	logger.info('##### dummySpend - peers : ' + peers);

// 	let message = await invoke.invokeChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
// 	res.send(message);
// }));

/************************************************************************************
 * SpendAllocation methods
 ************************************************************************************/

// GET all SpendAllocation records
// app.get('/spendallocations', awaitHandler(async (req, res) => {
// 	logger.info('================ GET on spendAllocation');
// 	let args = {};
// 	let fcn = "queryAllSpendAllocations";

// 	logger.info('##### GET on spendAllocationForTransaction - username : ' + username);
// 	logger.info('##### GET on spendAllocationForTransaction - userOrg : ' + orgName);
// 	logger.info('##### GET on spendAllocationForTransaction - channelName : ' + channelName);
// 	logger.info('##### GET on spendAllocationForTransaction - chaincodeName : ' + chaincodeName);
// 	logger.info('##### GET on spendAllocationForTransaction - fcn : ' + fcn);
// 	logger.info('##### GET on spendAllocationForTransaction - args : ' + JSON.stringify(args));
// 	logger.info('##### GET on spendAllocationForTransaction - peers : ' + peers);

// 	let message = await query.queryChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
// 	res.send(message);
// }));

/************************************************************************************
 * Ratings methods
 ************************************************************************************/

 // POST Rating
// app.post('/ratings', awaitHandler(async (req, res) => {
// 	logger.info('================ POST on Ratings');
// 	var args = req.body;
// 	var fcn = "createRating";

//     logger.info('##### POST on Ratings - username : ' + username);
// 	logger.info('##### POST on Ratings - userOrg : ' + orgName);
// 	logger.info('##### POST on Ratings - channelName : ' + channelName);
// 	logger.info('##### POST on Ratings - chaincodeName : ' + chaincodeName);
// 	logger.info('##### POST on Ratings - fcn : ' + fcn);
// 	logger.info('##### POST on Ratings - args : ' + JSON.stringify(args));
// 	logger.info('##### POST on Ratings - peers : ' + peers);

// 	let message = await invoke.invokeChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
// 	res.send(message);
// }));

// // GET a specific Rating
// app.get('/ratings/:mcRegistrationNumber/:ownerUserName', awaitHandler(async (req, res) => {
// 	logger.info('================ GET on Rating by ID');
// 	logger.info('Rating ID : ' + util.inspect(req.params));
// 	let args = req.params;
// 	let fcn = "queryOwnerRatingsForMC";

//     logger.info('##### GET on Rating - username : ' + username);
// 	logger.info('##### GET on Rating - userOrg : ' + orgName);
// 	logger.info('##### GET on Rating - channelName : ' + channelName);
// 	logger.info('##### GET on Rating - chaincodeName : ' + chaincodeName);
// 	logger.info('##### GET on Rating - fcn : ' + fcn);
// 	logger.info('##### GET on Rating - args : ' + JSON.stringify(args));
// 	logger.info('##### GET on Rating - peers : ' + peers);

//     let message = await query.queryChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
//  	res.send(message);
// }));



/************************************************************************************
 * Utility function for creating dummy spend records. Mimics the behaviour of an MC
 * spending funds, which are allocated against transactions
 ************************************************************************************/

// async function dummySpend() {
// 	if (!username) {
// 		return;
// 	}
// 	// first, we get a list of transactions and randomly choose one
// 	let args = {};
// 	let fcn = "queryAllTransactions";

//     logger.info('##### dummySpend GET on Transaction - username : ' + username);
// 	logger.info('##### dummySpend GET on Transaction - userOrg : ' + orgName);
// 	logger.info('##### dummySpend GET on Transaction - channelName : ' + channelName);
// 	logger.info('##### dummySpend GET on Transaction - chaincodeName : ' + chaincodeName);
// 	logger.info('##### dummySpend GET on Transaction - fcn : ' + fcn);
// 	logger.info('##### dummySpend GET on Transaction - args : ' + JSON.stringify(args));
// 	logger.info('##### dummySpend GET on Transaction - peers : ' + peers);

// 	let message = await query.queryChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
// 	let len = message.length;
// 	if (len < 1) {
// 		logger.info('##### dummySpend - no transactions available');
// 	}
// 	logger.info('##### dummySpend - number of transaction record: ' + len);
// 	if (len < 1) {
// 		return;
// 	}
// 	let ran = Math.floor(Math.random() * len);
// 	logger.info('##### dummySpend - randomly selected transaction record number: ' + ran);
// 	logger.info('##### dummySpend - randomly selected transaction record: ' + JSON.stringify(message[ran]));
// 	let mc = message[ran]['mcRegistrationNumber'];
// 	logger.info('##### dummySpend - randomly selected mc: ' + mc);

// 	// then we create a spend record for the MC that received the transaction
// 	fcn = "createSpend";
// 	let spendId = uuidv4();
// 	let spendAmt = Math.floor(Math.random() * 100) + 1;

// 	args = {};
// 	args["mcRegistrationNumber"] = mc;
// 	args["spendId"] = spendId;
// 	args["spendDescription"] = "Peter Pipers Poulty Portions for Pets";
// 	args["spendDate"] = "2018-09-20T12:41:59.582Z";
// 	args["spendAmount"] = spendAmt;

// 	logger.info('##### dummySpend - username : ' + username);
// 	logger.info('##### dummySpend - userOrg : ' + orgName);
// 	logger.info('##### dummySpend - channelName : ' + channelName);
// 	logger.info('##### dummySpend - chaincodeName : ' + chaincodeName);
// 	logger.info('##### dummySpend - fcn : ' + fcn);
// 	logger.info('##### dummySpend - args : ' + JSON.stringify(args));
// 	logger.info('##### dummySpend - peers : ' + peers);

// 	message = await invoke.invokeChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
// }

// (function loop() {
//     var rand = Math.round(Math.random() * (20000 - 5000)) + 5000;
//     setTimeout(function() {
// 		dummySpend();
//         loop();  
//     }, rand);
// }());

