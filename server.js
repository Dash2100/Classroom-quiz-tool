const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

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
    res.sendFile(__dirname + '/public/game.html');
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

app.get('/player/check_code/:game_code', (req, res) => {
    const game_code = req.params.game_code;

    db.get(`SELECT * FROM Games WHERE game_code = ?`, [game_code], (err, row) => {
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

// hosts
app.get('/host', (req, res) => {
    res.sendFile(__dirname + '/public/host.html');
});

app.post('/host/create', (req, res) => {
    // ```
    // id INTEGER PRIMARY KEY AUTOINCREMENT,
    // game_code TEXT NOT NULL UNIQUE,
    // Started BOOLEAN NOT NULL DEFAULT 0,
    // game_detail TEXT
    // ```

    const game_code = Math.random().toString(36).substring(2, 8);
    let game_detail = [1, 2, 3, 4];

    // insert game to database
    db.run(`INSERT INTO Games (game_code, game_detail) VALUES (?, ?)`, [game_code, JSON.stringify(game_detail)], function (err) {
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

// io.on('connection', (socket) => {
//     console.log('a user connected');
// });

server.listen(port, () => {
    console.log("Server is running on http://localhost:" + port);
});