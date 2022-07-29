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
webcurl.plugins = function () {
   let _responsePlugins = [];
   let _responsePluginDict = {};
   let _mapperPlugins = {};
   let _lastOrder = 0;
   let _fn;

   function _cmpOrder(a, b) {
      return a.order - b.order;
   }

   function _initialize() {
      _responsePlugins.sort(_cmpOrder);
      console.log('Loaded response plugins:', _responsePlugins);
      _responsePluginDict = undefined;
      console.log('Loaded mapping plugins:', _mapperPlugins);
   };

   function _registerResponsePlugin (name, obj) {
      _lastOrder += 100;
      if (!obj.order && obj.order !== 0) obj.order = _lastOrder;
      obj.name = name;

      if (_responsePluginDict[name]) {
         console.log("Duplicate response plugin for [" + name + "]: ", obj, ", existing:", _responsePluginDict[name]);
         throw 'Duplicate response plugin: ' + name;
      }
      _responsePluginDict[name] = obj;
      _responsePlugins.push(obj);
   };

   function _registerMappingPlugin(name, obj) {
      if (_mapperPlugins[name]) {
         console.log("Duplicate mapper plugin for [" + name + "]: ", obj, ", existing:", _mapperPlugins[name]);
         throw 'Duplicate mapper plugin: ' + name;
      }
      obj.name = name;
      _mapperPlugins[name] = obj;
   };


   function _getIndexMapperPlugin(name) {
      let ret = _mapperPlugins[name];
      if (ret === undefined) {
         ret = _mapperPlugins["noop"];
         console.log("No mapper plugin found for ", name, " noop plugin used.");
      }
      return ret;
   }

   function _getResponsePlugins(strRegex) {
      if (strRegex === "") return [];
      if (!strRegex || strRegex === "*") return _responsePlugins;

      let expr = new RegExp(strRegex, 'id');
      let ret = [];
      for (let v of _responsePlugins) {
         if (expr.test(v.name)) ret.push(v);
      }
      return ret;
   }

   function _handleOnResponse(resp, endpoint) {
      for (i = 0; i < _responsePlugins.length; i++) {
         try {
            resp = _responsePlugins[i].onResponse(resp, endpoint);
         } catch (e) {
            console.log("Error in plugin [" + _responsePlugins[i].name + "]: " + e);
         }
      }
      return resp;
   }

   function _nop() { };

   _registerMappingPlugin("noop", {
      deactivate: _nop,
      activate: _nop,
      getAutocompleteValuesForUrl: _nop,
      getAutocompleteValuesForIndex: _nop,
      getAutocompleteValuesForField: _nop
   });

   return {
      registerResponsePlugin: _registerResponsePlugin,
      registerMappingPlugin: _registerMappingPlugin,
      initialize: function () {
         _initialize();
         this.getIndexMapperPlugin = _getIndexMapperPlugin;
         this.getResponsePlugins = _getResponsePlugins;
         delete this._registerResponsePlugin;
         delete this._registerMappingPlugin;
         delete this.initialize;
         delete this.setFileName;
      },
      handleOnResponse: _handleOnResponse,
      setFilename: function (fn) { _fn = fn; }
   };
}();