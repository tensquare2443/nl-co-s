var mongoose = require("mongoose");
var MongoClient = require('mongodb').MongoClient;

mongoose.Promise = global.Promise;

var databaseUri;
if (process.env.MONGODB_URI) {
  console.log('ENV VAR TRUE');
  databaseUri = process.env.MONGODB_URI;
} else {
  console.log('ENV VAR FALSE');
  databaseUri = 'mongodb://localhost:27017/NLCO';
}

mongoose.connect(databaseUri, {
  useMongoClient: true
});

module.exports = {mongoose};
