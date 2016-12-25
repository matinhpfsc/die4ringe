'use strict'

/*
TODO:
- Dialogs,
- Removing objects from room,
- Adding objects to room,
- Inventory selection,
*/
var commands = [
    {
        pattern: /say\s+"([^"]*)"(\s+in\s+(#[0-9A-F]{6}))?/g,
        func: function(groups) {say(groups[3], groups[1]);}
    }
];

function createTextReader(text) {
    var currentIndex = 0;
    var lines = text.replace(/\r/g, "").split("\n");

    return {
        currentLine: function() {
            return currentIndex < lines.length ? lines[currentIndex] : null;
        },
        nextLine: function() {
            if (currentIndex < lines.length) currentIndex++;
        },
        lastLine: function() {
            if (currentIndex > 0) currentIndex--;
        },
    };
}

function getStatement(reader) {
    var line = reader.currentLine(); 
    var result;
    for (command of commands) {
        result = line.match(command.pattern);
        if (result != null) {
            return function() { command.func(result) };
        }
    }
    return null;
}


function getIndentLevel(line) {
    if (line == null) {
        return -1;
    }
    var regex = /^\s*/g;
    var indent = regex.exec(line);
    if (indent == null) {
        return 0;
    }
    return indent[0].length;
}

function getBlockStatements(reader) {
    var statements = [];
    if (reader.currentLine() == null) {
        return statements;
    }
    var indentLevel = getIndentLevel(reader.currentLine());
    while (indentLevel <= getIndentLevel(reader.currentLine())) {
        statements.push(getStatement(reader));
        reader.nextLine();
    }
    return statements;
}

function getStructure(reader) {
    //Room or event
    reader.currentLine();
}

var commandRules = {
    "Schau an": {
        "küche.Kühlschrank": [
            function() { print("Dies ist ein cooler Kühlschrank.");},
            function() { print("Ok, war ein blöder Spruch.")}
        ],
        "*": [ function() { print("Ich kann nichts besonderes erkennen.") }]
    },
    "Rede mit": {
        "küche.Tisch": [
            function() { print("Ich bin Peter Kowalsky, ein mächtiger Seeräuber.");},
            function() { print("Oh...sieh' mal an! Eine Schatztruhe!");},
            function() { addToInventory("_Schatztruhe_");},
            function() { wait(1); },
            function() { print("Da wollen wir doch gleich mal sehen, was darin ist.");},
            function() { print("Ahh, eine Flasche Brause, eine Brille und ein Fisch.");},
            function() { addToInventory(["_Brauseflasche_", "_Brille_", "_roter Fisch_"]);},
            function() { wait(1); },
            function() { print("Die leere Truhe brauche ich ja dann nicht mehr");},
            function() { removeFromInventory("_Schatztruhe_");}
        ],
        "*": [ function() { print("Ich glaube nicht, dass das funktioniert."); }]
    },
    "Benutze": {
        "küche.Regal": {
            "mit": {
                "küche.Tisch": [function () { print("Was ist das denn für eine blöde Idee?"); }],
                "*": [ function() { print("Ich weiß nicht wie. "); } ]
            }
        },
        "*": [function() { print("Das kann ich nicht benutzen."); } ]
    },
    "Gehe zu": {
        "küche.Tür": [function() { enterRoom("flur"); }],
        "flur.Küche": [function() { enterRoom("küche"); }]
    },
    "Ziehe": {
        "*": [function() { print("Das kann ich nicht bewegen."); } ] 
    },
    "Drücke": {
        "*": [function() { print("Das kann ich nicht bewegen."); } ] 
    },
    "Nimm": {
        "*": [function() { print("Das will ich nicht haben."); } ] 
    },
    "Gib": {
        "*": {
            "an": {
                "*": [function() { print("Nee."); } ] 
            }
        },
    },
    "draw": {
        "küche": [function() { writeDescription("küche", "In einer Ecke gegenüber der _Tür_ steht eine kleine Miniküche mit _Kochfeld_, "
                + "_Spüle_ und _Kühlschrank_. "
                + "In der Ecke gegenüber steht ein Küchenschrank mit "
                + "_Besteck-|Besteckschublade_ und "
                + "_Zubehörschublade_ sowie einem _Regal_ "
                + "für Gläser und Tassen und einem _Geschirrfach_. "
                + "In der Mitte steht ein _Tisch_ mit Stühlen. "
                + "Auf dem Tisch steht eine _Vase_. "
                + "Es ist für eine Person _gedeckt|Teller und Tasse_ worden."); } ],
        "flur": [function() { writeDescription("flur", "Vom Flur aus gelangt man in die _Küche_, das _Schlafzimmer_, das _Bad_ und in eine _Abstellkammer_.") } ]
    }
};

var inventory = [];
var commandParts = ["Gehe zu"];
var steps = [];
var index = 0;
var isRunning = false;

