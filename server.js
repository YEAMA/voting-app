var express = require('express');
var routes = require('./app/routes/index.js');
var mongoose = require('mongoose');
var session = require('express-session');
const hbs = require('hbs');
const { ObjectID } = require('mongodb');
const bodyParser = require('body-parser')

const { Poll } = require('./server/db/models/poll');
const { authObjID } = require('./server/middleware/authObjID');
const { appUser } = require('./server/db/models/appUser')
const { isLoggedin } = require('./server/middleware/isLoggedin')

var app = express();
require('dotenv').load();

const baseURL = "https://fcc-y-voting-app.herokuapp.com";

mongoose.connect(process.env.MONGO_URI);
mongoose.Promise = global.Promise;

app.use('/controllers', express.static(process.cwd() + '/app/controllers'));
app.use('/public', express.static(process.cwd() + '/public'));
app.use('/common', express.static(process.cwd() + '/app/common'));

app.use('/css', express.static(process.cwd() + '/public/css'));
app.use('/js', express.static(process.cwd() + '/public/js'));


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

// For access to data in handlebars templates
app.use(function(req, res, next) {
    if (req.session.user) {
        res.locals.loggedin = true;
        res.locals.username = req.session.user.name;
    }
    next();
})


app.get('/', (req, res) => {

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
                error: 'Couldnot fetch polls: ' + e
            })
        });
})

// ************************************************************
// *
// *                    POLL SECTION

app.get('/poll/new', isLoggedin, (req, res) => {
    res.render('create-edit', {
        title: "Create Poll"
    })
})

app.post('/poll/new', isLoggedin, (req, res) => {
    var title = req.body.poll_title;
    var options = [];
    var patt = new RegExp("poll_option_\w*");

    for (var key in req.body) {
        if (patt.test(key)) {
            options.push({
                value: req.body[key],
                votes: 0
            })
        }
    }

    var poll = new Poll({
        poll_title: title,
        options,
        _creator: req.session.user._id
    });

    poll.save()
        .then((poll) => {
            if (poll)
                return res.redirect('/poll/' + poll._id)
            res.render('404')
        })

    .catch((e) => res.send(e))
})

app.get('/poll/:id', authObjID, (req, res) => {
    var objID = req.params.id;
    var ipaddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    res.locals.myurl = baseURL + req.url;

    Poll.findById(objID)
        .then((poll) => {
            if (poll)
                return poll.checkUserIP(ipaddress)
            return Promise.reject("Not found!");
        })

    .then((response) => {
        response.showResults = true;
        if (!response.err)
            response.showResults = false;

        req.session.results = response;
        return appUser.findById(response.poll._creator)
    })

    .then((user) => {
        var response = req.session.results;
        req.session.results = null;
        var addOption = false;
        if (req.session.user && !response.showResults)
            addOption = true;

        res.render('poll-it', {
            title: response.poll.poll_title,
            poll_title: response.poll.poll_title,
            options: response.poll.options,
            url: response.poll._id,
            creator: user.name,
            showResults: response.showResults,
            addOption
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

    console.log(req.body);

    if (req.body.option === "null" && req.body.action != 'add_option') {
        return res.redirect(req.url)
    }

    Poll.findById(objID)

    .then((poll) => {
        if (poll)
            return poll.checkUserIP(ipaddress);
        return Promise.reject("Not found!");
    })

    .then((response) => {
        var poll = response.poll;
        if (response.err)
            return Promise.reject({ poll, err: 'voted before' });

        poll.voters.push({ ip: ipaddress });


        if (req.body.action == 'add_option') {
            poll.options.push({
                value: req.body.added_option,
                votes: 1
            });

            return Poll.findOneAndUpdate({
                _id: objID
            }, {
                $set: {
                    voters: poll.voters,
                    options: poll.options
                }
            }, { new: true })
        }

        for (var i = 0; i < poll.options.length; i++) {
            if (poll.options[i].value === req.body.option) {

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


app.get('/user/polls', isLoggedin, (req, res) => {
    Poll.find({
            _creator: req.session.user._id
        })
        .then((polls) => {
            res.render('my-polls', {
                title: 'My Polls',
                polls,
                message: req.session.message
            });

            req.session.message = null;
        }, (e) => {
            res.status(400).send({
                page: req.url,
                error: 'Could not fetch polls: ' + e
            })
        });
})

app.get('/poll/delete/:id', isLoggedin, authObjID, (req, res) => {
    var objID = req.params.id;

    Poll.findById(objID)

    .then((poll) => {
        console.log(poll)
        if (poll._creator == req.session.user._id)
            return Poll.findByIdAndRemove(poll._id)
        else
            res.render('404');
    })

    .then((poll) => {
        if (poll)
            return res.redirect('/user/polls')
        res.render('404');
    })

    .catch((e) => res.status(400).send({ e }))
})


// ************************************************************
// *
// *                SIGN UP SECTION


app.get('/signup', (req, res) => {
    if (req.session.user)
        return res.redirect('/');

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

        return Promise.reject("Error logging in!");
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
    if (req.session.user)
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