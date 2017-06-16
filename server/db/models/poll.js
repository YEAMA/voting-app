const mongoose = require('mongoose')

var PollSchema = new mongoose.Schema({
    poll_title: {
        type: String,
        required: true,
        minlength: 10,
        trim: true
    },
    options: [{
        value: {
            type: String,
            required: true
        },
        votes: {
            type: Number,
            default: 0
        }
    }],
    _creator: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    voters: [{
        ip: String
    }]
});

PollSchema.methods.checkUserIP = function(ip) {
    var poll = this;

    for (var i = 0; i < poll.voters.length; i++) {
        if (ip === poll.voters[i].ip) {
            return Promise.resolve({ poll, err: true });
        }
    }
    return Promise.resolve({ poll, err: false });
}

var Poll = mongoose.model('Poll', PollSchema)

module.exports = { Poll }