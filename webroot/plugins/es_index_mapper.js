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
   let _per_index_types = {};
   let _per_alias_indexes = {};
   let _active = false;
   let _loaded = false;
   let _timer = undefined;

   const _api = [
      "_search",
      "_analyze",
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
      _per_index_types = {};
      _per_alias_indexes = {};
   }

   /* Normalize indexes. At can be:
    * - a string
    * - an array
    * - empty
    * We always return an array, where indexnames are dedupped.
    * Also: in case of empty: we return all known indexes
    */
   function _normalizeIndexes(indexes) {
      if (!indexes) return [];

      if (typeof indexes === "string") indexes = [indexes];

      let names = {};
      for (const index of indexes) {
         let indexesFromAlias = _per_alias_indexes[index];
         if (!indexesFromAlias)
            names[index] = 1;
         else
            for (const name of indexesFromAlias) names[name] = 1;
      }
      return Object.keys(names);
   }

   /* Normalize types.
    * Per index we always return an array of typenames within that index.
    * Types can be:
    * - a string
    * - an array
    * - empty
    * In case of empty: we return all known types for this index
    */
   function _normalizeTypes(index, types) {
      let indexTypes = _per_index_types[index];
      if (!indexTypes) return [];

      if (typeof types === "string") {
         types = (types.startsWith("_") && types !== "_doc") ? undefined : [types];
      }
      return types ? types : Object.keys(indexTypes);
   }



   function _getFields(indices, types) {
      if (!_loaded) return [];
      // get fields for indices and types. Both can be a list, a string or null (meaning all).
      let names = {};
      indices = _normalizeIndexes(indices);
      for (const index of indices) {
         let typesFromIndex = _per_index_types[index];
         if (!typesFromIndex) continue;

         let typeNames = _normalizeTypes(index, types);
         for (const typeName of typeNames) {
            _addNames(names, typesFromIndex[typeName]);
         }
      }
      return Object.keys(names).sort();
   }

   function _addNames(names, dictOrArr) {
      if (!dictOrArr) return;
      if (Array.isArray(dictOrArr)) {
         for (const name of dictOrArr) names[name] = 1;
      } else {
         for (const name in dictOrArr) names[name] = 1;
      }
   }

   function _getTypes(indices) {
      if (!_loaded) return [];
      let types = {};
      for (const index of _normalizeIndexes(indices)) {
         _addNames(types, _per_index_types[index]);
      }
      return Object.keys(types).sort();
   }


   function _getIndexes(include_aliases) {
      let ret = Object.keys(_per_index_types);
      if (typeof include_aliases === "undefined" ? true : include_aliases) {
         for (const name in _per_alias_indexes)
            ret.push(name);
      }
      return ret.sort();
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
         case 3: ret = [].concat(_getTypes(m[2]), _api); break;
      }
      return ret;
   }

   function _getAutocompleteValuesForField (cmd) {
      if (!_loaded) return [];

      let m = _parseCmdLine(cmd);
      console.log('m1=', m);
      if (!m) return;

      return m ? _getFields(m[2], m[3]) : [];
   }


   function _getFieldNamesFromFieldMapping(names, fieldsObject, baseName) {
      if (fieldsObject['enabled'] === false) return names;

      for (const name in fieldsObject) {
         let fullName = baseName ? baseName + '.' + name : name;
         names[fullName] = 1;

         let sub = fieldsObject[name];
         if (sub.properties) _getFieldNamesFromFieldMapping(names, sub.properties, fullName);
         else if (sub.fields) _getFieldNamesFromFieldMapping(names, sub.fields, fullName);
      }
      return names;
   }

   function _getFieldNamesFromTypeMapping(type_mapping) {
      if (!type_mapping || !type_mapping['properties']) return [];
      let names = _getFieldNamesFromFieldMapping({}, type_mapping['properties']);
      return Object.keys(names).sort();
   }

   function _loadMappings(mappings) {
      _per_index_types = {};
      $.each(mappings, function (index, index_mapping) {
         //console.log("Handling index", index, index_mapping);
         let normalized_index_mappings = {};
         index_mapping = index_mapping.mappings;
         if (index_mapping === undefined) return;
         if (index_mapping.properties !== undefined) {
            //console.log("-- Handling type", "_doc");
            normalized_index_mappings['_doc'] = _getFieldNamesFromTypeMapping(index_mapping);
         } else {
            $.each(index_mapping, function (type_name, type_mapping) {
               //console.log("-- Handling type", type_name);
               normalized_index_mappings[type_name] = _getFieldNamesFromTypeMapping(type_mapping);
            });
         }
         _per_index_types[index] = normalized_index_mappings;
      });

      console.log("LOADED mappings: ", _per_index_types)
   }

   function _loadAliases(aliases) {
      _per_alias_indexes = {};
      $.each(aliases, function (index, index_aliases) {
         $.each(index_aliases.aliases, function (alias) {
            if (alias === index) return; // alias which is identical to index means no index.
            let cur_aliases = _per_alias_indexes[alias];
            if (!cur_aliases) {
               cur_aliases = [];
               _per_alias_indexes[alias] = cur_aliases;
            }
            cur_aliases.push(index);
         });
      });

      _per_alias_indexes['_all'] = _getIndexes(false);
   }


   function retrieve() {
      console.log("ES_MAPPING retrieve");
      if (!_active) return;
      webcurl.server.callServer("_mapping", "GET", null, function (data, status, xhr) {
         if (!_active || xhr.status !== 200) return;
         _loadMappings(data);
         webcurl.server.callServer("_aliases", "GET", null, function (data, status, xhr) {
            if (!_active || xhr.status !== 200) return;
            _loadAliases(data);
            _loaded = true;
         });
      });
   }

   webcurl.plugins.registerMappingPlugin("es", {
      activate: _activate,
      deactivate: _deactivate,

      getAutocompleteValuesForUrl: _getAutocompleteValuesForUrl,
      getAutocompleteValuesForIndex: _getIndexes,
      getAutocompleteValuesForField: _getAutocompleteValuesForField
   });

})();