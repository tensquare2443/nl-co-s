var {User} = require("./../models/user");

var authenticate = (req, res, next) => {
  console.log("x-auth:");
  console.log(req.header("x-auth"));
  var token = req.header("x-auth");

  User.findByToken(token).then((doc) => {
    if (!doc) {return Promise.reject();}

    req.user = doc;
    req.token = token;
    next();
  }).catch((e) => {
    res.status(401).send();
  });
};

module.exports = {authenticate};
