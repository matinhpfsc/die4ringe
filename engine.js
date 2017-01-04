'use strict'

/*
TODO:
- Dialogs,
- Removing objects from room,
- Adding objects to room,
- Inventory selection
*/

function Reader(text) {
    this.lineIndex = 0;
    this.lines = text.replace(/\r/g, "").split("\n");
    this.lines = this.lines.filter(l => l.trim().length > 0);  //Remove empty lines
    this.indentLevelStack = [0];
    this.currentLine = null;
    this.getCurrentLine = function() {
        return this.currentLine;
    };
    this.moveNext = function() {
        var intentLevel;
        if (this.lineIndex >= this.lines.length) {
            this.currentLine = null;
            intentLevel = 0;
        }
        else {
            this.currentLine = this.lines[this.lineIndex];
            intentLevel = /^\s*/g.exec(this.currentLine)[0].length;
        }
        
        if (intentLevel > this.indentLevelStack[this.indentLevelStack.length - 1]) {
            this.indentLevelStack.push(intentLevel);
            this.currentLine = "{";
            return;
        }
        if (intentLevel < this.indentLevelStack[this.indentLevelStack.length - 1]) {
            this.indentLevelStack.pop();
            if (intentLevel > this.indentLevelStack[this.indentLevelStack.length - 1]) {
                throw "Intent error."
            }
            this.currentLine = "}";
            return;
        }
        if (this.currentLine != null) {
            this.currentLine = this.currentLine.trim();
        }
        this.lineIndex++;
    };
    this.moveNext();
}

function ReplaceReader(text) {
    this.orgReader = new Reader(text);
    this.getCurrentLine = function() {
        return this.currentLine;
    };
    this.moveNext = function() {
        this.orgReader.moveNext();
        this.currentLine = this.getReplacedCurrentLine();
    };
    this.parseReplaceList = function() {
        var line = this.orgReader.getCurrentLine();
        if (!line.startsWith("replace")) {
            return [];
        }
        var m = /^replace\s+"(.*)"\s+with\s+"(.*)"$/.exec(line.trim());
        if (m == null) throw "Parser error: Unknown text in replace-line '" + line + "'";
        var result = [{key: m[1], value:m[2]}];
        this.orgReader.moveNext();
        return result.concat(this.parseReplaceList());
    };
    this.getReplacedCurrentLine = function() {
        var line = this.orgReader.getCurrentLine();
        if (line == null) {
            return null;
        }
        return this.replacePatterns.reduce((l, p) => l.replace(new RegExp(p.key, "g"), p.value), line);
    }
    
    this.replacePatterns = this.parseReplaceList();
    this.currentLine = this.getReplacedCurrentLine();
}

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

function parseEventBlock(reader, roomName) {
    if (reader.getCurrentLine() != "{") {
        throw "Block start expected.";
    }
    reader.moveNext();
    parseEventList(reader, roomName);
    if (reader.getCurrentLine() != "}") {
        throw "Block end expected.";
    }
    reader.moveNext();
}

function parseRoomList(reader) {
    if (reader.getCurrentLine() == "}" || reader.getCurrentLine() == null) {
        return;
    }
    parseRoom(reader);
    parseRoomList(reader);
}

function parseRoom(reader) {
    var line = reader.getCurrentLine();
    var m = /^room\s+"(.*)"\s*:/.exec(line);
    if (m == null) throw "Parser error: Unknown text in room-line '" + line + "'";
    var roomName = m[1];
    if (firstRoom == null) {
        firstRoom = roomName;
    }
    reader.moveNext();
    var instructions = [];
    parseEventBlock(reader, roomName, instructions);
}

function parseEventList(reader, roomName) {
    if (reader.getCurrentLine() == "}" || reader.getCurrentLine() == null) {
        return;
    }
    parseEvent(reader, roomName);
    parseEventList(reader, roomName);
}

function parseEvent(reader, roomName) {
    var line = reader.getCurrentLine();
    var m = /^event\s+"(.*)"\s*:/.exec(line);
    if (m == null) throw "Parser error: Unknown text in event-line '" + line + "'";
    var eventText = m[1];
    reader.moveNext();
    var instructions = [];
    parseInstructionBlock(reader, roomName, instructions);
    addEvent(roomName, eventText, instructions);
}

function parseInstructionBlock(reader, roomName, instructions) {
    if (reader.getCurrentLine() != "{") {
        throw "Block start expected.";
    }
    reader.moveNext();
    parseInstructionList(reader, roomName, instructions);
    if (reader.getCurrentLine() != "}") {
        throw "Block end expected.";
    }
    reader.moveNext();
}

function parseInstructionList(reader, roomName, instructions) {
    if (reader.getCurrentLine() == "}" || reader.getCurrentLine() == null) {
        return;
    }
    parseInstruction(reader, roomName, instructions);
    parseInstructionList(reader, roomName, instructions);
}

function parseInstruction(reader, roomName, instructions) {
    var line = reader.getCurrentLine();
    if (line.startsWith('say')) parsePrint(reader, instructions);
    else if (line.startsWith('set')) parseSet(reader, instructions);
    else if (line.startsWith('describe')) parseDescribe(reader, roomName, instructions);
    else if (line.startsWith('wait')) parseWait(reader, instructions);
    else if (line.startsWith('add')) parseAdd(reader, roomName, instructions);
    else if (line.startsWith('remove')) parseRemove(reader, roomName, instructions);
    else if (line.startsWith('enter')) parseEnter(reader, instructions);
    else if (line.startsWith('if')) parseIf(reader, roomName, instructions);
    else throw "Parser error: Unknown text in line '" + line + "'";
}

