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
    //this.lines = this.lines.concat(""); //To close all open blocks
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

function choose2(branches) {
    for (var i = 0; i < branches.length; i++) {
        var branch = branches[i];
        if (branch.condition()) {
            run(branch.instructions);
            return;
        }
    }
}

function choose(variableName, values, functions) {
    var value = null;
    if (variableName in variables) {
        value = variables[variableName];
    }
    else {
        value = 0;
    }
    for (var i = 0; i < values.length; i++) {
        if (value == values[i]) {
            run(functions[i]);
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
/*
function clearDialog() {
    var dialogDiv =  document.getElementById('dialog');
    dialogDiv.innerHTML = text;
}*/

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
        var index = inventory.indexOf(objects[i]);
        if (index >= 0) {
            inventory.splice(index, 1);
        }
    }
    setInventory();
}

function writeDescription(name, text) {
    var roomDiv = document.getElementById("room");
    roomDiv.innerHTML = transform(name, text);
    makeObjectChildrenClickable(roomDiv);
}

function enterRoom(name) {
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

function getParsedInstructionBlock(text) {
    var instructions = [];
    parseInstructionBlock(new Reader(text), instructions);
    return instructions;
}

function parseInstructionBlock(reader, instructions) {
    if (reader.getCurrentLine() != "{") {
        throw "Block start expected.";
    }
    reader.moveNext();
    parseInstructionList(reader, instructions);
    if (reader.getCurrentLine() != "}") {
        throw "Block end expected.";
    }
    reader.moveNext();
}

function parseInstructionList(reader, instructions) {
    if (reader.getCurrentLine() == "}") {
        return;
    }
    parseInstruction(reader, instructions);
    parseInstructionList(reader, instructions);
}

function parseInstruction(reader, instructions) {
    var line = reader.getCurrentLine();
    if (line.startsWith('say')) parsePrint(reader, instructions);
    else if (line.startsWith('set')) parseSet(reader, instructions);
    else if (line.startsWith('describe')) parseDescribe(reader, instructions);
    else if (line.startsWith('wait')) parseWait(reader, instructions);
    else if (line.startsWith('add')) parseAdd(reader, instructions);
    else if (line.startsWith('remove')) parseRemove(reader, instructions);
    else if (line.startsWith('enter')) parseEnter(reader, instructions);
    else if (line.startsWith('if')) parseIf(reader, instructions);
    else throw "Parser error: Unknown text in line '" + line + "'";
}

function parsePrint(reader, instructions) {
    var line = reader.getCurrentLine();
    var m = /^say\s+"(.*)"$/g.exec(line);
    if (m == null) {
        throw "Parser error: Unknown text in line '" + line + "'";
    }
    instructions.push(function() { print(m[1]) });
    reader.moveNext();
}

function parseSet(reader, instructions) {
    var line = reader.getCurrentLine();
    var m = /^set\s+(\S+)\s+to\s+(\S(.*\S)?)$/g.exec(line);
    if (m == null) {
        throw "Parser error: Unknown text in line '" + line + "'";
    }
    instructions.push(function() { setVariable(m[1], m[2]) });
    reader.moveNext();
}


function parseIf(reader, instructions) {
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
    parseInstructionBlock(reader, branchInstructions);
    var branches = [{ condition: function() { return getVariableValue(variableName) == value;},
                      instructions: branchInstructions}];
    parseElIfList(reader, branches);
    instructions.push(function() { choose2(branches); } );
}

function parseElIf(reader, branches) {
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
    parseInstructionBlock(reader, branchInstructions);
    branches.push({ condition: function() { return getVariableValue(variableName) == value;},
                      instructions: branchInstructions});
    parseElIfList(reader, branches);
}

function parseElse(reader, branches) {
    var line = reader.getCurrentLine();
    var m = /^else\s*:/.exec(line);
    if (m == null) throw "Parser error: Unknown text in else-line '" + line + "'";
    var branchInstructions = [];
    reader.moveNext();
    parseInstructionBlock(reader, branchInstructions);
    branches.push({ condition: function() { return true;},
                    instructions: branchInstructions});
}

function parseElIfList(reader, branches) {
    var line = reader.getCurrentLine();
    if (line.startsWith("elif")) {
        parseElIf(reader, branches);
    }
    else if (line.startsWith("else")) {
        parseElse(reader, branches);
    }
}

var CONDITION_WAS_TRUE = 1;
var CONDITION_WAS_FALSE = 0;
var GOTO_ENDIF = 2;

var ifStack = []

function init() {
    addEvent("", "Schau an *", [ function() { print("Ich kann nichts besonderes erkennen.") }]);
    addEvent("", "Ziehe *", [function() { print("Das kann ich nicht bewegen."); }]);
    addEvent("", "Drücke *", [function() { print("Das kann ich nicht bewegen."); }]);
    addEvent("", "Nimm *", [function() { print("Das will ich nicht haben."); }]);
    addEvent("", "Gib * an *", [function() { print("Nee."); }]);
    addEvent("", "Rede mit *", [function() { print("Hallo?"); }]);
    addEvent("", "Benutze *", [function() { print("Das kann ich nicht benutzen."); }]);
    addEvent("", "Öffne *", [function() { print("Das lässt sich nicht öffnen."); }]);
    addEvent("", "Schließe *", [function() { print("Das lässt sich nicht schließen."); }]);
    
    addEvent("küche", "draw __", [
            function() { writeDescription("küche", "In einer Ecke gegenüber der _Tür_ steht eine kleine Miniküche mit _Kochfeld_, "
                + "_Spüle_ und _Kühlschrank_. "
                + "In der Ecke gegenüber steht ein Küchenschrank mit "
                + "_Besteck-|Besteckschublade_ und "
                + "_Zubehörschublade_ sowie einem _Regal_ "
                + "für Gläser und Tassen und einem _Geschirrfach_. "
                + "In der Mitte steht ein _Tisch_ mit Stühlen. "
                + "Auf dem Tisch steht eine _Vase_. "
                + "Es ist für eine Person _gedeckt|Teller und Tasse_ worden."); } ]);
    addEvent("flur", "draw __", [
            function() { writeDescription("flur", "Vom Flur aus gelangt man in die _Küche_, das _Schlafzimmer_, das _Bad_ und in eine _Abstellkammer_.") } ]);
    addEvent("küche", "Rede mit _Tisch_", [
            function() { choose("variable", [0, 1], [[
                function() { setVariable('variable',  1); },
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
            ], [
                function() { print("Ich will nicht noch einmal mit dem Tisch reden."); }
            ]]); }]);
    addEvent("küche", "Benutze _Regal_ mit _Tisch_", [function () { print("Was ist das denn für eine blöde Idee?"); }]);
    addEvent("küche", "Benutze _Regal_ mit *", [function() { print("Ich weiß nicht wie. "); } ]);
    addEvent("TODO", "Benutze _Brauseflasche_", [function() { print("Ahh...lecker.") } ]);
    addEvent("küche", "Gehe zu _Tür_", [function() { enterRoom("flur"); }]);
    addEvent("flur", "Gehe zu _Küche_", [function() { enterRoom("küche"); }]);
    addEvent("küche", "Schau an _Regal_", getParsedInstructionBlock(
                                            '   say "Hallo Regal."\n'
                                          + '   if r1 is 0:\n'
                                          + '       set r1 to 1\n'
                                          + '       say "Ich sehe dich zum ersten Mal an."\n'
                                          + '   else:\n'
                                          + '       say "Ich sehe dich ein weiteres Mal."'
                                              ));
    
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            //createGameData(this.responseText);
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