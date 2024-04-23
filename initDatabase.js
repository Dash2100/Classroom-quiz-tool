const sqlite3 = require('sqlite3').verbose();

// Create if 
const db = new sqlite3.Database('./game_data.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the game_data database.');
});

// Games表格
db.run(`CREATE TABLE IF NOT EXISTS Games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_code TEXT NOT NULL UNIQUE,
    Started BOOLEAN NOT NULL DEFAULT 0,
    game_detail TEXT
)`, (err) => {
    if (err) {
        console.error("Error creating Games table", err.message);
    } else {
        console.log("Games table created");
    }
});

// Player_Data表格
db.run(`CREATE TABLE IF NOT EXISTS Player_Data (
    uuid TEXT PRIMARY KEY,
    player_name TEXT NOT NULL,
    game_id INTEGER NOT NULL,
    player_data TEXT NOT NULL,
    score INTEGER,
    FOREIGN KEY(game_id) REFERENCES Games(id)
)`, (err) => {
    if (err) {
        console.error("Error creating Player_Data table", err.message);
    } else {
        console.log("Player_Data table created");
    }
});

db.close((err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Close the database connection.');
});
