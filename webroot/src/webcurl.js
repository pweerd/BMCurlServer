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
webcurl = (function () {

   let _bootstraps = [];
   let _titleSuffix;

   class EventArgs {
      #isPropagationStopped;
      #isImmediatePropagationStopped;

      constructor(args) {
         this.#isPropagationStopped = false;
         this.#isImmediatePropagationStopped = false;
         this.data = args !== undefined ? args : {};
      }

      stopPropagation () {
         this.#isPropagationStopped = true;
      };

      isPropagationStopped () {
         return this.#isPropagationStopped;
      };

      stopImmediatePropagation () {
         this.#isImmediatePropagationStopped = true;
      };

      isImmediatePropagationStopped () {
         return this.#isImmediatePropagationStopped;
      }
   };

   /***
    * A simple publisher-subscriber implementation.
    */
   class Event {
      #handlers;
      #name;

      constructor(name) {
         this.#name = name;
         this.#handlers = [];
      }

      subscribe (fn) {
         this.#handlers.push(fn);
      };

      unsubscribe (fn) {
         for (let i = this.handlers.length - 1; i >= 0; i--) {
            if (this.#handlers[i] === fn) {
               this.#handlers.splice(i, 1);
            }
         }
      };

      /***
       * The 1st parameter accepts either an EventArgs class or an object with params.
       * The handlers will be called with an EventsArgs object, containing the supplied arguments
       */
      notify (argsOrEvent, scope) {
         let e = EventArgs.prototype.isPrototypeOf(argsOrEvent) ? argsOrEvent : new EventArgs(argsOrEvent);
         if (!e.source) e.source = this;

         scope = scope || this;
         let returnValue;
         let handlers = this.#handlers;
         for (let i = 0; i < handlers.length && !(e.isPropagationStopped() || e.isImmediatePropagationStopped()); i++) {
            returnValue = handlers[i].call(scope, e);
         }
         return returnValue;
      };

      numHandlers() {
         return this.#handlers.length;
      }
   }

   function _createEvent(name) { return new Event(name); }
   function _createEventArgs(args) { return new EventArgs(args); }

   let $server = $("#es_server");
   let $bookmark = $("#anchor");
   let $saveset = $("#save_set");

   function _getBookmarks() {
      let sess = webcurl.editor.getSession();
      let lines = sess.doc.getAllLines();
      let ret = [];
      for (let i = 0; i < lines.length; i++) {
         let line = lines[i];
         if (line.startsWith('#')) ret.push(line.toLowerCase());
      }
      ret.sort();
      return ret;
   }
   function _positionToBookmark(bookmark) {
      bookmark = bookmark.toLowerCase();
      let sess = webcurl.editor.getSession();
      let lines = sess.doc.getAllLines();
      for (let i = 0; i < lines.length; i++) {
         if (lines[i].toLowerCase().startsWith(bookmark)) {
            console.log("GOTO line", i);
            webcurl.editor.gotoLine(i + 2); //+1 since lines are 1 based, +1 because we want to position after 
            webcurl.editor.scrollToLine(i+2, true, true, function () { });
            webcurl.history.push(webcurl.editor.createAnchor(i + 1));
            return;
         }
      }
      console.log("BOOKMARK", bookmark, "not found");
   }

   function _createRequest() {
      return {
         range: null,
         method: "",
         server: "",
         url: "",
         data: [],
         asText: function () {
            return this.method + " " + this.url + "\n" + this.data.join('\n');
         }
      };
   }


   $server.blur(function () {
      webcurl.server.setServer($server.val(), false);
   });

   function _initAutocomplete($sel, cbSource, cbOnContextMenu) {
      if (!cbOnContextMenu) cbOnContextMenu = function (ev) {
         ev.preventDefault();
         ev.stopPropagation();
         return false;
      };
      $sel.autocomplete({
         minLength: 0,
         source: [],
         select: function (event, ui) {
            console.log("AC_SRV select", ui, event);
            $sel.val(ui.item.label);
            _focusToEditor();
         }
      }).focus(function (ev) {
         $sel.autocomplete("option", "source", cbSource()).select().autocomplete("search", "");
      })
      .keyup(function (ev) {
         if (ev.keyCode === 13) {
            event.preventDefault();
            _focusToEditor();
         }
      })
      .autocomplete("widget").on("contextmenu", cbOnContextMenu);
      return $sel;
   }

   function _focusToEditor() {
      $("#editor  textarea").focus();
   }


   function _normalizeJSON(obj) {
      if (obj === null || typeof obj !== 'object') return obj;

      let ret;
      if (Array.isArray(obj)) {
         ret = [];
         for (let i = 0; i < obj.length; i++) {
            ret.push(_normalizeJSON(obj[i]));
         }
         return ret;
      }

      let keys = [];
      for (let key in obj) keys.push(key);
      keys.sort();
      ret = {};
      for (let i = 0; i < keys.length; i++) {
         let key = keys[i];
         ret[key] = _normalizeJSON(obj[key]);
      }
      return ret;
   }

   let _currentXhr;
   function _submitCurrentRequestToServer() {
      let editor = webcurl.editor;
      if (editor.postponeIfNeeded(_submitCurrentRequestToServer, this, arguments)) return;

      let req = editor.getCurrentRequest();
      if (!req) return;

      $("#notification").text("Calling REST service....").css("visibility", "visible");
      webcurl.output.getSession().setValue('');

      let es_data = '';
      let tmp = [];
      if (req.data.length > 0) {
         for (let i = 0; i < req.data.length; i++) tmp.push(req.data[i].replace(/[\n]/gm, ""));  //remove all newlines
         tmp.push("");
         es_data = tmp.join('\n');
      }
      console.log("ESDATA:", es_data);
      let es_startTime = new Date().getTime();

      if (req.anchor) webcurl.history.push(req.anchor);
      webcurl.storage.saveState(webcurl.server.getServer(), webcurl.editor.getValue());

      if (_currentXhr) _currentXhr.abort();
      _currentXhr = webcurl.server.callServer(req.url, req.method, es_data, null, function (xhr) {
         if (xhr.status === 0) return; //Aborted. Do nothing at all
         let took = -1;
         if (es_startTime) {
            took = new Date().getTime() - es_startTime;
         }

         $("#notification").text("").css("visibility", "hidden");
         webcurl._currentXhr = null;
         let ok = typeof xhr.status === "number" && ((xhr.status >= 400 && xhr.status < 600) || (xhr.status >= 200 && xhr.status < 300));

         if (!ok) {
            webcurl.output.getSession().setValue("Request failed to get to the server (status code: " + xhr.status + "):" + xhr.responseText);
            return;
         }

         let ep = xhr.getResponseHeader('X_endpoint');
         let value = xhr.responseText;
         try {
            value = JSON.parse(value);
         }
         catch (e) { console.log("Cannot parse response: ", e); }

         let tookStr = xhr.getResponseHeader('X_took');
         if (tookStr) took = parseInt(tookStr);

         //Insert call time and status. Don't overwrite existing values
         if (null !== value && typeof (value) === 'object' && !Array.isArray(value)) {
            if (value['__call_took'] === undefined) value['__call_took'] = took;
            if (value['__call_status'] === undefined) value['__call_status'] = xhr.status;
         }

         //Normalize if requested
         try {
            if (webcurl.normalize && value !== null && typeof (value) === 'object') {
               value = _normalizeJSON(value);
            }
         }
         catch (e) { console.log("Cannot normalize response: ", e); }

         //Call plugins to format the response
         let plugins = webcurl.server.getServerParms().responsePlugins;
         if (Array.isArray(plugins)) {
            for (let obj of plugins) {
               try {
                  value = obj.onResponse(value, ep);
               }
               catch (e) { console.log("Response plugin [" + obj.name + "] failed: ", e); }
            }
         }

         //Convert to string
         if (null !== value && typeof (value) === 'object') {
            value = JSON.stringify(value, null, 3);
         }

         webcurl.output.getSession().setValue(value);
         webcurl.editor.focus();
      });
   }


   function _registerBootstrap(fn, order) {
      let order2 = 10 * _bootstraps.length;
      _bootstraps.push({ fn: fn, order1: order !== undefined ? order : order2, order2 });
   }






   $(document).ready(function () {
      _titleSuffix = "] - " + document.title;




      console.log("Bootstrap called ", _bootstraps);
      if (_bootstraps) {
         _bootstraps.sort(function (x, y) {
            //ascending order1
            if (x.order1 < y.order1) return -1;
            if (x.order1 > y.order1) return 1;
            //ascending order2
            if (x.order2 < y.order2) return -1;
            if (x.order2 > y.order2) return 1;
            return 0;
         });
         console.log("SORTED bootstraps: ", _bootstraps);
         for (let i = 0; i < _bootstraps.length; i++) {
            let bt = _bootstraps[i];
            console.log("Bootstrapping ", bt);
            bt.fn.call();
         }
         _bootstraps = undefined; 
      }

      webcurl.storage.onSavesetChanged.subscribe(function (ev) {
         console.log("BASE onSavesetChg", ev);
         document.title = "[" + ev.data.saveset.name + _titleSuffix;
         $saveset.val(ev.data.saveset.name);
         webcurl.editor.onBeforeContentReplaced.notify(ev);
         try {
            webcurl.autocomplete.disable();
            webcurl.editor.getSession().setValue(ev.data.saveset.editorContent);
            webcurl.editor.onAfterContentReplaced.notify(ev);
         } finally {
            webcurl.autocomplete.enable();
         }

         webcurl.output.getSession().setValue('');

         //Is this a postponed history action?
         let orgEvent = ev.data.originatingEvent;
         if (orgEvent && orgEvent.source === webcurl.history.onChange) {
            console.log("BASE: postponed history");
            webcurl.history.onChange.notify(ev.data.originatingEvent);
         } else {
            console.log("BASE: push save saveset::0");
            webcurl.history.push(webcurl.editor.createAnchor(0));
         }
      });

      webcurl.history.onChange.subscribe(function (ev) {
         console.log("BASE: onChange", ev);
         if (webcurl.storage.setActiveSaveSet(ev.data.saveset, ev)) {
            console.log("BASE: saveset changed. exiting");
            return;
         }
         let sess = webcurl.editor.getSession();
         let anchor = ev.data.anchor;
         if (sess.getDocument() === anchor.document) {
            console.log("SAME doc. goto", anchor.row);
            webcurl.editor.gotoLine(anchor.row + 1);  //Lines are 1-based
            webcurl.editor.scrollToLine(anchor.row + 1, true, true, function () { });
            webcurl.server.setServer(ev.data.server, true);
         }
      });



      _initAutocomplete($server, function () { return webcurl.storage.getServerList(); })
         .autocomplete("widget")
         .on("contextmenu", function (ev) {
            let txt = $(ev.target).text();
            webcurl.storage.removeServerFromList(txt);
            $server.autocomplete("close").val(webcurl.storage.getServerList()[0]);

            ev.preventDefault();
            ev.stopPropagation();
            return false;
         });

      _initAutocomplete($bookmark, function () { return webcurl.getBookmarks(); })
         .autocomplete({
            select: function (event, ui) {
               _focusToEditor();
               webcurl.positionToBookmark(ui.item.label);
            }
         });

      _initAutocomplete($saveset, function () { return webcurl.storage.getSaveSetNames(); })
         .on("blur", function () {
            webcurl.storage.saveState(webcurl.server.getServer(), webcurl.editor.getValue());
            webcurl.storage.setActiveSaveSet($saveset.val());
         }).autocomplete({
            select: function (event, ui) {
               //console.log("AC_SET select", ui, event);
               $saveset.val(ui.item.label);
               $bookmark.val('');
               _focusToEditor();
            }
         });

      $("#chk_normalize").on("change", function (ev) {
         webcurl.normalize = $(ev.target).is(":checked");
      });

      $("#editor").resizable({
         autoHide: false,
         handles: 'e',
         start: function (e, ui) {
            $(".ui-resizable-e").addClass("active");
         },
         stop: function (e, ui) {
            $(".ui-resizable-e").removeClass("active");

            //let parent = ui.element.parent();
            let editorSize = ui.element.outerWidth();
            $("#output").css("left", editorSize);
            $("#editor_actions").css("margin-right", -editorSize + 3);
            webcurl.editor.resize(true);
            webcurl.output.resize(true);
         }
      });

      $("#send").tooltip();
      $("#send").click(function () {
         webcurl.submitCurrentRequestToServer();
         return false;
      });

      webcurl.editor.focus();
   });


   return {
      VERSION: "1.0.0",
      createEvent: _createEvent,
      createEventArgs: _createEventArgs,
      getBookmarks: _getBookmarks,
      positionToBookmark: _positionToBookmark,
      submitCurrentRequestToServer: _submitCurrentRequestToServer,
      registerBootstrap: _registerBootstrap,
      createRequest: _createRequest
   }
})();