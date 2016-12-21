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

 var commandRules = {
    "Schau an": {
       "küche.kühlschrank": [
          function() { print("Dies ist ein cooler Kühlschrank.");},
          function() { print("Ok, war ein blöder Spruch.")}
       ],
       "*": [ function() { print("Ich kann nichts besonderes erkennen.") }]
    },
    "Rede mit": {
       "küche.tisch": [
          function() { print("Ich bin Peter Kowalsky, ein mächtiger Seeräuber.");},
          function() { print("Oh...sieh' mal an! Eine Schatztruhe!");},
          function() { inventory.push("Schatztruhe"); setInventory(); nextStep();},
          function() { wait(1); },
          function() { print("Da wollen wir doch gleich mal sehen, was da darin ist.");},
          function() { print("Ahh, eine Flasche Brause, eine Brille und ein Fisch.");},
          function() { inventory.push("Brauseflasche");
                       inventory.push("Brille");
                       inventory.push("roter Fisch");
                       setInventory(); nextStep();},
          function() { wait(1); },
          function() { print("Die leere Truhe brauche ich ja dann nicht mehr");},
          function() { inventory.splice(inventory.indexOf("Schatztruhe"), 1); setInventory(); nextStep();}
       ],
       "*": [ function() { print("Ich glaube nicht, dass das funktioniert."); }]
    },
    "Benutze": {
       "küche.regal": {
          "mit": {
             "küche.tisch": [function () { print("Was ist das denn für eine blöde Idee?"); }],
             "*": [ function() { print("Ich weiß nicht wie. "); } ]
          }
       },
       "*": [function() { print("Das kann ich nicht benutzen."); } ]
    },
    "Gehe zu": {
       "küche.tür": [function() { enterRoom("flur"); nextStep(); }],
       "flur.küche": [function() { enterRoom("küche"); nextStep(); }]
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
       }
    }
 };

 var inventory = [];
 var commandParts = ["Gehe zu"];
 var steps = [];
 var index = 0;
 var objectIds = {
             "küche.tür": "Tür",
             "küche.kochfeld": "Kochfeld",
             "küche.spüle": "Spüle",
             "küche.kühlschrank": "Kühlschrank",
             "küche.besteckschublade": "Besteckschublade",
             "küche.zubehörschublade": "Zubehörschublade",
             "küche.regal": "Regal",
             "küche.geschirrfach": "Geschirrfach",
             "küche.tisch": "Tisch",
             "küche.vase": "Vase",
             "küche.teller_und_tasse": "Teller und Tasse",
             "flur.küche": "Küche",
             "flur.schlafzimmer": "Schlafzimmer",
             "flur.bad": "Bad",
             "flur.abstellkammer": "Abstellkammer"
    };

 var rooms = {
    "küche": {
       "Description":
             "In einer Ecke gegenüber der <span id=\"küche.tür\" class=\"object\">Tür</span> steht eine kleine Miniküche mit <span id=\"küche.kochfeld\" class=\"object\">Kochfeld</span>, "
             + "<span id=\"küche.spüle\" class=\"object\">Spüle</span> und <span id=\"küche.kühlschrank\" class=\"object\">Kühlschrank</span>. "
             + "In der Ecke gegenüber steht ein Küchenschrank mit "
             + "<span id=\"küche.besteckschublade\" class=\"object\">Besteck-</span> und "
             + "<span id=\"küche.zubehörschublade\" class=\"object\">Zubehörschublade</span> sowie einem <span id=\"küche.regal\" class=\"object\">Regal</span> "
             + "für Gläser und Tassen und einem <span id=\"küche.geschirrfach\" class=\"object\">Geschirrfach</span>. "
             + "In der Mitte steht ein <span id=\"küche.tisch\" class=\"object\">Tisch</span> mit Stühlen. "
             + "Auf dem Tisch steht eine <span id=\"küche.vase\" class=\"object\">Vase</span>. "
             + "Es ist für eine Person <span id=\"küche.teller_und_tasse\" class=\"object\">gedeckt</span> worden.",
          },
    "flur": {
       "Description":
             "Vom Flur aus gelangt man in die <span id=\"flur.küche\" class=\"object\">Küche</span>, das <span id=\"flur.schlafzimmer\" class=\"object\">Schlafzimmer</span>, das <span id=\"flur.bad\" class=\"object\">Bad</span> und in eine <span id=\"flur.abstellkammer\" class=\"object\">Abstellkammer</span>.",
          }
 };

 function wait(seconds) {
     setTimeout(nextStep, 1000 * seconds);
 }

 function print(text) {
    var dialogDiv =  document.getElementById('dialog');
    dialogDiv.innerHTML = text;
    setTimeout(function() { dialogDiv.innerHTML = ""; nextStep() }, 25 * text.length + 2000);
 }

 function setInventory() {
     var inventoryDiv = document.getElementById('inventory');
     inventoryDiv.innerHTML = inventory.map(function(s) { return '<a href="">' + s + '</a>';}).join("<br/>");
 }

 function nextStep() {
    if (index < steps.length) {
       var step = steps[index];
       index++;
       step();
    }
 }

 function init() {
/*            var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
       if (this.readyState == 4 && this.status == 200) {
          var o = JSON.parse(this.responseText);
          alert(o.field);
       }
    };
    xhttp.open("GET", "game.json", true);
    xhttp.send();*/
    var verbDivs = document.getElementsByClassName("verb");
    for (var i = 0; i < verbDivs.length; i++) {
       verbDivs[i].onclick = function(e) {
                                  var text = this.innerHTML;
                                  commandParts = [text];
                                  setCommand();
                              };
    }
    enterRoom("küche");
    setInventory();
    clearCommandLine();
    nextStep();
 }

 function enterRoom(name) {
    var roomDiv = document.getElementById("room");
    roomDiv.innerHTML = rooms[name].Description;
    //objectIds = rooms[name].Objects;

    var objectDivs = document.getElementsByClassName("object");
    for (var i = 0; i < objectDivs.length; i++) {
       objectDivs[i].onclick = function(e) {
                                  //var text = objectIds[this.id];
                                  commandParts.push(this.id);
                                  setCommand();
                              };
    }
 }

 function clearCommandLine() {
    commandParts = ["Gehe zu"];
    var commandDiv = document.getElementById("command");
    commandDiv.innerHTML = commandParts.join(" ");
 }

 function setCommand() {
    var commandDiv = document.getElementById("command");
    //Leave verbs but translate substatives (odd index)
    commandDiv.innerHTML = commandParts.map(function(e, i) {return i % 2 == 0 ? e : objectIds[e]}).join(" ");
    var d = commandRules;
    for (var commandIndex = 0; commandIndex < commandParts.length; commandIndex++) {
       d = getValueOrDefault(d, commandParts[commandIndex]);
       if (Array.isArray(d)) {
          index = 0;
          steps = d.concat([clearCommandLine]);
          nextStep();
          return;
       }
    }
    if (Object.keys(d).length == 1 && Object.keys(d)[0] != "*") {
       commandParts.push(Object.keys(d)[0]);
       setCommand();
    }
 }

 function getValueOrDefault(dict, key) {
    if (key in dict) {
       return  dict[key];
    }
    if ("*" in dict) {
       return dict["*"];
    }
    return [];
 }


