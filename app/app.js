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

app.listen(3030);
console.log("listening on port 3030");
