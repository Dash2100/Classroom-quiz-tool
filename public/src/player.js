let socket = io();
let game_code = null;
let player_name = null;
let player_named = false;

//socket connected
socket.on('connect', function () {
    console.log("socket io connected");
    $('#connecting').hide();
    $('#not_connected').show();
});

//socket connection lost
socket.on('disconnect', function () {
    console.log("socket io disconnected");
    $('#not_connected').hide();
    $('#connecting').show();
});

const socker_connection = (game_code) => {
    $('#not_connected').hide();
    $('#connected').show();

    // listen on game event socket
    socket.on('game_' + game_code, function (data) {
        console.log(data)

        if (data.event === 'player_join') {
            if (data.player_name === player_name) {
                player_named = true;
                join_game_event();
            }
        }

        if (data.event === 'game_start') {
            $("#quque").hide();
            $("#waiting").show();
        }

        if (data.event === 'question') {
            let type = data.type;
            let title = data.title;
            let options = data.options;

            if (type === 'question') {
                question(title, options);
            }

            if (type === 'vote') {
                vote(title, options);
            }

            if (type === 'input') {
                inputQuestion(title);
            }
        }

    });

}

function join_game_event() {

    $.ajax({
        url: '/player/getGameDetail/' + game_code,
        type: 'GET',
        success: function (data) {
            console.log(data);
            if (data.game_detail.started) {
                alert('錯誤', '遊戲已經開始', 'error');
            }
            else {
                alert('成功', '加入遊戲成功', 'success');
            }
        }
    });

    UI_joingame();

}

// 防止輸入非數字
$('#game_code').on('input', function () {
    this.value = this.value.replace(/[^0-9]/g, '');
});


function joinGame() {
    _game_code = $('#game_code').val();

    if ($('#game_code').val().length !== 6) {
        alert('錯誤', '請輸入正確的遊戲代碼', 'error');
        $('#game_code').val('');
        return;
    }

    // check game_code exists
    const check_data = {
        game_code: _game_code
    };

    // console.log(check_data);

    $.ajax({
        url: '/player/check_code/',
        type: 'POST',
        data: JSON.stringify(check_data),
        contentType: 'application/json',
        success: function (data) {
            if (data.status === "success") {
                // set global game_code
                game_code = _game_code;

                // update UI
                UI_naming();

                // listen on game event socket
                socker_connection(game_code);
            }

            if (data.status === "error") {
                alert('錯誤', '找不到遊戲', 'error');
            }
        }
    });
}

function enter_name() {
    if (player_named) {
        return;
    }

    player_name = $('#player_name').val();

    if (player_name === '') {
        alert('錯誤', '請輸入名稱', 'error');
        return;
    }

    // join game
    const join_data = {
        game_code: game_code,
        player_name: player_name
    };

    socket.emit('join_game', join_data);
}

function UI_naming() {
    $('#current_game_code').text($('#game_code').val());

    $('#join_game_page').addClass('-translate-x-5 opacity-0');

    setTimeout(() => {
        $('#join_game_page').hide();
        $('#naming_page').show();
    }, 300);

    setTimeout(() => {
        $('#naming_page').removeClass('translate-x-5 opacity-0');
    }, 350);
}

function UI_joingame() {
    $('#naming_page').addClass('-translate-x-5 opacity-0');

    setTimeout(() => {
        $('#naming_page').hide();
        $('#qcard').show();
    }, 300);

    setTimeout(() => {
        $('#qcard').removeClass('translate-x-10 opacity-0');
    }, 350);
}

function UI_backToJoinGame() {
    $('#qcard').addClass('translate-x-10 opacity-0');

    setTimeout(() => {
        $('#qcard').hide();
        $('#join_game_page').show();
    }, 300);

    setTimeout(() => {
        $('#join_game_page').removeClass('-translate-x-5 opacity-0');
    }, 350);
}

function toggleDarkmode() {
    // change body data-theme
    if (document.body.getAttribute('data-theme') === 'light') {
        document.body.setAttribute('data-theme', 'dark');
    } else {
        document.body.setAttribute('data-theme', 'light');
    }
}

function alert(title, text, icon) {
    Swal.fire({
        icon: icon,
        title: title,
        text: text,
        heightAuto: false,
        confirmButtonText: '確定',
    })
}

function question(title, options) {
    let question_template = $("#question_template").html();
    question_template = question_template.replace("{title}", title);

    let question_options = JSON.parse(options);
    let len = question_options.length;

    // 將修改後的模板加入到頁面中的某個元素
    $("#main_game_card").html(question_template);

    // Hide all buttons initially
    $("#q1, #q2, #q3, #q4").hide();

    // Loop through the options and set up buttons
    for (let i = 0; i < len; i++) {
        let button = $("#q" + (i + 1)); // Get button by ID
        button.text(question_options[i]); // Set button text to the option
        button.show(); // Make the button visible

        // Example event handler: alert the option when clicked
        button.off('click').on('click', function () {
            alert('You selected: ' + question_options[i]);
        });
    }
}

function vote(title, options) {
    let vote_template = $("#vote_template").html();
    vote_template = vote_template.replace("{title}", title);

    let question_options = JSON.parse(options);
    let len = question_options.length;

    // 將修改後的模板加入到頁面中的某個元素
    $("#main_game_card").html(vote_template);

    // Hide all buttons initially
    $("#q1, #q2, #q3, #q4").hide();

    // Loop through the options and set up buttons
    for (let i = 0; i < len; i++) {
        let button = $("#q" + (i + 1)); // Get button by ID
        button.text(question_options[i]); // Set button text to the option
        button.show(); // Make the button visible

        // Example event handler: alert the option when clicked
        button.off('click').on('click', function () {
            alert('You selected: ' + question_options[i]);
        });
    }
}

function inputQuestion(title) {
    let input_template = $("#input_template").html();
    input_template = input_template.replace("{title}", title);

    // 將修改後的模板加入到頁面中的某個元素
    $("#main_game_card").html(input_template);

    // submit_input
    $("#submit_input").off('click').on('click', function () {
        let inputAns = $("#input_answer").val();
        alert(inputAns);
    });
}