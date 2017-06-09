const mongoose = require('mongoose')

var Poll = mongoose.model('Poll', {
    title: {
        type: String,
        required: true,
        minlength: 2,
        maxlength: 20,
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
        },
        poll_id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        }
    }],
    _creator: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    }
})

module.exports = { Poll }