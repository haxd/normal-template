var TOKEN_RE = new RegExp("(\{.+?\}\}?)"),
	COMMAND_RE = new RegExp("^\{[\#\/\=]");

var xpath = function(path) {
    path = path.replace(/\//g, ".");

    if (path == ".") {
        return "d";
    } else if (/^\./.test(path)) {
        return "data" + path;
    } else {
        return "d." + path;
    }
}

var FILTERS = {
    html: function(val) {
        return val.replace(/&/g, "&amp;").replace(/>/g, "&gt;").
                   replace(/</g, "&lt;");
    },
    attr: function(val) {
        return val.replace(/&/g, "&amp;").replace(/>/g, "&gt;").
                   replace(/</g, "&lt;").replace(/"/g, "&quot;");
    },
    uri: encodeURI
}

/**
 * Compile the template source into the template function.
 */
exports.compile = function(src, filters) {
    // v = curent value, d = cursor, a = reduced array, df = default filter, res = result
    var code = ['var v,a,d = data,df = filters.html,res = [];'],
        stack = ["data"],
        tokens = src.split(TOKEN_RE);
//print(JSON.stringify(tokens));
    for (var i = 0; i < tokens.length; i++) {
        var token = tokens[i];
        
        if (token == "") continue;

        if (token.match(COMMAND_RE)) {
            if (token[1] == "#") { // open
                var parts = token.substring(2, token.length-1).split(" "),
                    cmd = parts[0],
                    arg = parts[1],
                    val;
              
                switch (cmd) {
                case "if":
                case "with":
                case "w":
                    val = xpath(arg);
                    code.push('d = ' + val + ';if (d != undefined) {');
                    stack.unshift(val.replace(/^d\./, stack[0] + "."));
                    continue;                    
                
                case "reduce":
                case "r":
                    val = xpath(arg);
                    var depth = stack.length;
                    code.push('var a' + depth + ' = ' + val + ';if ((a' + depth + ' != undefined) && (a' + depth + '.length >0)) ');
                    stack.unshift(val.replace(/^d\./, stack[0] + "."));
                    code.push('for (var i' + depth + ' = 0,l' + depth + ' = a' + depth + '.length; i' + depth + ' < l' + depth + '; i' + depth + '++) {d = a' + depth + '[i' + depth + '];');                
                    continue;                    
                    
                case "or":
                case "else":
                case "e":
                    code.push('} else {');
                    continue;

                case "c": // comment
                case "#":
                    continue;
                }
            } else if (token[1] == "/") { // close
                var cmd = token.substring(2, token.length-1).split(" ")[0];
              
                switch (cmd) {
                case "if":
                case "with":
                case "w":
                    stack.shift();
                    code.push('};d = ' + stack[0] + ';');
                    continue;

                case "reduce":
                case "r":
                    var depth = stack.length;
                    stack.shift();
                    code.push('};d = ' + stack[0] + ';');
                    continue;
                }
            } else if (token[1] == "=") { // interpolation
                var parts = token.substring(2, token.length-1).split(" "),
                    pre = "", post = "";
                for (var j = 0; j < parts.length-1; j++) {
                    pre += "filters." + parts[j] + "("; post += ")";
                }
                if (pre == "") {
                    pre = "df("; post = ")";
                }
                code.push('v = ' + xpath(parts[j]) + ';if (v != undefined) res.push(' + pre + 'v.toString()' + post +');');
                continue;
            }
        }

        // plain text
        code.push('res.push("' + token.replace(/\n/, "\\n") + '");');
    }    

    code.push('return res.join("");');    

//  print(code.join(""));    
    
    var func = new Function("data", "filters", code.join(""));

    return function(data) { return func(data, (filters || FILTERS)) };
}

/*
+ faster (compile to function)
+ {=..} is safer
+ path can access ancestors
+ escape by default.
+ multiple filters.
+ reduce
- many templates in one file.
- include as filter. 
- handle functions? no...
*/