var express = require('express');
var routes = require('./app/routes/index.js');
var mongoose = require('mongoose');
// var passport = require('passport');
// var session = require('express-session');
const hbs = require('hbs');
const { ObjectID } = require('mongodb');
const bodyParser = require('body-parser')

const { Poll } = require('./server/db/models/poll');
const { authObjID } = require('./server/middleware/authObjID');

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

// app.use(session({
//     secret: 'secretClementine',
//     resave: false,
//     saveUninitialized: true
// }));

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
                polls
            });
        }, (e) => {
            res.status(400).send({
                page: req.url,
                error: 'Couldnot fetch polls' + e
            })
        });
})

app.get('/poll/:id', authObjID, (req, res) => {
    var objID = req.params.id;
    Poll.findById(objID)
        .then((poll) => {
            res.render('poll-it', {
                title: poll.poll_title,
                poll_title: poll.poll_title,
                options: poll.options,
                url: poll._id
            })
        }, (e) => res.status(400).send({
            page: req.url,
            error: 'Couldnot fetch polls: ' + e
        }));
})

app.post('/poll/:id', authObjID, (req, res) => {
    var objID = req.params.id;

    if (req.body.option === "null") {
        return res.redirect(req.url)
    }

    var ipaddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

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
            return res.render('poll-it', {
                title: poll.poll_title,
                poll_title: poll.poll_title,
                options: poll.options,
                url: poll._id
            })
        else
            return res.status(404).render('404')
    })

    .catch((e) => {
        if (e.err == 'voted before')
            return res.render('poll-it', {
                title: e.poll.poll_title,
                poll_title: e.poll.poll_title,
                options: e.poll.options,
                url: e.poll._id,
                script: 'You have voted on this poll before!'
            });
        console.log(e);
        res.status(404).send('<script>alert("' + e + '")</script>')
    })
})

// FOR DEFAULT 404 PAGE
app.get('*', function(req, res) {
    res.render('404');
});

var port = process.env.PORT || 3000;
app.listen(port, function() {
    console.log('Node.js listening on port ' + port + '...');
});