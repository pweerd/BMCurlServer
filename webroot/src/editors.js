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
   const Anchor = ace.require('ace/anchor').Anchor;
   const Range = ace.require("ace/range").Range;
   const TokenIterator = ace.require("ace/token_iterator").TokenIterator

   let orgOnPaste;
   let commandEditor;
   let postponedAction = null;

   function _onUpdate(e) {
      if (e.data.last >= commandEditor.getSession().getLength() - 1) {
         let action = postponedAction;
         postponedAction = null;

         if (action) {
            console.log("Execute postponed: ", action.fn.name);
            action.fn.apply(action.self, action.args);
         }
      }
   }

   function _postponeIfNeeded(fn, self, args) {
      if (commandEditor.getSession().bgTokenizer.running) {
         if (fn != args.callee) {
            console.error("fn != callee", fn, args);
            throw "fn != callee";
         }
         console.log("Postponing because of tokenizing: ", fn.name);
         postponedAction = { fn: fn, self: self, args: args };
         return true;
      }
      return false;
   }



   let ROW_PARSE_MODE = {
      REQUEST_START: 2,
      IN_REQUEST: 4,
      MULTI_DOC_CUR_DOC_END: 8,
      REQUEST_END: 16,
      BETWEEN_REQUESTS: 32
   };

   function getRowParseMode(editor, row) {
      if (!row && row !== 0) row = editor.getCursorPosition().row;

      let session = editor.getSession();
      if (row >= session.getLength()) return ROW_PARSE_MODE.BETWEEN_REQUESTS;
      let mode = (session.getState(row) || {}).name;
      if (!mode)
         return ROW_PARSE_MODE.BETWEEN_REQUESTS; // shouldn't really happen


      if (mode !== "start") return ROW_PARSE_MODE.IN_REQUEST;
      let line = (session.getLine(row) || "").trim();
      if (!line) return ROW_PARSE_MODE.BETWEEN_REQUESTS; // empty line waiting for a new req to start

      let ixEnd = line.indexOf("}", line.length - 1);
      if (ixEnd === 0 || (ixEnd > 0 && line.indexOf("{")===0)) {
         // check for a multi doc request (must start a new json doc immediately after this one end.
         row++;
         if (row < session.getLength()) {
            line = (session.getLine(row) || "").trim();
            if (line.indexOf("{") === 0) { // next line is another doc in a multi doc
               return ROW_PARSE_MODE.MULTI_DOC_CUR_DOC_END | ROW_PARSE_MODE.IN_REQUEST;
            }

         }
         return ROW_PARSE_MODE.REQUEST_END | ROW_PARSE_MODE.MULTI_DOC_CUR_DOC_END | ROW_PARSE_MODE.IN_REQUEST; // end of request
      }

      // check for single line requests
      row++;
      if (row >= session.getLength()) {
         return ROW_PARSE_MODE.REQUEST_START | ROW_PARSE_MODE.REQUEST_END;
      }
      line = (session.getLine(row) || "").trim();
      if (line.indexOf("{") !== 0) { // next line is another request
         return ROW_PARSE_MODE.REQUEST_START | ROW_PARSE_MODE.REQUEST_END;
      }

      return ROW_PARSE_MODE.REQUEST_START;
   };

   function rowPredicate(editor, row, value) {
      return (getRowParseMode(editor, row) & value) > 0;
   }

   function isInBetweenRequestsRow(editor, row) {
      return rowPredicate(editor, row, ROW_PARSE_MODE.BETWEEN_REQUESTS);
   };
   function isStartRequestRow(editor, row) {
      return rowPredicate(editor, row, ROW_PARSE_MODE.REQUEST_START);
   };
   function isEndRequestRow(editor, row) {
      return rowPredicate(editor, row, ROW_PARSE_MODE.REQUEST_END);
   };
   function isRequestEdge(editor, row) {
      return rowPredicate(editor, row, ROW_PARSE_MODE.REQUEST_END | ROW_PARSE_MODE.REQUEST_START);
   };
   function isInRequestsRow(editor, row) {
      return rowPredicate(editor, row, ROW_PARSE_MODE.IN_REQUEST);
   };
   function isMultiDocDocEndRow(editor, row) {
      return rowPredicate(editor, row, ROW_PARSE_MODE.MULTI_DOC_CUR_DOC_END);
   };

   function _reformatData(data, indent) {
      let changed = false;
      let formatted_data = [];
      for (let i = 0; i < data.length; i++) {
         let curDoc = data[i];
         let curLines = curDoc.split('\n');
         try {
            let newDoc = JSON.stringify(JSON.parse(curDoc), null, indent ? 3 : 0);
            formatted_data.push(newDoc);
            if (changed) continue; //don't need to re-check

            let newLines = newDoc.split('\n');
            if (newLines.length != curLines.length) { changed = true; continue; }
            for (let j = 0; j < newLines.length; j++) {
               if (curLines[j].trim() !== newLines[j].trim()) { changed = true; break; }
            }
         }
         catch (e) {
            console.log(e);
            formatted_data.push(curDoc);
         }
      }
      return { changed: changed, data: formatted_data }
   }

   function _autoIndent() {
      let editor = webcurl.editor;
      if (editor.postponeIfNeeded(_autoIndent, this, arguments)) return;
      let parsed_req = webcurl.editor.getCurrentRequest();
      if (parsed_req && parsed_req.data.length > 0) {
         let indent = parsed_req.data.length === 1; // unindent multi docs by default
         let formatted_data = _reformatData(parsed_req.data, indent);
         if (!formatted_data.changed) {
            // toggle.
            formatted_data = _reformatData(parsed_req.data, !indent);
         }
         parsed_req.data = formatted_data.data;
         webcurl.editor.getSession().replace(parsed_req.range, parsed_req.asText())
         editor.moveCursor(-1);
      }
   }

   function _autoIndentContainer() {
      let editor = webcurl.editor;
      if (editor.postponeIfNeeded(_autoIndentContainer, this, arguments)) return;
      let iter = editor.getIteratorForCurrentLoc();
      let container = editor.getCurrentContainerFromIterator(iter);
      console.log("autoIndentContainer", container);
      if (!container) return;

      let session = editor.getSession();
      let data = [session.getTextRange(container.range)];
      console.log("_autoIndentContainer json0 ", data);
      let formattedData = _reformatData(data, true);
      if (!formattedData.changed) {
         // toggle.
         formattedData = _reformatData(data, false);
      }
      console.log("_autoIndentContainer json1 ", formattedData.data[0]);
      console.log("formattedData", formattedData);
      if (!formattedData.changed) return;

      let replacement = container.formatJsonForInsertionInParent(formattedData.data[0]);
      console.log("_autoIndentContainer json2 ", replacement);
      session.replace(container.range, replacement);
      
      editor.moveCursor(-1);

   }


   function moveToPreviousRequest(editor) {
      if (editor.postponeIfNeeded(moveToPreviousRequest, this, arguments)) return;
      let row = editor.getCursorPosition().row - 1;
      for (; row > 0 && !isStartRequestRow(editor, row); row--) {
      }
      editor.moveCursorTo(row, 0);
   }

   function moveToNextRequest(editor) {
      if (editor.postponeIfNeeded(moveToNextRequest, this, arguments)) return;
      let row = editor.getCursorPosition().row + 1;
      let maxRow = editor.getSession().getLength();
      for (; row < maxRow && !isStartRequestRow(editor, row); row++) {
      }
      editor.moveCursorTo(row, 0);
   }

   function prevRequestStartRow(editor, row) {
      let curRow = row;
      while (curRow > 0 && !isStartRequestRow(editor, curRow)) curRow--;

      return curRow;
   };

   function nextRequestEndRow(editor, row) {
      let session = editor.getSession();
      let curRow = row;
      let maxLines = session.getLength();
      for (; curRow < maxLines - 1; curRow++) {
         let curRowMode = getRowParseMode(editor, curRow);
         if ((curRowMode & ROW_PARSE_MODE.REQUEST_END) > 0) break;
         if (curRow !== row && (curRowMode & ROW_PARSE_MODE.REQUEST_START) > 0) break;
      }
      return curRow;
   };
   function nextDataDocEnd(editor, row) {
      let curRow = row;
      let maxLines = editor.getSession().getLength();
      for (; curRow < maxLines - 1; curRow++) {
         let curRowMode = getRowParseMode(editor, curRow);
         if ((curRowMode & ROW_PARSE_MODE.REQUEST_END) > 0) break;
         if ((curRowMode & ROW_PARSE_MODE.MULTI_DOC_CUR_DOC_END) > 0) break;
         if (curRow !== row && (curRowMode & ROW_PARSE_MODE.REQUEST_START) > 0) break;
      }
      return curRow;
   };



   let CURRENT_REQ_RANGE = null;
   function updateEditorActionsBar() {
      let editor_actions = $("#editor_actions");

      if (CURRENT_REQ_RANGE) {
         let row = CURRENT_REQ_RANGE.start.row;
         let column = CURRENT_REQ_RANGE.start.column;
         let session = webcurl.editor.session;
         let firstLine = session.getLine(row);

         let offset = 0;

         if (!firstLine.startsWith('#')) {
            if (firstLine.length > session.getScreenWidth() - 5) {
               // overlap first row
               if (row > 0) row--; else row++;
            }
            let screen_pos = webcurl.editor.renderer.textToScreenCoordinates(row, column);
            offset += screen_pos.pageY - 3;
            let end_offset = webcurl.editor.renderer.textToScreenCoordinates(CURRENT_REQ_RANGE.end.row,
               CURRENT_REQ_RANGE.end.column).pageY;

            offset = Math.min(end_offset, Math.max(offset, 47));
            if (offset >= 47) {
               editor_actions.css("top", Math.max(offset, 47));
               editor_actions.css('visibility', 'visible');
               return;
            }
         }
      }

      editor_actions.css("top", 0);
      editor_actions.css('visibility', 'hidden');
   }
   function highlighCurrentRequestAndUpdateActionBar() {
      let editor = webcurl.editor;
      if (editor.postponeIfNeeded(highlighCurrentRequestAndUpdateActionBar, this, arguments)) return;

      let session = editor.getSession();
      let reqRange = editor.getCurrentRequestRange();
      if (!reqRange && !CURRENT_REQ_RANGE) return;

      if (reqRange && CURRENT_REQ_RANGE &&
         reqRange.start.row === CURRENT_REQ_RANGE.start.row &&
         reqRange.end.row === CURRENT_REQ_RANGE.end.row
      ) {
         // same request, now see if we are on the first line and update the action bar
         let cursorRow = webcurl.editor.getCursorPosition().row;
         if (cursorRow === CURRENT_REQ_RANGE.start.row) {
            updateEditorActionsBar();
         }
         return; // nothing to do..
      }

      if (CURRENT_REQ_RANGE) {
         session.removeMarker(CURRENT_REQ_RANGE.marker_id);
      }

      CURRENT_REQ_RANGE = reqRange;
      if (CURRENT_REQ_RANGE) {
         CURRENT_REQ_RANGE.marker_id = session.addMarker(CURRENT_REQ_RANGE, "ace_snippet-marker", "text");
      }
      updateEditorActionsBar();
   }

   function tryPastAsCurl(text) {
      let req = webcurl.curl.clipboardToRequest(text);
      if (req) this.insert(req.asText());
      else orgOnPaste.call(this, text);
   }

   function _copyAsCURL() {
      let req = webcurl.editor.getCurrentRequest();
      if (req) webcurl.curl.requestToClipboard(req);
   }


   /**
    * Extension functions
    */
   function createAnchor (row) {
      return new Anchor(this.getSession().getDocument(), row, 0);
   }

   function moveCursor(distance) {
      let pos = this.getCursorPosition();
      let col = pos.column;
      let row = pos.row;
      let session = this.getSession();
      if (distance < 0) {
         distance = -distance;
         while (distance > 0) {
            if (col >= distance) {
               col = col - distance;
               break;
            }
            distance -= col + 1; //1 for the newline
            if (row === 0) break;
            --row;
            col = session.getLine(row);
         }
      } else {
         let N = session.getLines().length;
         while (distance > 0) {
            let maxmove = session.getLine(row).length - col;
            if (maxmove >= distance) {
               col = col + distance;
               break;
            }
            distance -= maxmove + 1;  //1 for newline
            if (row >= N) break;
            ++row;
            col = 0;
         }
      }
      this.moveCursorTo(row, col);
   }


   function getIteratorForCurrentLoc() {
      let pos = this.getCursorPosition();
      return this.getIteratorForLocation(pos.row, pos.column);
   }

   function getIteratorForLocation(row, column) {
      let iter = new TokenIterator(this.getSession(), row, column);
      let t = iter.getCurrentToken();
      if (column === 0) {
         if (t && t.type === "paren.rparen") t = iter.stepBackward();
      }
      if (t) {
         t.row = iter.getCurrentTokenRow();
         t.column = iter.getCurrentTokenColumn();
      }
      return iter;
   }

   function getTokenUnderCursor() {
      return this.getIteratorForCurrentLoc().getCurrentToken();
   }

   function _dumpModes(editor) {
      let session = editor.getSession();
      let row = editor.getCursorPosition().row;
      let start = row - 10;
      if (start < 0) start = 0;
      let end = row + 10;
      if (end > session.getLength()) end = session.getLength();

      for (let i = start; i < end; i++) {
         let curRowMode = getRowParseMode(editor, i);
         console.log(i, ": mode=", curRowMode, ", line:", session.getLine(i));
      }
   }
   function getCurrentContainerFromIterator(tokenIter) {
      let tokens = this.getTokensForRequestBody();
      if (!tokens) return;
      let N = tokens.length;
      if (N === 0) return;
      console.log("tokens:");
      for (let i = 0; i < N; i++) {
         console.log("-- ", i, tokens[i]);
      }

      let pos = this.getCursorPosition();
      let curIdx,t;
      for (curIdx = 0; curIdx < N; curIdx++) {
         t = tokens[curIdx];
         if (t.row < pos.row) continue;
         if (t.row > pos.row) break;
         if (t.column >= pos.column) break;
         //if (t.column + t.value.length >= pos.column) break;
      }
      if (curIdx>0) curIdx--;
      t = tokens[curIdx];
      console.log("Current pos: ", pos);
      console.log("Current token: ", curIdx, t);

      let startIdx, endIdx;
      let lvl;
      if (t.type === "paren.lparen") {
         lvl = t.level;
         startIdx = curIdx;
      } else {
         lvl = t.level > 0 ? t.level - 1 : 0;
         for (startIdx = curIdx; startIdx >= 0; startIdx--) {  //Not -1, since t can be an lparen... and we should stop there
            if (tokens[startIdx].level === lvl) break;
         }
         if (startIdx < 0) startIdx = 0;
      }
      console.log("search for", lvl);
      let start = tokens[startIdx];
      console.log("Start: ", startIdx, start);

      for (endIdx = curIdx+1; endIdx < N; endIdx++) {
         if (tokens[endIdx].level === lvl) break;
      }
      if (endIdx >= N) endIdx = N - 1;
      let end = tokens[endIdx];
      console.log("End: ", endIdx, end);

      let range = new Range(start.row, start.column, end.row, end.column + 1);

      let indent = ' '.repeat(start.level * 3);

      function _formatJson (json, indent, indentFirstLine, indentSingleLine) {
         if (!json) return json;
         if (typeof (json) !== 'string') json = JSON.stringify(json, null, 3);

         let lines = json.split('\n');
         if (lines.length === 1 && !indentSingleLine) return json;
         if (indentFirstLine) lines[0] = indent + lines[0];
         for (let i = 1; i < lines.length; i++) {
            lines[i] = indent + lines[i];
         }
         return lines.join('\n');
      };

      let ret = {
         tokens: tokens,
         startIdx: startIdx,
         endIdx: endIdx,
         curIdx: curIdx,
         startToken: start,
         endToken: end,
         type: start.value == '{' ? 'object' : 'array',
         endLevel: lvl,
         range: range,
         indent: indent,
         indentValues: "   " + indent,
         formatJsonForInsertion: function (json, indentFirstLine, indentSingleLine) {
            return _formatJson(json, this.indentValues, indentFirstLine, indentSingleLine);
         },
         formatJsonForInsertionInParent: function (json, indentFirstLine, indentSingleLine) {
            return _formatJson(json, this.indent, indentFirstLine, indentSingleLine);
         }
      };
      console.log("CONTAINER:", ret, this.getSession().getTextRange(range));
      return ret;
   }



   function getLine(row) {
      return this.getSession().getLine(row) || "";
   };

   function getTokensForRequestBody(includeWhitespace) {
      let ret = [];
      let range = this.getCurrentRequestBodyRange();
      if (!range) return;
      if (includeWhitespace === undefined) includeWhitespace = true;

      let endRow = range.end.row;
      let tokenIter = this.getIteratorForLocation(range.start.row, 0);
      let t = tokenIter.getCurrentToken();
      let lvl = 0;
      for (; t; t = tokenIter.stepForward()) {
         t.row = tokenIter.getCurrentTokenRow();
         t.column = tokenIter.getCurrentTokenColumn();
         if (t.row >= endRow) break;

         t.level = lvl;
         switch (t.type) {
            case "whitespace": if (includeWhitespace) break; continue;
            case "paren.lparen": ++lvl; break;
            case "paren.rparen": if (--lvl < 0) lvl = 0; t.level = lvl; break;
         }
         ret.push(t);
      }
      return ret;
   }

   function getCurrentRequestRange() {
      let pos = this.getCursorPosition();
      if (isInBetweenRequestsRow(this, pos.row)) return null;

      let startRow = prevRequestStartRow(this, pos.row);
      let endRow = nextRequestEndRow(this, pos.row);
      return new Range(startRow, 0, endRow, this.getLine(endRow).length);
   };
   function getCurrentRequestBodyRange() {
      let pos = this.getCursorPosition();
      let startRow = pos.row;
      let endRow = pos.row;

      for (; startRow >= 0; startRow--) {
         let mode = getRowParseMode(this, startRow);
         if ((mode & ROW_PARSE_MODE.IN_REQUEST) === 0) break;
         if (startRow !== pos.row && (mode & (ROW_PARSE_MODE.REQUEST_END | ROW_PARSE_MODE.MULTI_DOC_CUR_DOC_END)) !== 0) break;
      }
      if (startRow === pos.row) return;

      for (; true; endRow++) {
         let mode = getRowParseMode(this, endRow);
         if ((mode & ROW_PARSE_MODE.IN_REQUEST) === 0) break;
         if ((mode & (ROW_PARSE_MODE.REQUEST_END | ROW_PARSE_MODE.MULTI_DOC_CUR_DOC_END)) === 0) continue;
         endRow++;
         break;
      }
      return new Range(startRow+1, 0, endRow, 0);
   };


   function getCurrentRequest() {
      let pos = this.getCursorPosition();
      if (isInBetweenRequestsRow(this, pos.row)) return null;

      let startRow = prevRequestStartRow(this, pos.row);
      let endRow = nextRequestEndRow(this, pos.row);
      let reqRange = new Range(startRow, 0, endRow, this.getLine(endRow).length);

      let request = webcurl.createRequest();
      request.range = reqRange;

      let tokenIter = this.getIteratorForLocation(startRow, 0);
      let t = tokenIter.getCurrentToken();
      for (; t; t = tokenIter.stepForward()) {
         if (t.type === 'whitespace') continue;
         if (t.type === 'method') break;
         return null;
      }
      request.method = t.value;
      request.anchor = this.createAnchor(tokenIter.getCurrentTokenRow());
      request.url = "";
      for (t = tokenIter.stepForward(); t; t = tokenIter.stepForward()) {
         if (t.type === 'whitespace') continue;
         if (!t.type.startsWith('url')) break;
         request.url += t.value;
      }

      let bodyStartRow = (t ? 0 : 1) + tokenIter.getCurrentTokenRow(); // artificially increase end of docs.
      while (bodyStartRow <= endRow) {
         let dataEndRow = nextDataDocEnd(this, bodyStartRow);
         let bodyRange = new Range(bodyStartRow, 0, dataEndRow, this.getLine(dataEndRow).length);
         let data = this.getSession().getTextRange(bodyRange);
         request.data.push(data.trim());
         bodyStartRow = dataEndRow + 1;
      }

      console.log("REQUEST=", request);
      return request;
   };

   /**
    * END of extension functions
    */





















   function createEditor(element, mode) {
      let editor = ace.edit(element);
      ace.require(mode);

      editor.getSession().setMode(mode);
      editor.getSession().setFoldStyle('markbeginend');
      editor.getSession().setUseWrapMode(true);
      editor.getSession().setTabSize(3);
      editor.getSession().setUseSoftTabs(true);
      editor.setShowPrintMargin(false);
      editor.setScrollSpeed(5);
      return editor;
   }

   function createOutputEditor() {
      let editor = createEditor("output", "ace/mode/json");
      editor.setTheme("ace/theme/monokai");
      editor.setReadOnly(true);

      editor.commands.addCommand({
         name: 'findnext',
         bindKey: { win: 'F3', mac: 'F3' },
         readOnly: true,
         exec: function (editor) { editor.findNext(); }
      });

      editor.commands.addCommand({
         name: 'findprevious',
         bindKey: { win: 'Ctrl-F3', mac: 'Ctrl-F3' },
         readOnly: true,
         exec: function (editor) { editor.findPrevious(); }
      });
      return editor;
   }

   function createCommandEditor() {
      let editor = createEditor("editor", "ace/mode/jsoncmd");
      editor.onBeforeContentReplaced = webcurl.createEvent("editor::onBeforeContentReplaced");
      editor.onAfterContentReplaced = webcurl.createEvent("editor::onAfterContentReplaced");

      editor.commands.addCommand({
         name: 'autocomplete',
         bindKey: { win: 'Ctrl-Space', mac: 'Ctrl-Space' },
         exec: webcurl.autocomplete.editorAutocompleteCommand
      });
      editor.commands.addCommand({
         name: 'autocomplete_shift',
         bindKey: { win: 'Ctrl-Shift-Space', mac: 'Ctrl-Shift-Space' },
         exec: webcurl.autocomplete.editorAutocompleteCommand
      });
      editor.commands.addCommand({
         name: 'autocomplete-index',
         bindKey: { win: 'Ctrl-Shift-X', mac: 'Ctrl-Shift-X' },
         exec: function (editor) {
            webcurl.autocomplete.editorAutocompleteCommand(editor, "index");
         }
      });
      editor.commands.addCommand({
         name: 'autocomplete-field',
         bindKey: { win: 'Ctrl-Shift-F', mac: 'Ctrl-Shift-F' },
         exec: function (editor) {
            webcurl.autocomplete.editorAutocompleteCommand(editor, "field");
         }
      });
      editor.commands.addCommand({
         name: 'autocomplete-template',
         bindKey: { win: 'Ctrl-Shift-V', mac: 'Ctrl-Shift-V' },
         exec: function (editor) {
            webcurl.autocomplete.editorAutocompleteCommand(editor, "template");
         }
      });
      editor.commands.addCommand({
         name: 'auto indent request',
         bindKey: { win: 'Ctrl-I', mac: 'Command-I' },
         exec: _autoIndent
      });
      editor.commands.addCommand({
         name: 'auto indent container',
         bindKey: { win: 'Ctrl-Shift-I', mac: 'Command-ShiftI' },
         exec: _autoIndentContainer
      });
      editor.commands.addCommand({
         name: 'send to rest service',
         bindKey: { win: 'Ctrl-Enter', mac: 'Command-Enter' },
         exec: webcurl.submitCurrentRequestToServer
      });

      editor.commands.addCommand({
         name: 'copy as cUrl',
         bindKey: { win: 'Ctrl-Shift-C', mac: 'Command-Shift-C' },
         exec: _copyAsCURL
      });

      editor.commands.addCommand({
         name: 'move to previous request start or end',
         bindKey: { win: 'Ctrl-Up', mac: 'Command-Up' },
         exec: moveToPreviousRequest
      });
      editor.commands.addCommand({
         name: 'move to next request start or end',
         bindKey: { win: 'Ctrl-Down', mac: 'Command-Down' },
         exec: moveToNextRequest
      });

      editor.commands.addCommand({
         name: 'findnext',
         bindKey: { win: 'F3', mac: 'F3' },
         readOnly: true,
         exec: function (editor) { editor.findNext(); }
      });

      editor.commands.addCommand({
         name: 'findprevious',
         bindKey: { win: 'Ctrl-F3', mac: 'Ctrl-F3' },
         readOnly: true,
         exec: function (editor) { editor.findPrevious(); }
      });

      orgOnPaste = editor.onPaste;
      editor.onPaste = tryPastAsCurl;
      editor.getSession().bgTokenizer.on("update", _onUpdate);
      editor.postponeIfNeeded = _postponeIfNeeded;
      editor.autoIndent = _autoIndent;
      editor.autoIndentContainer = _autoIndentContainer;
      editor.postponeIfNeeded = _postponeIfNeeded;


      editor.getSession().on('tokenizerUpdate', highlighCurrentRequestAndUpdateActionBar);
      editor.getSession().selection.on('changeCursor', highlighCurrentRequestAndUpdateActionBar);
      editor.getSession().on("changeScrollTop", updateEditorActionsBar);

      //Setup extension functions
      editor.createAnchor = createAnchor;
      editor.getIteratorForLocation = getIteratorForLocation;
      editor.getIteratorForCurrentLoc = getIteratorForCurrentLoc;
      editor.getTokenUnderCursor = getTokenUnderCursor;
      editor.getCurrentContainerFromIterator = getCurrentContainerFromIterator;
      editor.getLine = getLine;
      editor.getCurrentRequestRange = getCurrentRequestRange;
      editor.getCurrentRequestBodyRange = getCurrentRequestBodyRange;
      editor.getCurrentRequest = getCurrentRequest;
      editor.getTokensForRequestBody = getTokensForRequestBody;
      editor.moveCursor = moveCursor;

      return commandEditor=editor;
   }

   webcurl.registerBootstrap(function () {
      webcurl.output = createOutputEditor();
      webcurl.editor = createCommandEditor();
      highlighCurrentRequestAndUpdateActionBar();

      $("#copy_as_curl").click(function (e) {
         _copyAsCURL();
         e.preventDefault();
      });

      $("#auto_indent").click(function (e) {
         _autoIndent();
         e.preventDefault();
      });

   });

})();