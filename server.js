const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { readFileSync } = require('fs');

const app = express();
const port = 3030;

const server = http.createServer(app);

const io = new Server(server);

// sqlite3
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./game_data.db');

app.use(express.json());
app.use(express.static('public'));
app.use('/scripts', express.static(__dirname + '/node_modules/zepto/dist/'));

// players
app.get('/player', (req, res) => {
    res.sendFile(__dirname + '/public/player.html');
});

app.post('/player/identify', (req, res) => {
    const request_data = req.body;

    const player_name = request_data.player_name;
    const game_code = request_data.game_code;

    io.emit('player_join_' + game_code, player_name);

    res.json({
        status: 'success'
    });
});

io.on('connection', (socket) => {

    socket.on('join_game', (data) => {
        const game_code = data.game_code;
        const player_name = data.player_name;

        console.log('Player ' + player_name + ' joined game ' + game_code);

        io.emit('game_' + game_code, {
            event: 'player_join',
            player_name: player_name
        });
    });

});

app.post('/player/check_code', (req, res) => {
    const game_code = req.body.game_code;

    console.log(game_code);

    db.get(`SELECT * FROM Games WHERE game_code = ?`, [game_code], (err, row) => {
        console.log(row);

        if (err) {
            return console.error(err.message);
        }

        if (row) {
            res.json({
                status: 'success',
                game_code: row.game_code
            });
        } else {
            res.json({
                status: 'error',
                message: 'Game not found'
            });
        }
    });

});

app.get('/player/getGameDetail/:game_code', (req, res) => {
    const game_code = req.params.game_code;

    db.get(`SELECT * FROM Games WHERE game_code = ?`, [game_code], (err, row) => {
        if (err) {
            return console.error(err.message);
        }

        if (row) {
            res.json({
                status: 'success',
                game_detail: JSON.parse(row.game_detail)
            });
        } else {
            res.json({
                status: 'error',
                message: 'Game not found'
            });
        }
    });
});

// hosts
app.get('/host', (req, res) => {
    res.sendFile(__dirname + '/public/host.html');
});

app.post('/host/start', (req, res) => {
    const game_code = req.body.game_code;

    db.run(`UPDATE Games SET game_detail = ? WHERE game_code = ?`, [JSON.stringify({ started: true }), game_code], function (err) {
        if (err) {
            return console.log(err.message);
        }
        console.log(`Game ${game_code} started`);
    });

    io.emit('game_' + game_code, {
        event: 'game_start'
    });

    res.json({
        status: 'success'
    });
});

app.post('/host/sendQuestion', (req, res) => {
    const game_code = req.body.game_code;
    const question = req.body.question;

    io.emit('game_' + game_code, {
        event: 'question',
        question: question
    });

    res.json({
        status: 'success'
    });
});

app.post('/host/create', (req, res) => {
    // ```
    // id INTEGER PRIMARY KEY AUTOINCREMENT,
    // game_code TEXT NOT NULL UNIQUE,
    // Started BOOLEAN NOT NULL DEFAULT 0,
    // game_detail TEXT
    // ```

    // gebnerate game code (6 digits)
    const game_code = Math.floor(100000 + Math.random() * 900000);

    // insert game to database
    db.run(`INSERT INTO Games (game_code) VALUES (?)`, [game_code], function (err) {
        if (err) {
            return console.log(err.message);
        }
        console.log(`Game ${game_code} created with id ${this.lastID}`);
    });

    res.json({
        status: 'success',
        game_code: game_code
    });

});

app.post('/host/updateDetail', (req, res) => {
    const game_code = req.body.game_code;
    const game_detail = req.body.game_detail;

    db.run(`UPDATE Games SET game_detail = ? WHERE game_code = ?`, [JSON.stringify(game_detail), game_code], function (err) {
        if (err) {
            return console.log(err.message);
        }
        console.log(`Game ${game_code} updated`);
    });

    res.json({
        status: 'success'
    });
})

app.get('/game/getDetail', (req, res) => {

})

// io.on('connection', (socket) => {
//     console.log('a user connected');
// });

server.listen(port, () => {
    console.log("Server is running on http://localhost:" + port);
});