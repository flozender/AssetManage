'use strict';
const shim = require('fabric-shim');
const util = require('util');

async function queryByKey(stub, key) {
  console.log('============= START : queryByKey ===========');
  console.log('##### queryByKey key: ' + key);

  let resultAsBytes = await stub.getState(key);
  if (!resultAsBytes || resultAsBytes.toString().length <= 0) {
    throw new Error('##### queryByKey key: ' + key + ' does not exist');
  }
  console.log('##### queryByKey response: ' + resultAsBytes);
  console.log('============= END : queryByKey ===========');
  return resultAsBytes;
}

async function queryByString(stub, queryString) {
  console.log('============= START : queryByString ===========');
  console.log('##### queryByString queryString: ' + queryString);

  let docType = '';
  let startKey = '';
  let endKey = '';
  let jsonQueryString = JSON.parse(queryString);
  if (jsonQueryString['selector'] && jsonQueryString['selector']['docType']) {
    docType = jsonQueryString['selector']['docType'];
    if(docType === 'user'){
      startKey = 'U001';
      endKey = 'U9999999999999999999999';
    }else if(docType === 'TDR'){
      startKey = 'A001';
      endKey = 'A99999999999999999999999999999';
    }
  }
  let iterator = await stub.getStateByRange(startKey, endKey);

  // Iterator handling is identical for both CouchDB and LevelDB result sets, with the
  // exception of the filter handling in the commented section below
  let allResults = [];
  while (true) {
    let res = await iterator.next();

    if (res.value && res.value.value.toString()) {
      let jsonRes = {};
      console.log(
        '##### queryByString iterator: ' + res.value.value.toString('utf8')
      );

      jsonRes.Key = res.value.key;
      try {
        jsonRes.Record = JSON.parse(res.value.value.toString('utf8'));
      } catch (err) {
        console.log('##### queryByString error: ' + err);
        jsonRes.Record = res.value.value.toString('utf8');
      }
      // ******************* LevelDB filter handling ******************************************
      // LevelDB: additional code required to filter out records we don't need
      // Check that each filter condition in jsonQueryString can be found in the iterator json
      // If we are using CouchDB, this isn't required as rich query supports selectors
      let jsonRecord = jsonQueryString['selector'];
      //   // If there is only a docType, no need to filter, just return all
      //   console.log(
      //     '##### queryByString jsonRecord - number of JSON keys: ' +
      //       Object.keys(jsonRecord).length
      //   );
      if (Object.keys(jsonRecord).length == 1) {
        allResults.push(jsonRes);
        continue;
      }
      for (var key in jsonRecord) {
        if (key == 'docType') {
          continue;
        }
        console.log(
          '##### queryByString json iterator has key: ' + jsonRes.Record[key]
        );
        if (!(jsonRes.Record[key] && jsonRes.Record[key] == jsonRecord[key])) {
          // we do not want this record as it does not match the filter criteria
          continue;
        }
        allResults.push(jsonRes);
      }
      // ******************* End LevelDB filter handling ******************************************
      // For CouchDB, push all results
      // allResults.push(jsonRes);
    }
    if (res.done) {
      await iterator.close();
      console.log(
        '##### queryByString all results: ' + JSON.stringify(allResults)
      );
      console.log('============= END : queryByString ===========');
      return Buffer.from(JSON.stringify(allResults));
    }
  }
}

/************************************************************************************************
 *
 * CHAINCODE
 *
 ************************************************************************************************/

