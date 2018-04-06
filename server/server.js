const http = require("http");
const querystring = require("querystring");

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const request = require("request");
const rp = require("request-promise");

// const {apiKey} = require("./vars");
var apiKey;
// if (process.env.API_KEY) {
  apiKey = process.env.API_KEY;
// } else {
//   try {
//     apiKey = require('./vars').apiKey;
//   } catch(e) {
//     apiKey = 'invalid';
//   }
// }


const _ = require("lodash");
const moment = require("moment");

var mongoose = require("./db/mongoose");
var {User} = require("./models/user");
var {Occasion} = require("./models/occasion");
var {authenticate} = require("./middleware/authenticate");

var app = express();
var port = process.env.PORT || 3001;

app.use(bodyParser.json());
app.use(cors());

app.post('/attend/view', (req, res) => {
  var name = req.body.business;
  Occasion.find({name}).then((docs) => {
    docs = docs.map((doc) => {
      return {date: doc.date, attending: doc.peopleAttending.length};
    });
    res.send(docs);
  });
});

app.post('/attend/add', authenticate, (req, res) => {
  var userId = req.body.userId;
  var attending = req.body.attending;
  var businessInfo = attending[attending.length-1];
  var businessId = businessInfo.name;
  var date = businessInfo.date;
  var newUser;

  var included = false;
  User.findOne({_id: userId}).then((userDoc) => {
    userDoc.attending.forEach((occasion) => {
      if (occasion.date === date && occasion.name === businessId) {
        included = true;
      }
    });

    if (included === true) {return {included};}
    return User.findOneAndUpdate(
      {_id: userId},
      {$push: {attending: businessInfo}},
      {new: true}
    );
  }).then((userDoc) => {
    if (!userDoc) {return res.status(404).send();}
    if (userDoc.included) {return {included: true};}
    newUser = userDoc;

    return Occasion.findOneAndUpdate(
      {name: businessId, date},
      {$push: {peopleAttending: userId}},
      {new: true}
    );
  }).then((occasionDoc) => {
    if (!occasionDoc) {
      var peopleAttending = [];
      peopleAttending.push(userId);
      var newOccasion = new Occasion({
        name: businessId,
        date,
        peopleAttending
      });
      return newOccasion.save();
    } else if (occasionDoc.included) {
      return {included: true};
    } else {
      return occasionDoc;
    }
  }).then((occasionDoc) => {
    if (occasionDoc.included) {
      return res.send({included: true});
    }
    return res.send({newUser, occasionDoc});
  }).catch((e) => {
    console.log(e);
    res.send(e);
  });;
});

app.post('/attend/remove', authenticate, (req, res) => {
  var _id = req.body.user._id;
  var attending = req.body.user.attending;
  var name = req.body.occasion.name;
  var date = req.body.occasion.date;
  var status;

  User.findOneAndUpdate(
    {_id},
    {$set: {attending}},
    {new: true}
  ).then((userDoc) => {
    return Occasion.findOne({name, date});
  }).then((occasionDoc) => {
    if (occasionDoc.peopleAttending.length === 1) {
      status = 'remove';
      return Occasion.findOneAndRemove({name, date});
    } else {
      status = 'update';
      return Occasion.findOneAndUpdate(
        {name, date},
        {$pull: {peopleAttending: _id}},
        {new: true}
      );
    }
  }).then((occasionDoc) => {
    res.send({status, occasionDoc});
  }).catch((e) => res.status(400).send());

});

app.get('/search', (req, res) => {
  console.log('apiKey: ' + apiKey);
  var url = 'https://api.yelp.com/v3/businesses/search';
  var location = req.query.location;
  var term = "bars";
  var qs = {location, term};
  if (req.query.offset) {
    qs.offset = req.query.offset;
  }
  var method = 'GET';
  var headers = {
    Authorization: `Bearer ${apiKey}`
  };
  var options = {url, qs, method, headers};
  request(options, (error, response, body) => {
    if (error) {res.send(error);}
    let businesses = JSON.parse(body).businesses;

    businesses.forEach((business, index) => {
      let name = business.id;
      let rsvpers = 0;
      Occasion.find({name}).then((occasions) => {
        occasions.forEach((occasion) => {
          rsvpers += occasion.peopleAttending.length;
        });
        business.attenders = rsvpers;
        businesses[index] = business;
        if (index === businesses.length - 1) {
          res.send(businesses);
        }
      }).catch((e) => {
        console.log(e);
      });
    });
  });
});

app.post('/user/submit', (req, res) => {
  var username = req.body.username;
  var password = req.body.password;
  var error = {};

  if (username.replace(/[\W]/g, "") !== username) {
    error.username = 'Username must only contain alphanumeric characters';
  }
  if (username.length < 4 || username.length > 20) {
    error.username = 'Username length must be between 4 and 20 characters';
  }
  if (password.length < 4 || password.length > 20) {
    error.password = 'Password length must be between 4 and 20 characters';
  }

  if (error.username || error.password) {
    return res.send({error});
  }

  var accountCreatedAt = moment().format("x");
  var user = new User({username, password, accountCreatedAt});
  var userDoc;

  user.save().then((doc) => {
    userDoc = doc;
    return user.generateAuthToken();
  }).then((token) => {
    if (error.username || error.password) {
      return res.send({error});
    }

    userDoc = _.pick(userDoc, ['username', 'accountCreatedAt', '_id', 'attending', 'tokens']);
    console.log(token);
    res.header("x-auth", token).send(userDoc);
  }).catch((e) => {
    if (e.code === 11000) {
      error.username = 'Username already in use';
      return res.send({error});
    }
    console.log(e);
    res.send(e);
  });
});

app.post('/user/login', (req, res) => {
  var username = req.body.username;
  var password = req.body.password;

  User.findByCredentials(username, password).then((doc) => {

    return doc.generateAuthToken().then((token) => {
      res.header("x-auth", token).send(doc);
    });

    // res.send(doc);
  }).catch((e) => {
    res.send(e);
  });

  // User.findOne(user).then((doc) => {
  //   res.send(doc);
  // }).catch((e) => {
  //   res.send(e);
  // });
});

app.get('/user/view', authenticate, (req, res) => {
  var _id = req.query._id;

  Occasion.find({peopleAttending: {$all: [_id]}}).then((docs) => {
    if (docs.length === 0) {
      var msg = 'No Upcoming Events';
      console.log({msg});
      res.send({msg});
      return;
    }
    var businesses = [];

    for (let i = 0; i < docs.length; i++) {
      let name = docs[i].name;
      let options = {
        uri: `https://api.yelp.com/v3/businesses/${name}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        json: true
      };
      rp(options).then((response) => {
        let details = _.pick(response, [
          'id',
          'name',
          'image_url',
          'url',
          'review_count',
          'categories',
          'rating',
          'coordinates',
          'price',
          'location',
          'display_phone',
          'phone',
          'distance'
        ]);
        details.date = docs[i].date;
        businesses.push(details);

        if (businesses.length === docs.length) {res.send(businesses);}
      }).catch((e) => {
        console.log(e);
        res.status(400).send();
      });
    }
  }).catch((e) => {
    console.log(e);
    res.status(400).send();
  });
});

app.listen(port, () => {
  console.log(`Server is live on ${port}.`);
});

















//
