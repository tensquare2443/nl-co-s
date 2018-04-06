const mongoose = require("mongoose");

var OccasionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  peopleAttending: {
    type: Array
  }
});

var Occasion = mongoose.model("Occasion", OccasionSchema);

module.exports = {Occasion};
