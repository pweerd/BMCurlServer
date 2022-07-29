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
/*
 * Sample mapper for your data
 */
(function () {
   let per_index_fields = {};
   let _active = false;
   let _loaded = false;
   let _timer = undefined;

   const _api = [
      "_search",
      "_template",
      "_aliases",
      "_stats",
      "_cluster/nodes/stats",
      "_cluster/state",
      "_cluster/health",
      "_cluster/settings",
      "_warmer",
      "_settings",
      "_refresh",
      "_segments",
      "_status",
      "_cache/clear",
      "_mapping"
   ];


   function _activate() {
      _active = true;
      _loaded = false;
      _timer = setInterval(retrieve, 60000);
      retrieve();
   }

   function _deactivate() {
      _active = false;
      clearInterval(_timer);
      per_index_fields = {};
   }


   function _getFields(index, types) {
      if (!_loaded) return [];
      return per_index_fields[index] || [];
   }


   function _getIndexes(include_aliases) {
      return Object.keys(per_index_fields);
   }


   const _regexCmd1 = new RegExp('(GET|POST|DELETE|PUT|HEAD) +/?([^/]+)/([^/?]+)', 'id');
   const _regexCmd2 = new RegExp('(GET|POST|DELETE|PUT|HEAD) +/?([^/?]+)', 'id');
   function _parseCmdLine(cmd) {
      let m = _regexCmd1.exec(cmd);
      return m ? m : _regexCmd2.exec(cmd);
   }
   function _getAutocompleteValuesForUrl(cmd, pos, type) {
      if (!_loaded) return [];
      switch (type || '') {
         case '':
         case 'url.part': break;
         default: return [];
      }
      let m = _parseCmdLine(cmd);
      console.log('m1=', m);
      if (!m) return;

      let idx = -1;
      for (let i = 2; i < m.indices.length; i++) {
         let indices = m.indices[i];
         if (pos >= indices[0] && pos <= indices[1]) {
            idx = i;
            break;
         }
      }
      let ret;
      switch (idx) {
         //0: total
         //1: method
         case 2: ret = [].concat(_getIndexes(true), _api); break;
         case 3: ret = [].concat(_getFields(m[2]), _api); break;
      }
      return ret;
   }

   function _getAutocompleteValuesForField(cmd) {
      if (!_loaded) return [];

      let m = _parseCmdLine(cmd);
      console.log('m1=', m);
      if (!m) return;

      return m ? _getFields(m[2], m[3]) : [];
   }


   function _loadMappings(mappings) {
      //Fill your per_index_fields structures
      console.log("LOADED mappings: ", per_index_fields)
   }


   function retrieve() {
      if (!_active) return;
      webcurl.server.callServer("<URL_TO_GET_MAPPING_DATA", "GET", null, function (data, status, xhr) {
         if (!_active || xhr.status !== 200) return;
         _loadMappings(data);
         _loaded = true;
      });
   }

   webcurl.plugins.registerMappingPlugin("<YOUR_AC_NAME>", {
      activate: _activate,
      deactivate: _deactivate,

      getAutocompleteValuesForUrl: _getAutocompleteValuesForUrl,
      getAutocompleteValuesForIndex: _getIndexes,
      getAutocompleteValuesForField: _getAutocompleteValuesForField
   });

})();