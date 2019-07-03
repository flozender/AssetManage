const express = require('express');

let app = express();

app.set('view engine', 'ejs');
app.use('/',express.static('public'));

app.get('/', (req,res) => {
    res.render('home');
});

app.get('/marketplace', (req,res) => {
    res.render('marketplace');
});

app.post('/profile', (req,res) => {
    res.render('profile');
});

app.get('/user', (req,res) => {
    res.render('user');
});
app.get('/admin', (req,res) => {
    res.render('admin');
});
app.get('/register', (req,res) => {
    res.render('register');
});
app.get('/manage', (req,res) => {
    res.render('manage');
});






app.listen(3030);
console.log("listening on port 3030");
