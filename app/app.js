const express = require('express');
const request = require('request');
const fs = require('fs');


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
request({
    url: `http://ec2-34-207-167-98.compute-1.amazonaws.com:3000/getUser`,
    json: true
}, (error, response, body)=>{

    fs.writeFileSync("./data/api.json",JSON.stringify(body),'utf8');
});

app.get('/manage', (req,res) => {
    let apidat = JSON.parse(fs.readFileSync('./data/api.json','utf8'));
    res.render('manage'); 
});

app.listen(3030);
console.log("listening on port 3030");