let Chaincode = class {
  async Init(stub) {
    console.log(
      '=========== Init: Instantiated / Upgraded ngo chaincode ==========='
    );
    return shim.success();
  }
  async Invoke(stub) {
    console.log('============= START : Invoke ===========');
    let ret = stub.getFunctionAndParameters();
    console.log('##### Invoke args: ' + JSON.stringify(ret));
    try {
      let method = this[ret.fcn];
      if (!method) {
        console.error(
          '##### Invoke - error: no chaincode function with name: ' +
            ret.fcn +
            ' found'
        );
        throw new Error(
          'No chaincode function with name: ' + ret.fcn + ' found'
        );
      }
      let response = await method(stub, ret.params);
      console.log('##### Invoke response payload: ' + response);
      return shim.success(response);
    } catch (err) {
      console.log('##### Invoke - error: ' + err);
      return shim.error(err);
    }
  }
  async initLedger(stub, args) {
    console.log('============= START : Initialize Ledger ===========');
    console.log('============= END : Initialize Ledger ===========');
  }

  async addUser(stub, args) {
    console.log('=========== START : addUser ============');
    let marbleState = await stub.getState(args[0]);
    if (marbleState.toString()) {
      throw new Error('This user already exists: ' + args[0]);
    }
    try {
      let user = {};
      user.docType = 'user';
      user.userName = args[1];
      user.address = args[2];
      user.assets = '[]';
      user.assetValue = 0;
      const buffer = Buffer.from(JSON.stringify(user));
      await stub.putState(args[0].toString(), buffer);
    } catch (e) {
      console.log('Error in adding User:' + e);
      return shim.error(e);
    }
    console.log('=========== END : addUser');
  }

  async getAllUsers(stub, args) {
    let queryString = '{"selector": {"docType": "user"}}';
    return queryByString(stub, queryString);
  }

  async getAllTokens(stub, args) {
    let queryString = '{"selector": {"docType": "TDR"}}';
    return queryByString(stub, queryString);
  }


  async getAsset(stub, args) {
    console.log('=========== START : getAsset ============');
    return await queryByKey(stub, args[0].toString());
  }

  async getUser(stub, args) {
    console.log('========== START: get USER ==========');
    return await queryByKey(stub, args[0].toString());
  }

  async changeUserName(stub, args) {
    console.log('========== START: change user name ==========');
    try {
      let user = await queryByKey(stub, args[0].toString());
      user = JSON.parse(user.toString());
      user.userName = args[1];
      const buffer = Buffer.from(JSON.stringify(user));
      await stub.putState(args[0].toString(), buffer);
    } catch (e) {
      console.log('Error in changing user name:' + e);
      return shim.error(e);
    }
    console.log('========== END: change user name ==========');
  }

  // async addAssetToUser(stub, args) {
  //   console.log('========== START: add asset to user ==========');
  //   try {
  //     if (args[2].toString() === 'Admin') {
  //       let asset = await queryByKey(stub, args[0].toString());
  //       let user = await queryByKey(stub, args[1].toString());
  //       user = JSON.parse(user.toString());
  //       asset = JSON.parse(asset.toString());
  //       asset.ownedBy = args[1];
  //       user.assets = JSON.parse(user.assets.toString());
  //       user.assets.push(args[0]);
  //       user.assetValue = user.assetValue + asset.value;
  //       const assetBuffer = Buffer.from(JSON.stringify(asset));
  //       await stub.putState(args[0].toString(), assetBuffer);
  //       const userBuffer = Buffer.from(JSON.stringify(user));
  //       await stub.putState(args[1].toString(), userBuffer);
  //     } else {
  //       throw new Error('Only Admin can add Assets to user');
  //     }
  //   } catch (e) {
  //     console.log('Error in changing user name:' + e);
  //     return shim.error(e);
  //   }
  //   console.log('========== END: add asset to user ==========');
  // }
  async createAsset(stub, args) {
    console.log('=========== START : createAsset ============');
    let marbleState = await stub.getState(args[0]);
    if (marbleState.toString()) {
      throw new Error('This Asset already exists: ' + args[0]);
    }
    try {

        let admin = await stub.getState('Admin');
        admin = JSON.parse(admin.toString());

        let asset = {};
        asset.docType = 'TDR';
        asset.value = eval(args[1]);
        asset.ownedBy = 'Admin';
        
        admin.assets = JSON.parse(JSON.stringify(admin.assets));
        admin.assets.push(args[0]);
        admin.assetValue = eval(admin.assetValue) + eval(asset.value);
        const adminBuffer = Buffer.from(JSON.stringify(admin));
        await stub.putState('Admin', adminBuffer);


        const buffer = Buffer.from(JSON.stringify(asset));
        await stub.putState(args[0].toString(), buffer);

    } catch (e) {
      console.log('Error in creating asset:' + e);
      return shim.error(e);
    }
    console.log('=========== END : createAsset');
  }

  async transferAsset(stub, args) {
    console.log(
      '========== START: transfer asset from user1 to user2 =========='
    );
    //user1 sends the asset to the user2
    try {
      let asset = await stub.getState(args[0]);
      let user1 = await stub.getState(args[1]);
      let user2 = await stub.getState(args[2]);

      asset = JSON.parse(asset.toString());
      user1 = JSON.parse(user1.toString());
      user2 = JSON.parse(user2.toString());
      
      
      if (asset.ownedBy.toString() === args[1].toString()) {
        asset.ownedBy = args[2];
        // user1.assets = JSON.parse(JSON.stringify(user1.assets));
        for (var i = 0; i < user1.assets.length; i++) {
          if (user1.assets[i].toString() === args[0].toString()) {
            user1.assets.splice(i, 1);
          }
        }
        if (user1.assets.length === 0) {
          user1.assets = JSON.stringify(user1.assets);
        }
        user2.assets = JSON.parse(JSON.stringify(user2.assets));
        user2.assets.push(args[0]);
        user1.assetValue = eval(user1.assetValue) - eval(asset.value);
        user2.assetValue = eval(user2.assetValue) + eval(asset.value);
        const user1Buffer = Buffer.from(JSON.stringify(user1));
        await stub.putState(args[1].toString(), user1Buffer);
        const assetBuffer = Buffer.from(JSON.stringify(asset));
        await stub.putState(args[0].toString(), assetBuffer);
        const user2Buffer = Buffer.from(JSON.stringify(user2));
        await stub.putState(args[2].toString(), user2Buffer);
      } else {
        throw new Error('Only the asset owner can transfer the asset');
      }
    } catch (e) {
      console.log('Error in transfer asset:' + e);
      return shim.error(e);
    }
    console.log(
      '========== END: transfer asset from user1 to user2 =========='
    );
  }

  async changeUserAddress(stub, args) {
    console.log('========== START: change user address ==========');
    try {
      let user = await queryByKey(stub, args[0].toString());
      user = JSON.parse(user.toString());
      user.address = args[1];
      const buffer = Buffer.from(JSON.stringify(user));
      await stub.putState(args[0].toString(), buffer);
    } catch (e) {
      console.log('Error in changing user address:' + e);
      return shim.error(e);
    }
    console.log('========== END: change user address ==========');
  }

  async getChannelID(stub) {
    let x = await stub.getChannelID();
    console.log(x);
    return Buffer.from(x.toString());
  }

  async getCreator(stub) {
    let x = await stub.getCreator();
    console.log(x);
    return Buffer.from(x.toString());
  }

  async queryHistoryForKey(stub, args) {
    let historyIterator = await stub.getHistoryForKey(args[0]); //userID
    console.log(
      '##### queryHistoryForKey historyIterator: ' +
        util.inspect(historyIterator)
    );
    let history = [];
    while (true) {
      let historyRecord = await historyIterator.next();
      console.log(
        '##### queryHistoryForKey historyRecord: ' + util.inspect(historyRecord)
      );
      if (historyRecord.value && historyRecord.value.value.toString()) {
        let jsonRes = {};
        console.log(
          '##### queryHistoryForKey historyRecord.value.value: ' +
            historyRecord.value.value.toString('utf8')
        );
        jsonRes.TxId = historyRecord.value.tx_id;
        jsonRes.Timestamp = historyRecord.value.timestamp;
        jsonRes.IsDelete = historyRecord.value.is_delete.toString();
        try {
          jsonRes.Record = JSON.parse(
            historyRecord.value.value.toString('utf8')
          );
        } catch (err) {
          console.log('##### queryHistoryForKey error: ' + err);
          jsonRes.Record = historyRecord.value.value.toString('utf8');
        }
        console.log('##### queryHistoryForKey json: ' + util.inspect(jsonRes));
        history.push(jsonRes);
      }
      if (historyRecord.done) {
        await historyIterator.close();
        console.log(
          '##### queryHistoryForKey all results: ' + JSON.stringify(history)
        );
        console.log('============= END : queryHistoryForKey ===========');
        return Buffer.from(JSON.stringify(history));
      }
    }
  }
};

// Get All Transaction IDs

// Add Get Data for Transaction ID

shim.start(new Chaincode());

// module.exports = {
//   Chaincode
// };