function parsePrint(reader, instructions) {
    var line = reader.getCurrentLine();
    var m = /^say\s+"(.*)"$/g.exec(line);
    if (m == null) {
        throw "Parser error: Unknown text in print-line '" + line + "'";
    }
    instructions.push(function() { print(m[1]) });
    reader.moveNext();
}

function parseEnter(reader, instructions) {
    var line = reader.getCurrentLine();
    var m = /^enter\s+"(.*)"$/g.exec(line);
    if (m == null) {
        throw "Parser error: Unknown text in enter-line '" + line + "'";
    }
    instructions.push(function() { enterRoom(m[1]) });
    reader.moveNext();
}

function parseSet(reader, instructions) {
    var line = reader.getCurrentLine();
    var m = /^set\s+(\S+)\s+to\s+(\S(.*\S)?)$/g.exec(line);
    if (m == null) {
        throw "Parser error: Unknown text in set-line '" + line + "'";
    }
    instructions.push(function() { setVariable(m[1], m[2]) });
    reader.moveNext();
}

function parseDescribe(reader, roomName, instructions) {
    var line = reader.getCurrentLine();
    var m = /^describe\s+"(.*)"$/g.exec(line);
    if (m == null) {
        throw "Parser error: Unknown text in describe-line '" + line + "'";
    }
    instructions.push(function() { writeDescription(roomName, m[1]) });
    reader.moveNext();
}

function parseAdd(reader, roomName, instructions) {
    var line = reader.getCurrentLine();
    var m = /^add\s+(.*)\s+to\s+inventory$/g.exec(line);
    if (m == null) {
        throw "Parser error: Unknown text in add-line '" + line + "'";
    }
    var objects = m[1].split(',').map(s => s.trim());
    instructions.push(function() { addToInventory(roomName, objects); });
    reader.moveNext();
}

function parseRemove(reader, roomName, instructions) {
    var line = reader.getCurrentLine();
    var m = /^remove\s+(.*)\s+from\s+inventory$/g.exec(line);
    if (m == null) {
        throw "Parser error: Unknown text in remove-line '" + line + "'";
    }
    var objects = m[1].split(',').map(s => s.trim());
    instructions.push(function() { removeFromInventory(roomName, objects); });
    reader.moveNext();
}

function parseWait(reader, instructions) {
    var line = reader.getCurrentLine();
    var m = /^wait\s+(\d+)\s+seconds?/g.exec(line);
    if (m == null) {
        throw "Parser error: Unknown text in wait-line '" + line + "'";
    }
    var seconds = parseFloat(m[1]);
    instructions.push(function() { wait(seconds); });
    reader.moveNext();
}


function parseIf(reader, roomName, instructions) {
    var line = reader.getCurrentLine();
    var m = /^if\s+(\S+)\s+((is|contains)(\s+(not))?)\s+(\S(.*\S)?)\s*:/.exec(line);
    if (m == null) throw "Parser error: Unknown text in if-line '" + line + "'";
    var variableName = m[1];
    var operator = m[2];
    if (operator != "is") {
        throw "Other operators than 'is' are not supported now."
    }
    var value = m[6];
    var branchInstructions = [];
    reader.moveNext();
    parseInstructionBlock(reader, roomName, branchInstructions);
    var branches = [{ condition: function() { return getVariableValue(variableName) == value;},
                      instructions: branchInstructions}];
    parseElIfList(reader, roomName, branches);
    instructions.push(function() { choose(branches); } );
}

function parseElIf(reader, roomName, branches) {
    var line = reader.getCurrentLine();
    var m = /^elif\s+(\S+)\s+(is|contains)(\s+(not))?\s+(\S(.*\S)?)\s*:/.exec(line);
    if (m == null) throw "Parser error: Unknown text in elif-line '" + line + "'";
    var variableName = m[1];
    var operator = m[2];
    if (operator != "is") {
        throw "Other operators than 'is' are not supported now."
    }
    var value = m[6];
    var branchInstructions = [];
    reader.moveNext();
    parseInstructionBlock(reader, roomName, branchInstructions);
    branches.push({ condition: function() { return getVariableValue(variableName) == value;},
                      instructions: branchInstructions});
    parseElIfList(reader, roomName, branches);
}

function parseElse(reader, roomName, branches) {
    var line = reader.getCurrentLine();
    var m = /^else\s*:/.exec(line);
    if (m == null) throw "Parser error: Unknown text in else-line '" + line + "'";
    var branchInstructions = [];
    reader.moveNext();
    parseInstructionBlock(reader, roomName, branchInstructions);
    branches.push({ condition: function() { return true;},
                    instructions: branchInstructions});
}

function parseElIfList(reader, roomName, branches) {
    var line = reader.getCurrentLine();
    if (line.startsWith("elif")) {
        parseElIf(reader, roomName, branches);
    }
    else if (line.startsWith("else")) {
        parseElse(reader, roomName, branches);
    }
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