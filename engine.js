'use strict'

/*
TODO:
- Dialogs,
- Removing objects from room,
- Adding objects to room,
- Inventory selection
*/

var commandRules = {};

function addEvent(roomName, eventText, instructions) {
    //Change local references to global references
    eventText = eventText.trim().replace(/_([^_.]*)_/g, "_" + roomName + ".$1_");
    eventText = eventText.trim().replace(/\*/g, "_$&_");
    
    var words = eventText.split("_").map(s => s.trim()).filter(s => s.length > 0);
    var d = commandRules;
    for (var i = 0; i < words.length; i++) {
        if (!(words[i] in d)) {
            if (i == words.length - 1) {
                d[words[i]] = instructions;
                return;
            }
            d[words[i]] = {};
        }
        d = d[words[i]];
        if (Array.isArray(d) || i == words.length - 1) {
            throw "The event '" + words.slice(0, i + 1).join(" ") + "' is already defined.";
        }
    }
}

var inventory = [];
var commandParts = ["Gehe zu"];
var steps = [];
var index = 0;
var isRunning = false;
var variables = {};
var firstRoom = null;

function choose(branches) {
    for (var i = 0; i < branches.length; i++) {
        var branch = branches[i];
        if (branch.condition()) {
            run(branch.instructions);
            return;
        }
    }
}
    
//------------------------------------------------------

function wait(seconds) {
    waitDuration = 1000 * seconds;
}

function print(text) {
    var dialogDiv =  document.getElementById('dialog');
    dialogDiv.innerHTML = text;
    waitDuration = 25 * text.length + 2000;
    steps.splice(index, 0, function() { dialogDiv.innerHTML = ""; } );
}

function addToInventory(roomName, objects) {
    if (!Array.isArray(objects)) {
        objects = [objects]
    }
    for (var i = 0; i < objects.length; i++) {
        var m = /_([^_]+)_/g.exec(objects[i])
        inventory.push(extract(roomName, m[1]));
    }
    setInventory();
}

function removeFromInventory(roomName, objects) {
    if (!Array.isArray(objects)) {
        objects = [objects]
    }
    for (var i = 0; i < objects.length; i++) {
        var m = /_([^_]+)_/g.exec(objects[i])
        var id = extract(roomName, m[1]).id;
        var index = inventory.findIndex(e => e.id == id);
        if (index >= 0) {
            inventory.splice(index, 1);
        }
    }
    setInventory();
}

function clearDescription() {
    var roomDiv = document.getElementById("room");
    roomDiv.innerHTML = "";
}

function writeDescription(name, text) {
    var roomDiv = document.getElementById("room");
    roomDiv.innerHTML += transform(name, text);
    makeObjectChildrenClickable(roomDiv);
}

function enterRoom(name) {
    clearDescription();
    if ("draw" in commandRules) {
        var d = commandRules["draw"];
        name = name + ".";
        if (name in d) {
            d = d[name];
            if (Array.isArray(d)) {
                run(d);
            }
        }
    }
}

function setVariable(variableName, value) {
    variables[variableName] = value;
}

function getVariableValue(variableName) {
    if (variableName in variables) {
        return variables[variableName];
    }
    return 0;
}

//--------------------------------------

function setInventory() {
    var inventoryDiv = document.getElementById('inventory');
    inventoryDiv.innerHTML = inventory.map(function(s) { return getObjectSpan(s);}).join("<br/>");
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

function extract(roomName, text) {
    var parts = text.split("|");
    var id;
    if (roomName == null) {
        id = parts[parts.length - 1];
    }
    else {
        id = roomName + "." + parts[parts.length - 1];
    }
    return { id: id, name: parts[Math.floor(parts.length / 2)], display: parts[0] };
}

function getObjectSpan(object) {
    return "<span id=\"" + object.id + "\" cname=\"" + object.name + "\" class=\"object\" >" + object.display + "</span>";
}

function transform(roomId, text) {
    return text.replace(/_([^_]+)_/g, function(s, p1) {
        return getObjectSpan(extract(roomId, p1));
    });
}

function init() {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            parseRoomList(new ReplaceReader(this.responseText));
            var verbDivs = document.getElementsByClassName("verb");
            for (var i = 0; i < verbDivs.length; i++) {
                verbDivs[i].onclick = function(e) {
                                            var text = this.innerHTML;
                                            commandParts = [text];
                                            setCommand();
                                        };
            }
            if (firstRoom != null) {
                enterRoom(firstRoom);
            }
            clearCommandLine();
        }
    };
    xhttp.open("GET", "game.cta", true);
    xhttp.send();
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