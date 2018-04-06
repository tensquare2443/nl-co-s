const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

var UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    minLength: 4,
    maxLength: 20
  },
  password: {
    type: String,
    required: true,
    minLength: 4,
    maxLength: 20
  },
  accountCreatedAt: {
    type: Number
  },
  attending: [{
    date: {
      type: String
    },
    name: {
      type: String
    }
  }],
  tokens: [{
    token: {
      type: String,
      required: true
    },
    access: {
      type: String,
      required: true
    }
  }]
});

UserSchema.methods.generateAuthToken = function() {
  var user = this;
  var access = "auth";
  var token = jwt.sign({_id: user._id.toHexString(), access}, 'app_secret').toString();

  user.tokens = [{token, access}];
  return user.save().then(() => {
    return token;
  });
}

UserSchema.statics.findByToken = function(token) {
  var User = this;
  var decoded;

  try {
    decoded = jwt.verify(token, 'app_secret');
  } catch (e) {
    console.log(e);
    return Promise.reject();
  }

  return User.findOne({
    "_id": decoded._id,
    "tokens.token": token,
    "tokens.access": "auth"
  });
};

UserSchema.statics.findByCredentials = function(username, password) {
  var User = this;

  return User.findOne({username}).then((doc) => {
    if (!doc) {return Promise.reject();}

    return new Promise((resolve, reject) => {
      bcrypt.compare(password, doc.password, (err, res) => {
        if (res) {
          resolve(doc);
        } else reject();
      });
    });
  });
};

UserSchema.pre("save", function(next) {
  var user = this;

  if (user.isModified("password")) {
    bcrypt.genSalt(10, (err, salt) => {
      bcrypt.hash(user.password, salt, (err, hash) => {
        user.password = hash;
        next();
      });
    });
  } else {
    next();
  }
});

// UserSchema.path("username").validate(function(username) {
//   return username.length <= 20 && username.length >= 4;
// }, "Username length must be between 4 and 20 characters");
//
// UserSchema.path("password").validate(function(password) {
//   return password.length <= 20 && password.length >= 4;
// }, "Password length must be between 4 and 20 characters");

var User = mongoose.model("User", UserSchema);

module.exports = {User};
