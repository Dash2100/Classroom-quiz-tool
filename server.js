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

//tmp
let tmp = [];

app.use(express.json());
app.use(express.static('public'));
app.use('/scripts', express.static(__dirname + '/node_modules/zepto/dist/'));

// players
app.get('/', (req, res) => {
    // redirect to player page
    res.redirect('/player');
});


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

        if (tmp.includes(player_name)) {
            return;
        }

        console.log('Player ' + player_name + ' joined game ' + game_code);

        console.log(tmp);

        tmp.push(player_name);

        io.emit('game_' + game_code, {
            event: 'player_join',
            player_name: player_name
        });
    });

    socket.on('ticket', (data) => {
        const game_code = data.game_code;
        const player_name = data.player_name;
        const action = data.action;

        if (action === 'ticket') {
            io.emit('game_' + game_code, {
                event: 'ticket',
                player_name: player_name
            });
        }

    });

    socket.on('vote', (data) => {
        const game_code = data.game_code;
        const player_name = data.player_name;
        const option = data.option;

        io.emit('game_' + game_code, {
            event: 'player_vote',
            player_name: player_name,
            option: option
        });
    });

    socket.on('input', (data) => {
        const game_code = data.game_code;
        const player_name = data.player_name;
        const answer = data.answer;

        io.emit('game_' + game_code, {
            event: 'player_input',
            player_name: player_name,
            answer: answer
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

app.get('/player/getGameState/:game_code', (req, res) => {
    const game_code = req.params.game_code;

    // get started or not from database
    db.get(`SELECT * FROM Games WHERE game_code = ?`, [game_code], (err, row) => {
        if (err) {
            return console.error(err.message);
        }

        if (row) {
            res.json({
                status: 'success',
                started: row.Started
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

app.get('/host/view', (req, res) => {
    res.sendFile(__dirname + '/public/host_view.html');
});

app.post('/host/start', (req, res) => {
    const game_code = req.body.game_code;

    db.run(`UPDATE Games SET Started = ? WHERE game_code = ?`, [true, game_code], function (err) {
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

app.post('/host/sendAction', (req, res) => {
    const game_code = req.body.game_code;
    const type = req.body.type;
    const question = req.body.question;

    let options = JSON.stringify(req.body.options);


    if (type === 'input') {
        let state = {
            event: 'question',
            type: type,
            title: question
        }

        io.emit('game_' + game_code, state);
    }

    if (type === 'ticket_event') {
        let state = {
            event: 'question',
            type: 'ticket',
        }

        io.emit('game_' + game_code, state);
    }

    if (type === 'vote') {
        let state = {
            event: 'question',
            type: type,
            title: question,
            options: options
        }

        io.emit('game_' + game_code, state);
    }

    if (type === 'url') {
        let state = {
            event: 'question',
            type: type,
            title: question
        }

        console.log(state)

        io.emit('game_' + game_code, state);
    }

    io.emit('game_' + game_code, {
        event: type,
    });

    // if (state) {
    //     // wrtie to database (game_detail)
    //     db.run(`UPDATE Games SET game_detail = ? WHERE game_code = ?`, [JSON.stringify(state), game_code], function (err) {
    //         if (err) {
    //             return console.log(err.message);
    //         }
    //         console.log(`Game ${game_code} updated`);
    //     });
    // }

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

app.get('/game/getDetail', (req, res) => {

})

// io.on('connection', (socket) => {
//     console.log('a user connected');
// });

server.listen(port, () => {
    console.log("Server is running on http://localhost:" + port);
});