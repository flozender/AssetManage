const connection = require('./lib/connection');

// getting user details

let client = connection.getClientForOrg(mc1,tayeeb);
console.log(client);