const mongoose = require('mongoose');
const validator = require('validator');
const _ = require('lodash');
const bcrypt = require('bcryptjs');

var UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 3
    },
    email: {
        type: String,
        required: true,
        trim: true,
        minlength: 5,
        unique: true,
        validate: {
            validator: (value) => {
                return validator.isEmail(value);
            },
            message: '{VALUE} is not a valid email address!'
        }
    },
    password: {
        type: String,
        required: true,
        minlength: [8, 'Password must be at least 8 characters long']
    }
});


UserSchema.pre('save', function(next) {
    var user = this;
    if (user.isModified('password')) {
        var password = user.password;
        var hash = bcrypt.hashSync(password, 10);
        user.password = hash;
    }

    next();
});


UserSchema.methods.toJSON = function() {
    var user = this
    var userObject = user.toObject()

    return _.pick(userObject, ['_id', 'name', 'email'])
};

UserSchema.statics.findByCredentials = function(email, password) {
    var User = this;
    return User.findOne({ email })
        .then((user) => {
            if (user && bcrypt.compareSync(password, user.password))
                return Promise.resolve(user)
            else if (!user)
                return Promise.reject("Email not found")

            return Promise.reject("Email address and password don't match!")
        })
};

var appUser = mongoose.model('appUser', UserSchema);

module.exports = { appUser }