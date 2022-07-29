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
   let _saveSetNames = ['default'];
   let _activeSaveSet;
   let _initialServer = ['localhost:9200'];
   let _initialContent = [];
   let _onSavesetChanged = webcurl.createEvent("storage::onSavesetChanged");

   _initialContent.push('POST _search\n{');
   _initialContent.push('   "query": { "match_all": { } }');
   _initialContent.push('}');
   _initialContent = _initialContent.join('\n');

   function createSaveSet(name) {
      return {
         name: name,
         servers: _initialServer,
         editorContent: _initialContent
      };
   }
   _activeSaveSet = createSaveSet('default');

   function notifyChange(rsn, originatingEvent) {
      console.log("Notifying changed storage", rsn, _activeSaveSet, originatingEvent);
      args = { saveset: _activeSaveSet };
      if (originatingEvent) args.originatingEvent = originatingEvent;
      _onSavesetChanged.notify (args);
   }

   function removeServerFromList(server) {
      let arr = _activeSaveSet.servers;
      if (arr.length <= 1) return;
      for (let i = 0; i < arr.length; i++) {
         if (arr[i] !== server) continue;

         arr.splice(i, 1);
         break;
      }
   }

   function fetchInitialState() {
      $.ajax({
         url: "/storage/initial_state",
         accept: "application/json;*.*",
         type: "GET",
         dataType: "json",
         complete: function (xhr, status) {
            let value;
            let ok;
            if (xhr.status === 200) {
               try {
                  value = JSON.parse(xhr.responseText);
               }
               catch (e) { }
               if (typeof (value) === 'object') {
                  _saveSetNames = value.names;
                  if (value.saveset) _activeSaveSet = value.saveset;
                  ok=true;
               }
            }
            notifyChange('init');
            if (!ok) alert("Fetch initial state failed: " + xhr.responseText);
         }
      });
   }

   function fetchSaveSet(what, originatingEvent, fnOnNonExisting) {
      $.ajax({
         url: "/storage/saveset/" + what,
         accept: "application/json;*.*",
         type: "GET",
         dataType: "json",
         complete: function (xhr, status) {
            let value, ok;
            switch (xhr.status) {
               case 404:
                  ok = true;
                  if (fnOnNonExisting) fnOnNonExisting();
                  break;
               case 200:
                  try {
                     value = JSON.parse(xhr.responseText);
                  }
                  catch (e) { }
                  if (typeof (value) === 'object') {
                     _activeSaveSet = value;
                     ok = true;
                  }
                  break
            }
            notifyChange('new set', originatingEvent);
            if (!ok) alert("Fetch initial state failed: " + xhr.status + ": " + xhr.responseText);
         }
      });
   }

   function postSaveSet(what, value) {
      $.ajax({
         url: "/storage/saveset/" + what,
         accept: "application/json;*.*",
         contentType: "application/json",
         type: "POST",
         data: JSON.stringify(value),
         dataType: "json",
         complete: function (xhr, status) {
            if (xhr.status !== 200) {
               alert("save [" + what + "] failed: " + xhr.responseText);
            }
         }
      });
   }

   function postNames(value) {
      $.ajax({
         url: "/storage/names",
         accept: "application/json;*.*",
         contentType: "application/json",
         type: "POST",
         data: JSON.stringify(value),
         dataType: "json",
         complete: function (xhr, status) {
            if (xhr.status !== 200) {
               alert("save namelist failed: " + xhr.responseText);
            }
         }
      });
   }

   function setActiveSaveSet(saveset, originatingEvent) {
      console.log("setActiveSaveSet. existing=", _activeSaveSet.name, ", new=", saveset);
      if (!saveset) return false;
      if (saveset.toLowerCase() === _activeSaveSet.name.toLowerCase()) return false;

      console.log("setActiveSaveSet doing work...");
      if (notifyUsage(_saveSetNames, 1000, saveset))
         postNames(_saveSetNames);

      //Save current saveset
      if (_activeSaveSet) postSaveSet(_activeSaveSet.name, _activeSaveSet);

      //Copy the set from the existing one
      _activeSaveSet = {
         name: saveset,
         servers: _activeSaveSet.servers.slice(),
         editorContent: _activeSaveSet.editorContent
      };

      //Fetch, and if not not found: save current saveset as the new one
      fetchSaveSet(saveset, originatingEvent, function () {
         postSaveSet(_activeSaveSet.name, _activeSaveSet);
      });
      return true;
   }

   function notifyUsage(arr, maxNum, value) {
      if (!value) return false;
      let lcValue = value.toLowerCase();
      let ix = arr.findIndex(item => lcValue === item.toLowerCase());
      if (ix === 0) return false; //It was already the top item!

      if (ix >= 0) arr.splice(ix, 1);
      arr.splice(0, 0, value);
      arr.splice(maxNum, maxNum);
      return true; //Indicate changed
   }

   function saveState (server, editorContent) {
      console.log("storage.saveState, content equal: ", editorContent === _activeSaveSet.editorContent);
      if (!notifyUsage(_activeSaveSet.servers, 1000, server) && editorContent === _activeSaveSet.editorContent) return;
      console.log("-- updating");
      _activeSaveSet.editorContent = editorContent;
      postSaveSet(_activeSaveSet.name, _activeSaveSet);
   }

   webcurl.registerBootstrap(fetchInitialState, 99999);

   webcurl.storage = {
      onSavesetChanged: _onSavesetChanged,
      getServerList: function () { return _activeSaveSet.servers; },
      getEditorContent: function () { return _activeSaveSet.editorContent; },
      getSaveSetName: function () { return _activeSaveSet.name; },
      getSaveSetNames: function () { return _saveSetNames},
      setActiveSaveSet: setActiveSaveSet,
      saveState: saveState,
      removeServerFromList: removeServerFromList
   };

})();





