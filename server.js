var express = require('express');
var routes = require('./app/routes/index.js');
var mongoose = require('mongoose');
// var passport = require('passport');
// var session = require('express-session');
const hbs = require('hbs');


const { Poll } = require('./server/db/models/poll');


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
app.use('/fonts', express.static(process.cwd() + '/public/fonts'));
app.use('/img', express.static(process.cwd() + '/public/img'));


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

    Poll.find()
        .then((polls) => {
            res.render('index', {
                title: 'Home',
                polls
            });
        }, (e) => {
            res.status(400).render('index', {
                title: 'Home',
                error: 'Couldnot fetch polls' + e
            })
        });
})


// FOR DEFAULT 404 PAGE
app.get('*', function(req, res) {
    res.render('404');
});

var port = process.env.PORT || 3000;
app.listen(port, function() {
    console.log('Node.js listening on port ' + port + '...');
});