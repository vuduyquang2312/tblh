const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  subject: String,
  period: String,
  room: String,
  day: String,
  time: String,
  method: String
});

const Schedule = mongoose.model('Schedule', scheduleSchema);

module.exports = Schedule;
