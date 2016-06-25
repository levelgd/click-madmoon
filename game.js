//lvlgd
(function game(){
    //
    //РАЗМЕР игрового поля меняется в html файле <canvas width="500" height="500"></canvas> - поле 500 на 500 пикселей.
    //размер можно легко поменять, игра глючить не будет
    //
    //Настройки уровней {очков_для перехода на след:100, награда_за_уничтоженный_кружок:10, минус_за_промах:-1, минус_за_выживший_круг:-10, скорость_спавна_кругов,каждые_n_сек:1}
    //s - сколько очков надо для перехода на следующий уровень
    //a - какое значение прибавляется к очкам на этом уровне
    //m - какое значение отнимается на этом уровне при промахе, должно быть отрицательным (иначе будут прибавляться)
    //l - какое значение отнимается на этом уровне когда круг прожил свой цикл и исчез, должно быть отрицательным
    //st - скорость спавна, где 1 это одна секунда, 0.5 - полсекунды, НЕ должно быть отрицательным
    var levels = [
        {s: 0,        a:100,     m: -20,   l:-30,   st:.6},
        {s: 2000,     a:200,     m: -40,   l:-50,   st:.55},
        {s: 5000,     a:250,     m: -50,   l:-60,   st:.5},
        {s: 10000,    a:300,     m: -70,   l:-80,   st:.48},
        {s: 99999999, a:310,     m: -70,   l:-80,   st:.45}//последнее значение s нужно оставить недостижимым
    ];

    var lifeIcon = "<img src='data/star.png'>"; //иконка "жизней", можно поменять на другой элемент или простой текст вроде var lifeIcon = "*";
    //

    window.requestAnimationFrame = (function () { return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function (callback) { return window.setTimeout(callback, 1000 / 60); }})();
    window.cancelRequestAnimFrame = (function () { return window.cancelRequestAnimationFrame || window.webkitCancelRequestAnimationFrame || window.mozCancelRequestAnimationFrame || window.oCancelRequestAnimationFrame || window.msCancelRequestAnimationFrame || clearTimeout})();

    var canvas = document.querySelector("canvas");
    var context2d = canvas.getContext("2d");

    var hp = 5; //оставшиеся у игрока жизни. Уменьшаются если по кургу в течение его жизни так и не кликнули, восполняются при переходе на след. уровень
    var score = 0; // очки
    var accuracy = 0; var clicks = 0; var hits = 0; //точность попаданий в процентах и переменные для ее расчета
    var level = 1; // текущий уровень

    var scoreE = document.querySelector("#score"); scoreE.innerHTML = "0";
    var accuracyE = document.querySelector("#accuracy"); accuracyE.innerHTML = "100%";
    var levelE = document.querySelector("#level"); levelE.innerHTML  = "1";
    var hpE = document.querySelector("#hp"); hpE.innerHTML = lifeIcon+lifeIcon+lifeIcon+lifeIcon+lifeIcon;

    var GAMESTATE = "load";

    var gameObjects = [];

    var levelCaption = ""; // уведомление о переходе на следующий уровень, сейчас "уровень {level}"

    var spawnTimer = 0; // переменная для спавна кругов.

    var sprites = { // графон. поддерживаются bmp, png, jpg, gif (анимации не будет)
        circle:"data/yoba.png",
        circleDead:"data/yoba_red.png"//,
        //background:"data/putin.jpg" бэкграунд в style.css
    };
    // ! картинку бэкграунда надо менять в файле style.css в параметре background-image: url('data/putin.jpg');

    var sounds = { // звуки, wav, mp3, ogg и т.д.
        click:"data/click.wav",
        badclick:"data/badclick.wav",
        loop:"data/loop.ogg"
    };

    function MissCircle(x,y, color, lifetime){ // Кольцо при промахе или успешном исчезновении круга
        this.x = x; this.y = y; this.radius = 0; this.color = color; this.lifetime = lifetime;
        this.DELETE = false;

        this.update = function (dt) {

            if(this.DELETE) return;

            this.radius += 150 * dt; // кольцо увеличивается в размерах пока не привысит значение this.lifetime, после чего исчезает.

            if(this.radius > this.lifetime) this.DELETE = true;
        };

        this.render = function () {

            if(this.DELETE) return;

            context2d.strokeStyle = this.color;
            context2d.lineWidth = 4;
            context2d.globalAlpha = 1 - (this.radius / this.lifetime);
            context2d.beginPath(); context2d.arc (this.x,this.y,this.radius,0,2*Math.PI); context2d.stroke();
            context2d.globalAlpha = 1;
        }
    }

    function Circle(x, y) { // собственно круги, по которым надо кликать
        this.x = x; this.y = y; this.width = sprites.circle.width; this.height = sprites.circle.height; this.scale = 0.1; this.changeSize = .8;
        this.state = 1; this.type = 0; this.moveX = 0; this.moveY = 0;
        this.DELETE = false;

        //this.scale - начальный масштаб объекта, 1 = нормальный масштаб, 0.5 - половинный, 2 - в 2 раза больше.
        //this.changeSize - скорость изменения масштаба в секунду, например объект увеличится на 0.8 масштаба через секунду
        //this.state - 1 это объект жив и здоров, 2 - помирает.

            this.update = function (dt) {

                if(this.DELETE) return;

                if(this.moveX != 0){
                    this.x += this.moveX * dt;
                }
                if(this.moveY != 0){
                    this.y += this.moveY * dt;
                }

                this.scale += dt * this.changeSize;
                if(this.scale >= .8 && this.changeSize > 0){
                    this.changeSize = -this.changeSize;
                }
                if(this.scale <= 0){
                    if(this.state == 1) {

                        // отнимаем очки и жизни у игрока когда круг исчезает

                        hp--;

                        hpE.innerHTML = "";
                        var hpi = hp;
                        while(hpi-- > 0) hpE.innerHTML += lifeIcon;

                        if(hp <= 0){
                            GAMESTATE = "gameover";
                            spawnTimer = 1;
                        }

                        score += levels[level].l;
                        scoreE.innerHTML = score + "";
                        gameObjects.push(new MissCircle( Math.floor(this.x), Math.floor(this.y),'black',200));
                    }
                    this.DELETE = true;
                }
            };
            this.render = function () {

                if(this.DELETE) return;

                var ws = this.width * this.scale;
                var hs = this.height * this.scale;

                var drawX = Math.floor(this.x - ws / 2);
                var drawY = Math.floor(this.y - hs / 2);

                switch (this.state){
                    case 1:
                        context2d.drawImage(sprites.circle,drawX,drawY, ws, hs);
                        break;
                    case 2:
                        context2d.drawImage(sprites.circleDead,drawX,drawY, ws, hs);
                        break;
                }
            };

            this.mouseTest = function(x,y){ // в момент клика по экрану у всех объектов проверяем, попал ли игрок по нему?

                if(this.DELETE) return false;

                var ws = this.width * this.scale / 2;

                var distX = this.x - x;
                var distY = this.y - y;

                var hit = (distX * distX + distY * distY) < (ws * ws);

                if(hit){ // если попал

                    score += levels[level].a; //прибавляем очки
                    scoreE.innerHTML = score + "";

                    if(score >= levels[level].s) { //проверка достаточно ли очко для перехода на следующий уровень?
                        hp = 5;
                        level++;
                        levelE.innerHTML = level + "";
                        hpE.innerHTML = "";
                        var hpi = hp;
                        while(hpi-- > 0) hpE.innerHTML += lifeIcon;

                        levelCaption = "уровень " + level; // показываем уведомление о новом уровне

                        setTimeout(function(){
                            levelCaption = "";
                        },3000); // через 3 секунды убираем его
                    }

                    this.state = 2;
                    this.changeSize = -3;

                    //Дохлый кружок перемещается по горизонтали или вертикали (направление выбирается рандомно) пока не исчезнет с экрана
                    if(Math.random() >= .5){
                        this.moveX = (Math.random() -.5 > 0) ? 300 : -300;
                    }else{
                        this.moveY = (Math.random() -.5 > 0) ? 300 : -300;
                    }
                }

                return hit;
            }
    }

    var lastUpdate = Date.now();

    window.requestAnimationFrame(main);
    function main(){

        var now = Date.now();
        var deltaTime = (now - lastUpdate) / 1000; // расчет фпс
        lastUpdate = now;

        switch (GAMESTATE) {
            case "load":
                loadSounds(sounds,"");
                loadSprites(sprites,"init");

                GAMESTATE = "loading";
                break;
            case "loading":
                break;

            case "pause":

                context2d.clearRect(0, 0, canvas.width, canvas.height);
                context2d.save();

                context2d.textAlign = "center";
                context2d.font = "bold 24pt monospace";
                context2d.fillStyle = "#ffffff";

                context2d.fillText("НАЧАТЬ ИГРУ",canvas.width/2,canvas.height/2);

                context2d.restore();

                break;

            case "init":

                if(window.chrome) sounds.loop.load();
                sounds.loop.loop = true;
                sounds.loop.volume = 1;
                sounds.loop.currentTime = 0;
                sounds.loop.play();

                canvas.addEventListener('mousedown', mouseDown, false);

                GAMESTATE = "pause";
                break;
            case "gameover":

                if(spawnTimer > 0) spawnTimer -= deltaTime; // страховка чтоб игрок не кликнул по инерции, начав новую игру

                context2d.clearRect(0, 0, canvas.width, canvas.height);
                context2d.save();

                //context2d.drawImage(sprites.background,0,0);

                // внешний вид надписи геймовер
                context2d.textAlign = "center";
                context2d.font = "bold 24pt monospace";
                context2d.fillStyle = "#ffffff";

                context2d.fillText("GAME OVER",canvas.width/2,canvas.height/2);

                context2d.restore();

                break;
            case "run":

                spawnTimer += deltaTime;
                // проверка нужно ли заспавнить новый круг
                if(spawnTimer >= levels[level].st){
                    spawnTimer = 0;
                    gameObjects.push(new Circle(Math.random() * canvas.width,Math.random() * canvas.height));
                }

                var l = gameObjects.length; while(--l > -1) gameObjects[l].update(deltaTime);

                context2d.clearRect(0, 0, canvas.width, canvas.height);
                context2d.save();

                //context2d.drawImage(sprites.background,0,0);

                l = gameObjects.length; while(--l > -1) gameObjects[l].render();

                if(levelCaption.length > 0){
                    context2d.textAlign = "center";
                    context2d.font = "16pt monospace";
                    context2d.fillText(levelCaption,canvas.width/2,canvas.height/2);
                }

                context2d.restore();

                l = gameObjects.length;
                while (--l > -1) {
                    if (gameObjects[l].DELETE) {
                        gameObjects.splice(l,1);
                        l--;
                    }
                }

                break;
        }

        window.requestAnimationFrame(main);
    }

    function mouseDown(e){ // обработка клика

        if(GAMESTATE == "run"){
            clicks++;

            var mx = (e.pageX) - canvas.offsetLeft;
            var my = (e.pageY) - canvas.offsetTop;

            var hit = false;

            var l = gameObjects.length;
            while(--l > -1) {
                if(gameObjects[l].hasOwnProperty("mouseTest") && gameObjects[l].mouseTest(mx,my)){
                    hit = true;
                    break;
                }
            }

            if(!hit){
                gameObjects.push(new MissCircle(mx,my,'red',50));

                score += levels[level].m;
                scoreE.innerHTML = score + "";

                if(window.chrome) sounds.badclick.load();
                sounds.badclick.currentTime = 0;
                sounds.badclick.play();
            }else{
                hits++;

                if(window.chrome) sounds.click.load();
                sounds.click.currentTime = 0;
                sounds.click.play();
            }

            accuracy = Math.round((hits / clicks) * 100);
            accuracyE.innerHTML = accuracy + "%";
        }else if (GAMESTATE == "gameover" && spawnTimer <= 0 ){ // перезапуск игры

            canvas.removeEventListener('mousedown', mouseDown, false); // обязательно
            sounds.loop.pause();

            game();
        }else if (GAMESTATE == "pause"){
            GAMESTATE = "run";
        }
    }

    function loadSounds(sounds,stateWhenLoaded){

        var sds = Object.keys(sounds);
        var count = sds.length;
        var loaded = 0;

        sds.forEach(function(toload){
            sounds[toload] = new Audio(sounds[toload]);
            sounds[toload].volume = .5;
            if(++loaded >= count && stateWhenLoaded) GAMESTATE = stateWhenLoaded;
        });
    }

    function loadSprites(sprites,stateWhenLoaded){

        var sps = Object.keys(sprites);
        var count = sps.length;
        var loaded = 0;

        sps.forEach(function(toload){

            var img = new Image();
            img.src = sprites[toload];

            img.onload = function(){
                sprites[toload] = img;
                if(++loaded >= count && stateWhenLoaded) GAMESTATE = stateWhenLoaded;
            };
        });
    }
})();