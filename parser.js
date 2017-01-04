'use strict'

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
