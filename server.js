var express = require('express');
var routes = require('./app/routes/index.js');
var mongoose = require('mongoose');
// var passport = require('passport');
var session = require('express-session');
const hbs = require('hbs');
const { ObjectID } = require('mongodb');
const bodyParser = require('body-parser')

const { Poll } = require('./server/db/models/poll');
const { authObjID } = require('./server/middleware/authObjID');
const { appUser } = require('./server/db/models/appUser')

var app = express();
require('dotenv').load();

// require('./app/config/passport')(passport);

mongoose.connect(process.env.MONGO_URI);
mongoose.Promise = global.Promise;

app.use('/controllers', express.static(process.cwd() + '/app/controllers'));
app.use('/public', express.static(process.cwd() + '/public'));
app.use('/common', express.static(process.cwd() + '/app/common'));

app.use('/css', express.static(process.cwd() + '/public/css'));
app.use('/js', express.static(process.cwd() + '/public/js'));
// app.use('/fonts', express.static(process.cwd() + '/public/fonts'));
// app.use('/img', express.static(process.cwd() + '/public/img'));


app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

hbs.registerPartials(__dirname + '/views/partials');

app.set('view engine', 'hbs');

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

app.use(function(req, res, next) {
    if (req.session.user) {
        res.locals.loggedin = true;
        res.locals.username = req.session.user.name;
    }
    next();
})


// app.dynamicHelpers({
//     username: function(req, res) {
//         if (req.session.user)
//             return req.session.user.name;
//     }
// });

// app.use(passport.initialize());
// app.use(passport.session());

// routes(app, passport);

app.get('/', (req, res) => {
    // var poll = new Poll({
    //     title: "Test",
    //     options: [{
    //         value: "test option1",
    //         votes: 5,
    //         poll_id: "5939d5193fa56a0011f14563"
    //     }],
    //     _creator: "5939d5193fa56a0011f14563"
    // })
    // poll.save()
    //     .then((poll) => console.log(poll))

    Poll.find()
        .then((polls) => {
            res.render('home', {
                title: 'Home',
                polls,
                loggedin: req.session.user,
                message: req.session.message
            });

            req.session.message = null;
        }, (e) => {
            res.status(400).send({
                page: req.url,
                error: 'Couldnot fetch polls' + e
            })
        });
})

// ************************************************************
// *
// *                    POLL SECTION

app.get('/poll/:id', authObjID, (req, res) => {
    var objID = req.params.id;
    var ipaddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    Poll.findById(objID)
        .then((poll) => {
            return poll.checkUserIP(ipaddress)
        })

    .then((response) => {
        var showResults = true;
        if (!response.err)
            showResults = false;

        res.render('poll-it', {
            title: response.poll.poll_title,
            poll_title: response.poll.poll_title,
            options: response.poll.options,
            url: response.poll._id,
            showResults
        })
    })

    .catch((e) => res.status(400).send({
        page: req.url,
        error: 'Couldnot fetch polls: ' + e
    }));
})

app.post('/poll/:id', authObjID, (req, res) => {
    var objID = req.params.id;
    var ipaddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    if (req.body.option === "null") {
        return res.redirect(req.url)
    }

    Poll.findById(objID)

    .then((poll) => {
        return poll.checkUserIP(ipaddress);
    })

    .then((response) => {
        var poll = response.poll;
        if (response.err)
            return Promise.reject({ poll, err: 'voted before' });

        for (var i = 0; i < poll.options.length; i++) {
            if (poll.options[i].value === req.body.option) {
                poll.voters.push({ ip: ipaddress });

                return Poll.findOneAndUpdate({
                    _id: objID,
                    'options.value': poll.options[i].value
                }, {
                    $set: {
                        voters: poll.voters
                    },
                    $inc: {
                        'options.$.votes': 1
                    }
                }, { new: true })
            }
        }

    })

    .then((poll) => {
        if (poll)
            return res.redirect('/poll/' + poll._id)
        else
            return res.status(404).render('404')
    })

    .catch((e) => {
        if (e.err == 'voted before')
            return res.redirect('/poll/' + e.poll._id)
        console.log(e);
        res.status(404).send('<script>alert("' + e + '")</script>')
    })
})


// *            !- END POLL SECTION -!
// *
// ************************************************************

// ************************************************************
// *
// *                SIGN UP SECTION


app.get('/signup', (req, res) => {
    res.render('signing', {
        title: "Sign Up",
        signup: true
    })
})


app.post('/signup', (req, res) => {
    var formData = req.body;

    var user = new appUser({
        name: formData.name,
        email: formData.email,
        password: formData.password
    })

    user.save()

    .then((user) => {
        if (user) {
            req.session.user = user;
            req.session.message = "Signed Up successfully!";
            return res.redirect('/')
        }

        res.render('signing', {
            title: "Sign Up",
            signup: true,
            message: "Error Creating User!"
        })
    })

    .catch((e) => {
        res.status(400).send(e);
    })
})


// *                !- END SIGN UP SECTION -!
// *
// ************************************************************


// ************************************************************
// *
// *                     LOG IN SECTION

app.get('/login', (req, res) => {
    res.render('signing', {
        title: "Login",
        signup: false
    })
})

app.post('/login', (req, res) => {
    var formData = req.body;
    appUser.findByCredentials(formData.email, formData.password)

    .then((user) => {
        if (user) {
            req.session.user = user;
            req.session.message = "Logged in successfully!";
            return res.redirect('/')
        }

        res.render('signing', {
            title: "Login",
            signup: false,
            message: "Error logging in!"
        });
    })

    .catch((e) => {
        res.render('signing', {
            title: "Login",
            signup: false,
            message: e
        });
    })
})

// *                !- END LOG IN SECTION -!
// *
// ************************************************************

app.get('/logout', function(req, res) {
    req.session.destroy(function(err) {
        if (err) {
            console.log(err);
            res.status(500).send(err);
        } else {
            res.redirect('/');
        }
    });

});

// ************************************************************

// FOR DEFAULT 404 PAGE
app.get('*', function(req, res) {
    res.render('404');
});

var port = process.env.PORT || 3000;
app.listen(port, function() {
    console.log('Node.js listening on port ' + port + '...');
});