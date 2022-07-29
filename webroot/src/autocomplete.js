/*
 * Copyright 2022, De Bitmanager
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
(function () {

   const Range = ace.require("ace/range").Range;
   
   let MODE_INACTIVE = 0, MODE_VISIBLE = 1, MODE_APPLYING_TERM = 2, MODE_FORCED_CLOSE = 3;
   let MODE = MODE_INACTIVE;
   let _enabled = true;
   let ACTIVE_MENU = null;
   let ACTIVE_CONTEXT = null;

   /* 
    * Autocompletion terms providers.
    * Most of these functions passing through to the mapper plugin.
    */
   function _fillAutoCompleteTermsForUrl(context) {
      let serverParms = webcurl.server.getServerParms();
      if (!serverParms || !serverParms.mappingPlugin) return;

      let col = context.tokenUnderCursor.column;
      context.autoCompleteTerms = serverParms.mappingPlugin.getAutocompleteValuesForUrl(context.urlLine, col, context.tokenUnderCursor.type) || [];
      console.log('getAutocompleteValuesForUrl(', context.urlLine, col, context.tokenUnderCursor.type, '): ', context.autoCompleteTerms);
   }

   function _fillAutoCompleteTermsForIndex(context) {
      let serverParms = webcurl.server.getServerParms();
      if (!serverParms || !serverParms.mappingPlugin) return;
      context.autoCompleteTerms = serverParms.mappingPlugin.getAutocompleteValuesForIndex() || [];
      console.log('getAutocompleteValuesForIndex(): ', context.autoCompleteTerms);
   }
   function _fillAutoCompleteTermsForField(context) {
      let serverParms = webcurl.server.getServerParms();
      if (!serverParms || !serverParms.mappingPlugin) return [];

      context.autoCompleteTerms = serverParms.mappingPlugin.getAutocompleteValuesForField(context.urlLine) || [];
      console.log('_getAutocompleteValuesForField(', context.urlLine, '): ', context.autoCompleteTerms);
   }
   function _fillAutoCompleteTermsForTemplate(context) {
      let serverParms = webcurl.server.getServerParms();
      if (!serverParms || !serverParms.templates) return [];

      context.templates = serverParms.templates;
      context.autoCompleteTerms = Object.keys(serverParms.templates);
      console.log('_getAutocompleteValuesForTemplate()', context.autoCompleteTerms);
   }


   function _setEnabled(state) {
      _enabled = state
   }


   function getAutoCompleteValueFromToken(token) {
      let ret = _getAutoCompleteValueFromToken(token);
      console.log('GetACValue(', token, '): ', ret);
      return ret;
   }
   function _getAutoCompleteValueFromToken(token) {
      switch ((token || {}).type) {
         case "variable":
         case "string":
         case "text":
         case "constant.numeric":
         case "constant.language.boolean":
            return token.value.replace(/"/g, '');
         case "method":
         case "url.part":
         case "url.param":
         case "url.value":
            return token.value;
         default:
            // standing on white space, quotes or another punctuation - no replacing
            return "";
      }
   }

   function menuUpDown(direction) {
      let $li = ACTIVE_MENU.find("li");
      let $item = ACTIVE_MENU.find(".ui-state-active");
      let idx = 0;
      if ($item.length > 0) {
         idx = $li.index($item);
         $item.removeClass("ui-state-active");

         idx += direction;
         if (idx < 0) idx = $li.length - 1;
         else if (idx >= $li.length) idx = 0;
      }
      $item = $($li[idx]);
      $item.addClass("ui-state-active");
      return true;
   }
   function menuSelectActive() {
      let $li = ACTIVE_MENU.find("li");
      let $item = ACTIVE_MENU.find(".ui-state-active");
      if ($item.length === 0) {
         $item = $($li[0]);
      }
      let idx = $item.data("term_id");
      console.log("Select idx=", idx);
      applyTerm(ACTIVE_CONTEXT.autoCompleteTerms[idx]);
      return true;
   }
   const visibleMenuAceCMDS = [
      {
         name: "golinedown",
         exec: function (editor) {
            return menuUpDown(1);
         },
         bindKey: "Down"
      },
      {
         name: "golineup",
         exec: function (editor) {
            return menuUpDown(-1);
         },
         bindKey: "Up"
      },
      {
         name: "select_autocomplete",
         exec: function (editor) {
            return menuSelectActive();
         },
         bindKey: "Enter"
      },
      {
         name: "indent",
         exec: function (editor) {
            menuSelectActive();
            return true;
         },
         bindKey: "Tab"
      },
      {
         name: "singleSelection",
         exec: function (editor) {
            resetAutoComplete(editor);
            MODE = MODE_FORCED_CLOSE;
            return true;
         },
         bindKey: "Esc"
      }
   ];

   let _cached_cmds_to_restore = [];


   function hideAutoComplete(editor) {
      if (MODE !== MODE_VISIBLE) return;
      //console.trace("Hide AC");
      editor = editor || webcurl.editor;
      editor.commands.removeCommands(visibleMenuAceCMDS);
      editor.commands.addCommands(_cached_cmds_to_restore);
      ACTIVE_MENU.css("left", "-1000px");
      MODE = MODE_INACTIVE;
   }
   function resetAutoComplete(editor) {
      ACTIVE_CONTEXT = null;
      hideAutoComplete(editor);
   }


   function updateAutoComplete(editor, hideIfSingleItemAndEqualToTerm) {

      editor = editor || webcurl.editor;
      let context = ACTIVE_CONTEXT;
      let token = editor.getTokenUnderCursor();
      let term = getAutoCompleteValueFromToken(token);
      let lcTerm = term.toLowerCase();
      let possible_terms = context.autoCompleteTerms;
      console.log("Updating autocomplete for ", term, ", terms=", possible_terms);
      context.tokenUnderCursor = token;

      ACTIVE_MENU.children().remove();

      let acTerms = [];
      let i, obj;
      let scorer = (token.type === 'text' || context.autoCompleteType !== 'template') ? scoreDistance : scoreConstant;
      for (i = 0; i < possible_terms.length; i++) {
         let t = possible_terms[i] + "";
         acTerms.push({ t: t, i: i, score: scorer(lcTerm, t.toLowerCase()) });
      }
      acTerms.sort(function (x, y) {
         //descending scores
         if (x.score < y.score) return 1;
         if (x.score > y.score) return -1;
         //ascending index
         if (x.i < y.i) return -1;
         if (x.i > y.i) return 1;
         return 0;
      });
      if (acTerms.length > 25) acTerms.length = 25;
      console.log("ACItems: ", acTerms);

      function returnHidden() { hideAutoComplete(); return false; }

      switch (acTerms.length) {
         case 0: return returnHidden();
         case 1:
            if (hideIfSingleItemAndEqualToTerm && acTerms[0].t === term) return returnHidden();
            break;
      }

      for (i = 0; i < acTerms.length; i++) {
         obj = acTerms[i];
         $('<li></li>').appendTo(ACTIVE_MENU).append($('<a tabindex="-1" href="#"></a>').
            text(obj.t)).data("term_id", obj.i);
      }
      ACTIVE_MENU.menu("refresh");
      return true;
   }

   function showAutoComplete(editor, force, requestedType) { //requestedType is optional
      if (!_enabled) return;

      hideAutoComplete();

      editor = editor || webcurl.editor;

      let context = createAutocompleteContext(editor, requestedType);
      console.log("SHOW_AC ctx=", context);
      ACTIVE_CONTEXT = context;
      if (!context) return; // nothing to do

      if (context.autoCompleteType === 'template' && !force) return;

      ACTIVE_MENU.css('visibility', 'visible');
      _cached_cmds_to_restore = $.map(visibleMenuAceCMDS, function (cmd) {
         return editor.commands.commands[cmd.name];
      });
      editor.commands.addCommands(visibleMenuAceCMDS);
      MODE = MODE_VISIBLE;

      if (!updateAutoComplete(editor, !force)) return; // update has hid the menu
      console.log("SHOW_AC ctx2=", context);

      let screen_pos = editor.renderer.textToScreenCoordinates(context.textBoxPosition.row, context.textBoxPosition.column);
      ACTIVE_MENU.css("left", screen_pos.pageX);
      ACTIVE_MENU.css("top", screen_pos.pageY);
   }

   function scoreDistance (lcTerm, otherTerm) {
      let lcOther = otherTerm.toLowerCase();
      let argLen = lcTerm.length;
      let otherLen = lcOther.length;
      let diffLen = Math.abs(otherLen - argLen);

      let idx = lcOther.indexOf(lcTerm);
      if (idx >= 0) {
         return 1.0 + Math.pow(.9, idx) + Math.pow(.9, diffLen);
      }

      let N = Math.min(argLen, otherLen);
      for (idx = 0; idx < N; idx++) if (lcTerm.charAt(idx) != lcOther.charAt(idx)) break;

      let tot = 1.0 + Math.max(argLen, otherLen);
      let p1 = Math.pow(.9, idx);
      let d = levenstein(lcTerm, lcOther, true);
      return (tot - levenstein(lcTerm, lcOther, true) - p1) / tot;
   }
   function scoreConstant() {
      return 1;
   }

   function levenstein(s1, s2, transpositions) {
      let len1 = s1.length;
      let len2 = s2.length;
      if (len1 == 0 || len2 == 0) {
         if (len1 == len2) return 0;
         return len1 == 0 ? len2 : len1;
      }

      //Make s1 the smallest string (in order to do as least as possible array swaps)
      if (len1 > len2) {
         let tmp = s1;
         s1 = s2;
         s2 = tmp;
         len1 = len2;
         len2 = s2.length;
      }

      function initWithZeros(len) {
         let ret = [];
         for (let i = 0; i < len; i++) ret.push(0);
         return ret;
      }
      function initWithLen(len) {
         let ret = [];
         for (let i = 0; i < len; i++) ret.push(i);
         return ret;
      }

      let i;
      let arr_0 = initWithZeros(len2 + 1);
      let arr_1 = initWithLen  (len2 + 1);
      let arr_2 = initWithZeros(len2 + 1);

      let j, ch1, ch2, cost, arr_tmp;
      if (transpositions) {
         for (i = 0; i < len1; i++) {
            arr_0[0] = i;
            ch1 = s1.charAt(i);
            for (j = 0; j < len2; j++) {
               ch2 = s2.charAt(j);
               cost = ch1 == ch2 ? 0 : 1;
               arr_0[j + 1] = Math.min(1 + Math.min(arr_0[j], arr_1[j + 1]), arr_1[j] + cost);
               if (i > 0 && j > 0 && ch1 == s2[j - 1] && s1[i - 1] == ch2)
                  arr_0[j + 1] = Math.min(arr_0[j + 1], arr_2[j - 1] + cost);
            }
            arr_tmp = arr_2;
            arr_2 = arr_1;
            arr_1 = arr_0;
            arr_0 = arr_tmp;
         }
      } else {
         for (i = 0; i < len1; i++) {
            arr_0[0] = i;
            ch1 = s1.charAt(i);
            for (j = 0; j < len2; j++) {
               ch2 = s2.charAt(j);
               cost = ch1 == ch2 ? 0 : 1;
               arr_0[j + 1] = Math.min(1 + Math.min(arr_0[j], arr_1[j + 1]), arr_1[j] + cost);
            }
            arr_tmp = arr_1;
            arr_1 = arr_0;
            arr_0 = arr_tmp;
         }
      }
      return arr_1[len2];
   }

   function _stripCurlyBraces(json) {
      if (!json.startsWith("{") && !json.endsWith("}")) return json;
      let lines = json.split('\n');
      if (lines.length >= 2) {
         lines = lines.slice(1, lines.length - 1);
         for (let i = 0; i < lines.length; i++) if (lines[i].startsWith('   ')) lines[i] = lines[i].substring(3);
         return lines.join("\n");
      }
      return json.substring(1, json.length - 1);
   }

   function applyTemplate(context, editor, term) {
      let session = editor.getSession();
      let template = context.templates[term];
      if (!template) return;
      let json = template.template_json;
      if (!json) return;
      if (typeof json !== "string") {
         json = template.pretty ? JSON.stringify(json, null, 3) : JSON.stringify(json);
      }
      console.log("ApplyTemplate: ctx=", context);

      let container = editor.getCurrentContainerFromIterator();
      if (!container) return;

      let tokens = container.tokens;
      let startIdx = container.startIdx;
      let endIdx = container.endIdx;
      let tokenBefore, tokenAfter;
      let curIdx, replaceRange;

      OUTER:
      for (curIdx = container.curIdx; curIdx >= startIdx; curIdx--) {
         tokenBefore = tokens[curIdx];
         switch (tokenBefore.type) {
            case "whitespace": continue;
            case "text":
               replaceRange = new Range(tokenBefore.row, tokenBefore.column, tokenBefore.row, tokenBefore.column + tokenBefore.value.length);
               continue;
            default:
               break OUTER;
         }
      }
      OUTER2:
      for (let i = curIdx + 1; i <= endIdx; i++) {
         tokenAfter = tokens[i];
         switch (tokenAfter.type) {
            case "text":
            case "whitespace": continue;
            default:
               break OUTER2;
         }
      }


      console.log("tokenBefore=", tokenBefore, ", replace=", replaceRange, ", tokenAfter=", tokenAfter, ", container=", container);
      let prefix = '';
      let suffix = '';
      let needStripCurlyBraces = false;
      let indentFirstLine = false;

      if (container.type === 'array') {
         indentFirstLine = true;
         switch (tokenBefore.type) {
            case "paren.lparen":
            case "punctuation.comma": 
               prefix = "\n";
               break;
            default:
               prefix = ",\n";
               break;
         }
         switch (tokenAfter.type) {
            case "paren.rparen":
               suffix = "\n" + container.indent;
               break;
            case "punctuation.comma": break;
            default:
               suffix = ",\n" + container.indent;
               break;
         }
      } else {
         switch (tokenBefore.type) {
            case "paren.lparen":
            case "punctuation.comma":
               needStripCurlyBraces = true;
               break;
            case "variable":
               prefix = ": ";
               break;
            case "punctuation.colon":
               break;
            default:
               prefix = ",\n";
               needStripCurlyBraces = true;
               break;
         }

         switch (tokenAfter.type) {
            case "paren.rparen":
            case "punctuation.comma": break;

            case "variable":
               suffix = ",\n" + container.indentValues;
               break;
            default:
               alert("Can't insert template: would result in weird json");
               return;
         }
      }

      console.log("pfx='", prefix, "'suff='", suffix, "', json0=", json);
      json = container.formatJsonForInsertion(json, indentFirstLine, true);
      console.log('json1=', json);
      if (needStripCurlyBraces) json = _stripCurlyBraces(json);
      json = prefix + json + suffix;
      console.log('json3=', json);

      if (replaceRange) session.replace(replaceRange, json);
      else editor.insert(json);
      editor.moveCursor(-1);
   }

   
   function applyTerm(term) {
      let editor = webcurl.editor;
      let session = editor.getSession();
      let context = ACTIVE_CONTEXT;

      resetAutoComplete(editor);

      function addRange(existing, iter, t) {
         row = iter.getCurrentTokenRow();
         col = iter.getCurrentTokenColumn();
         return existing ? new Range(row, col, existing.end.row, existing.end.column)
                         : new Range(row, col, row, col + t.value.length)
      }

      MODE = MODE_APPLYING_TERM;
      try {
         if (context.templates)
            return applyTemplate(context, editor, term);

         let tokenIter = editor.getIteratorForCurrentLoc();
         let t = tokenIter.getCurrentToken();
         let replaceRange;
         for (; t; t = tokenIter.stepBackward()) {
            console.log("BW ApplyTerm, token=", t);
            switch (t.type) {
               case "whitespace": continue;
               case "text":
                  replaceRange = addRange(replaceRange, tokenIter, t);
                  break;
               case "string":
               case "variable":
               case "method":
               case "url.part":
               case "url.scheme":
               case "url.param":
               case "url.value":
                  replaceRange = addRange(replaceRange, tokenIter, t);
                  break;
            }
            break;
         }
         console.log("ReplaceRange=", replaceRange, ", t=", t);
         let valueToInsert = term;
         switch (t.type) {
            case "string":
            case "variable":
               valueToInsert = '"' + term + '"';
               break;
         }
         if (replaceRange) session.replace(replaceRange, valueToInsert);
         else editor.insert(valueToInsert);
      } finally {
         editor.clearSelection(); // for some reason the above changes selection
         MODE = MODE_INACTIVE;
         editor.focus();
      }
   }

   function dumper(editor) {
      let pos = editor.getCursorPosition();
      let tokenIter = editor.getIteratorForLocation(pos.row, pos.column);
      console.log("Starting iterator. Pos=", pos);

      let t = tokenIter.getCurrentToken();
      for (; t; t = tokenIter.stepBackward()) {
         console.log("-- token ", tokenIter.getCurrentTokenRow(), tokenIter.getCurrentTokenColumn(), t);
         if (t.type === "method") break;
      }
      console.log("Tokens:", editor.getSession().getTokens(pos.row));
   }
   function createAutocompleteContext(editor, requestedType) {

      let pos = editor.getCursorPosition();
      let tokenIter = editor.getIteratorForCurrentLoc();
      //dumper(editor);
      let t = tokenIter.getCurrentToken();
      if (!t) return null;

      let lparenRow = -1;
      let tokenUnderCursor = t;
      pos.column = tokenIter.getCurrentTokenColumn();
      for (; t; t = tokenIter.stepBackward()) {
         if (t.type === "method" || t.type.startsWith("url.")) break;
         if (t.type === "paren.lparen") lparenRow = tokenIter.getCurrentTokenRow();
      }
      if (!t) return null;


      let row = tokenIter.getCurrentTokenRow();
      let context = {
         tokenUnderCursor: tokenUnderCursor,
         textBoxPosition: pos, // ace position to place the left side of the input box

         inBody: (lparenRow > row),
         urlLine: editor.getSession().getLine(row)
      };

      context.autoCompleteType = requestedType;
      if (!context.autoCompleteType) {
         if (lparenRow > row) {
            context.autoCompleteType = "template";
         } else {
            context.autoCompleteType = (tokenUnderCursor.type === "method") ? "method" : "url";
         }
      }
      console.log("CREATE CTX context.autoCompleteType=", context.autoCompleteType, ", requested=", requestedType);
      switch (context.autoCompleteType) {
         case "url":
            _fillAutoCompleteTermsForUrl(context);
            break;
         case "index":
            _fillAutoCompleteTermsForIndex(context);
            break;
         case "field":
            _fillAutoCompleteTermsForField(context);
            break;
         case "method":
            context.autoCompleteTerms = ["GET", "PUT", "POST", "DELETE", "HEAD"];
            break;
         case "template":
            _fillAutoCompleteTermsForTemplate(context);
            break;
         default:
            return null;
      }
      if (!context.autoCompleteTerms || context.autoCompleteTerms.length === 0) return null;

      return context;
   }


   function isEmptyToken(t) {
      return !t || !t.type || t.type === 'whitespace';
   }

   function isForSameAutoComplete(pos, session, context) {
      if (pos.row !== context.textBoxPosition.row) return false;
      let column = context.textBoxPosition.column + 1; //+1 because tbpos was at endrange. Meaning last position 
      if (pos.column < column) return false;
      let acText = session.getTextRange(new Range(pos.row, column, pos.row, pos.column));
      return !acText || acText.match(/^[\s_\-,\$A-Za-z0-9]+$/);
   }

   function evaluateCurrentTokenAfterAChange() {
      let pos = webcurl.editor.getCursorPosition();
      let session = webcurl.editor.getSession();
      let currentToken = session.getTokenAt(pos.row, pos.column);
      console.log("Evaluating current token: " + (currentToken || {}).value +
         " last examined: " + ((ACTIVE_CONTEXT || {}).tokenUnderCursor || {}).value);

      if (!currentToken) {
         if (pos.row === 0) {
            resetAutoComplete();
            return;
         }
         currentToken = { start: 0 }; // empty row
      }

      currentToken.row = pos.row; // extend token with row. Ace doesn't supply it by default

      if (ACTIVE_CONTEXT !== null && isForSameAutoComplete(pos, session, ACTIVE_CONTEXT)) {

         if (MODE === MODE_FORCED_CLOSE) {
            // menu was explicitly closed with esc. ignore
            return;
         }


         if (ACTIVE_CONTEXT.tokenUnderCursor.value === currentToken.value)
            return; // nothing changed

         if (MODE === MODE_VISIBLE) updateAutoComplete(); else showAutoComplete();
         return;
      }

      // don't automatically open the auto complete if some just hit enter (new line) or open a parentheses
      if (isEmptyToken(currentToken)) return;
      switch (currentToken.type) {
         case "paren.lparen":
         case "paren.rparen":
         case "punctuation.colon":
         case "punctuation.comma":
            return;
      }

      // show menu (if we have something)
      showAutoComplete();
   }

   function editorAutocompleteCommand(editor, args) {
      if (editor.postponeIfNeeded(editorAutocompleteCommand, this, arguments)) return;
      return showAutoComplete(editor, true, typeof args === "string" ? args : undefined );
   }


   function init() {
      ACTIVE_MENU = $("#autocomplete");
      ACTIVE_MENU.menu({
         select: function (event, ui) {
            applyTerm(ACTIVE_CONTEXT.autoCompleteTerms[ui.item.data("term_id")]);
         }
      });

      ACTIVE_MENU.keydown(function (e) {
         console.log("got: " + e.which);
         switch (e.which) {
            case $.ui.keyCode.ESCAPE:
               resetAutoComplete();
               webcurl.editor.focus();
               break;
            case $.ui.keyCode.TAB:
               ACTIVE_MENU.menu("select"); // select current item.
               return false;
         }
         return true;
      });

      let _cursorTimer;
      webcurl.editor.getSession().selection.on('changeCursor', function (e) {
         console.log("updateCursor communicated by editor");
         clearTimeout(_cursorTimer);
         if (MODE !== MODE_VISIBLE) return;

         _cursorTimer = setTimeout(function () {
            if (MODE !== MODE_VISIBLE) return;
            let editor = webcurl.editor;
            if (!isForSameAutoComplete(editor.getCursorPosition(), editor.getSession(), ACTIVE_CONTEXT)) {
               hideAutoComplete(); // we moved away
            }
         }, 100);

      });

      let _changeTimer;
      webcurl.editor.getSession().on("change", function (e) {
         clearTimeout(_changeTimer);
         console.log("Document change communicated by editor", e);
         if (MODE === MODE_APPLYING_TERM) {
            console.log("Ignoring, triggered by our change");
            return;
         }
         if (!_enabled) {
            console.log("Ignoring, ac is disabled");
            return;
         }

         _changeTimer = setTimeout(evaluateCurrentTokenAfterAChange, 100);
      });

   }
   webcurl.registerBootstrap(init);
   webcurl.autocomplete = {
      enable: function () { _setEnabled(true); },
      disable: function () { _setEnabled(false); },
      editorAutocompleteCommand: editorAutocompleteCommand,
      init: init,
   };

   // functions exposed only for testing.
   webcurl.autocomplete.test = {};
   webcurl.autocomplete.test.getAutoCompleteValueFromToken = getAutoCompleteValueFromToken;
   webcurl.autocomplete.test.getAutoCompleteContext = createAutocompleteContext;


})();
