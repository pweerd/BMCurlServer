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

   function detectCURL(text) {
      // returns true if text matches a curl request
      if (!text) return false;
      return text.match(/^\s*?curl\s+(-X[A-Z]+)?\s*['"]?.*?['"]?(\s*$|\s+?-d\s*?['"])/);
   }

   function parseCURL(text) {
      let ret = webcurl.createRequest();
      let matches = text.match(/^\s*?curl\s+(?:-s\s+)?(-X\s*[A-Z]+)?\s*/);
      if (matches[1]) {
         ret.method = matches[1].substring(2).trim(); // strip -X
      }
      text = text.substring(matches[0].length); // strip everything so far.
      if (text.length === 0) return ret;
      if (text[0] === '"') {
         matches = text.match(/^"([^"]*)"/);
      }
      else if (text[0] === "'") {
         matches = text.match(/^'([^']*)'/);
      }
      else {
         matches = text.match(/^(\S*)/);
      }

      if (!matches) return ret;
      let url = matches[1];

      if (!url.match(/:\/\//)) url = "http://" + url; // inject http as curl does

      let urlAnchor = document.createElement("a");
      urlAnchor.href = url;

      ret.server = (urlAnchor.protocol || "http") + "//" + urlAnchor.hostname;
      if (urlAnchor.port && urlAnchor.port !== 0) ret.server += ":" + urlAnchor.port;
      ret.url = (urlAnchor.pathname || "") + (urlAnchor.search || "");

      text = text.substring(matches[0].length);

      // now search for -d
      matches = text.match(/.*-d\s*?'/);
      let data = null;
      if (matches) {
         data = text.substring(matches[0].length).replace(/'\s*$/, '');
      }
      else {
         matches = text.match(/.*-d\s*?"/);
         if (matches) {
            data = text.substring(matches[0].length).replace(/"\s*$/, '');
            data = ret.data.replace(/\\(.)/gi, "$1");
         }
      }

      if (data) ret.data.push(data.trim());

      return ret;
   }


   function copyToClipboard(value) {
      let currentActive = document.activeElement;
      let clipboardStaging = $("#clipboardStaging");
      clipboardStaging.val(value);
      clipboardStaging.select();
      document.execCommand("Copy", false);
      $(currentActive).focus(); // restore focus.
   }


   function clipboardToRequest(text) {
      if (text && detectCURL(text)) {
         let req = parseCURL(text);
         if (webcurl.server.getServer()) req.server = null; // do not override server
         if (!req.method) req.method = "GET";
         return req;
      }
      return null;
   }

   function requestToClipboard(req) {
      if (!req) return;

      let es_data = req.data;

      let curl = 'curl -X' + req.method + ' "' + webcurl.server.constructUrl(req.url) + '"';
      if (es_data && es_data.length) {
         curl += " -d'\n";
         // since webcurl doesn't allow single quote json string any single qoute is within a string.
         curl += es_data.join("\n").replace(/'/g, '\\"');
         if (es_data.length > 1) curl += "\n"; // end with a new line
         curl += "'";
      }
      //console.log(curl);
      copyToClipboard(curl);
   }


   webcurl.curl = {};
   webcurl.curl.parseCURL = parseCURL;
   webcurl.curl.detectCURL = detectCURL;
   webcurl.curl.requestToClipboard = requestToClipboard;
   webcurl.curl.clipboardToRequest = clipboardToRequest;

})();