function createGameData(text) {
    var lines = text.match(/[^\r\n]+/g);
    if (lines.length == 0) {
        return [];
    }
    var data = [];
    var currentBlock = {header: null, indentLevel: 0, parent: null};
    var indentLevel;
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        var indentLevel = getIndentLevel(line);
        if (line.endsWith(":")) {
            data.push({header: line, indentLevel: indentLevel, parent: currentBlock});
        }
        else
        {
        }
    }
    return [];
}
    
function wait(seconds) {
    waitDuration = 1000 * seconds;
}

function print(text) {
    var dialogDiv =  document.getElementById('dialog');
    dialogDiv.innerHTML = text;
    waitDuration = 25 * text.length + 2000;
    steps.splice(index, 0, function() { dialogDiv.innerHTML = ""; } );
}

function clearDialog() {
    var dialogDiv =  document.getElementById('dialog');
    dialogDiv.innerHTML = text;
}

function addToInventory(objects) {
    if (!Array.isArray(objects)) {
        objects = [objects]
    }
    for (var i = 0; i < objects.length; i++) {
        inventory.push(objects[i]);
    }
    setInventory();
}

function removeFromInventory(objects) {
    if (!Array.isArray(objects)) {
        objects = [objects]
    }
    for (var i = 0; i < objects.length; i++) {
        inventory.splice(inventory.indexOf(objects[i]), 1);
    }
    setInventory();
}

function setInventory() {
    var inventoryDiv = document.getElementById('inventory');
    inventoryDiv.innerHTML = inventory.map(function(s) { return transform("TODO", s);}).join("<br/>");
    makeObjectChildrenClickable(inventoryDiv);
}

var waitDuration = 0;

function run(instructions) {
    //Save current instruction pointer
    var prevIndex = index;
    var prevInstructions = steps;
    index = 0;
    steps = instructions.concat([function(){
                    //Return to the previous position at the end
                    steps = prevInstructions;
                    index = prevIndex;
                }]);
    if (!isRunning)
    {
        nextStep();
    }
}

function nextStep() {
    isRunning = false;
    if (index < steps.length) {
        var step = steps[index];
        index++;
        waitDuration = 0;
        isRunning = true;
        step();
        setTimeout(nextStep, waitDuration);
    }
}

function transform(roomId, text) {
    return text.replace(/_([^_]+)_/g, function(s, p1) {
        var parts = p1.split("|");
        var id = roomId + "." +  parts[parts.length - 1];
        var name = parts[Math.floor(parts.length / 2)];
        var display = parts[0];

        return "<span id=\"" + id + "\" cname=\"" + name + "\" class=\"object\" >" + display + "</span>";
    });
}

function init() {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            createGameData(this.responseText);
        }
    };
    xhttp.open("GET", "game.json", true);
    xhttp.send();

    var verbDivs = document.getElementsByClassName("verb");
    for (var i = 0; i < verbDivs.length; i++) {
        verbDivs[i].onclick = function(e) {
                                    var text = this.innerHTML;
                                    commandParts = [text];
                                    setCommand();
                                };
    }
    enterRoom("küche");
    clearCommandLine();
}

function writeDescription(name, text) {
    var roomDiv = document.getElementById("room");
    roomDiv.innerHTML = transform(name, text);
    makeObjectChildrenClickable(roomDiv);
}

function enterRoom(name) {
    if ("draw" in commandRules) {
        var d = commandRules["draw"];
        if (name in d) {
            d = d[name];
            if (Array.isArray(d)) {
                run(d);
            }
        }
    }
}

function makeObjectChildrenClickable(element) {
    var objectDivs = element.getElementsByClassName("object");
    for (var i = 0; i < objectDivs.length; i++) {
        objectDivs[i].onclick = onObjectClick;
    }
}

function onObjectClick(e) {
    var cname = this.getAttribute("cname");
    commandParts.push({"id":this.id, "name":cname});
    setCommand();
}

function clearCommandLine() {
    commandParts = ["Gehe zu"];
    var commandDiv = document.getElementById("command");
    commandDiv.innerHTML = commandParts.join(" ");
}

function setCommand() {
    var commandDiv = document.getElementById("command");
    //Leave verbs but translate substatives (odd index)
    commandDiv.innerHTML = commandParts.map(function(e, i) {return i % 2 == 0 ? e : e.name}).join(" ");
    var d = commandRules;
    for (var commandIndex = 0; commandIndex < commandParts.length; commandIndex++) {
        d = getValueOrDefault(d, commandParts[commandIndex]);
        if (Array.isArray(d)) {
            run(d.concat([clearCommandLine]));
            return;
        }
    }
    if (Object.keys(d).length == 1 && Object.keys(d)[0] != "*") {
        commandParts.push(Object.keys(d)[0]);
        setCommand();
    }
}

function getValueOrDefault(dict, key) {
    if (typeof(key) != "string") {
        key = key["id"];
    }
    if (key in dict) {
        return  dict[key];
    }
    if ("*" in dict) {
        return dict["*"];
    }
    return [];
}