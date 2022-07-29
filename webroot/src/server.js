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

   let _onServerChange = webcurl.createEvent("webcurl::server::onServerChange");
   let _currentServerParms = {server: ""};
   let _xhrEndpoint = null;


   function _getServer() {
      return _currentServerParms ? _currentServerParms.server : "";
   }
   function _getServerParms() {
      return _currentServerParms;
   }

   function _setServer(srv, setUiToo) {
      let server = srv.trim();

      console.log("setServer (", server, ", ", setUiToo, ")");
      if (setUiToo !== false) $("#es_server").val(server);

      if (!_currentServerParms || _currentServerParms.server !== server) {
         let newAdmin = _currentServerParms = { server: server };

         console.log("ONSERVERCHANGE1: ", newAdmin);
         _onServerChange.notify(newAdmin);
         if (_xhrEndpoint) _xhrEndpoint.abort();
         _xhrEndpoint = $.ajax({
            url: "/endpoint_type?url=" + encodeURIComponent(srv),
            accept: "application/json;*.*",
            type: "GET",
            complete: function (xhr, status) {
               if (xhr.status === 0) return; //Aborted: just do nothing
               _xhrEndpoint = null;
               let value;
               if (xhr.status === 200) {
                  try {
                     value = JSON.parse(xhr.responseText);
                  }
                  catch (e) { }
                  if (typeof (value) === 'object') {
                     newAdmin.endpoint = value.endpoint;
                     newAdmin.mappingPluginName = value.autocomplete;
                     newAdmin.mappingPlugin = webcurl.plugins.getIndexMapperPlugin(value.autocomplete);

                     newAdmin.responsePluginsExpr = value.responsePluginsExpr;
                     newAdmin.responsePlugins = webcurl.plugins.getResponsePlugins(value.responsePluginsExpr);

                     newAdmin.templates = value.templates || {};
                     console.log("ONSERVERCHANGE2: ", newAdmin);

                     let oldServerParams = _currentServerParms;
                     oldServerParams = newAdmin;
                     if (oldServerParams && oldServerParams.mappingPlugin) oldServerParams.mappingPlugin.deactivate();
                     _onServerChange.notify(newAdmin);
                     if (newAdmin.mappingPlugin) newAdmin.mappingPlugin.activate();
                     return;
                  }
               }
               console.error("Fetch /endpoint_type failed: " + xhr.responseText);
            }
         });

      }
   }
   function _encodeUrl(url) {
      let i;
      let arr = [];
      for (i = 0; i < url.length; i++) {
         let ch = url.charAt(i);
         if (url.charCodeAt(i) < 128) {
            switch (ch) {
               case ' ':
               case '+':
               case '^':
               case ':':
               case '\\':
               case '|':
               case '$': break;
               default: arr.push(ch); continue;
            }
         }
         arr.push(encodeURIComponent(ch));
      }
      return arr.join("");
   }

   function _constructUrl(url) {
      if (url.indexOf("://") >= 0) return url;
      let server = _getServer();
      if (server.indexOf("://") < 0) server = "http://" + server;
      if (server.substr(-1) === "/") {
         server = server.substr(0, server.length - 1);
      }
      if (url.charAt(0) === "/") url = url.substr(1);
      console.log("Url before enc=", url);
      let encUrl = _encodeUrl(url);
      console.log("Url after enc=", encUrl);

      return server + "/" + encUrl;
   }

   function _callServer(urlPath, method, data, successCallback, completeCallback) {

      let url = _constructUrl(urlPath);
      let uname_password_re = /^(https?:\/\/)?(?:(?:(.*):)?(.*?)@)?(.*)$/;
      let url_parts = url.match(uname_password_re);

      let uname = url_parts[2];
      let password = url_parts[3];
      url = url_parts[1] + url_parts[4];
      console.log("Calling:", url, "  (uname: " + uname + " pwd: " + password + ")");
      if (data && method === "GET") method = "POST";
      if (method === "POST" && data.length === 0) data = "{}";

      //Transform it into our ajax service
      url = "/service?url=" + encodeURIComponent(url);

      return $.ajax({
         url: url,
         data: method === "GET" ? null : data,
         contentType: "application/json",
         accept: "application/json;*.*",
         password: password,
         username: uname,
         type: method,
         dataType: "json",
         complete: completeCallback,
         success: successCallback
      });
   }





   webcurl.server = {
      constructUrl: _constructUrl,
      getServer: _getServer,
      getServerParms: _getServerParms,
      setServer: _setServer,
      callServer: _callServer
   };

   webcurl.registerBootstrap(function () {
      webcurl.storage.onSavesetChanged.subscribe(function (ev) {
         _setServer(ev.data.saveset.servers[0]);
      }, 0);
   });

})();
