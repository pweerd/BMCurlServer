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

   let _levels = [""];
   for (let i=1; i<30; i++) {
      _levels.push(_levels[i-1] + "-- ");
   }
   
   function _level(i) { 
      if (i>=_levels.length) i= _leve.length-1;
      return _levels[i];
   }

   function readTrimmedDescription(explain) {
      let desc = explain.description;
      return desc ? desc.replace(new RegExp("^[: ]+|[: ]+$", "g"), "") : "";
   }
   function readDetails(explain) {
      return explain.details ? explain.details : [];
   }
   function getSimilarityDetails(details) {
      if (details.length === 1) {
         let explain = details[0];
         let desc = readTrimmedDescription(explain);
         if (desc === "Combined from") return readDetails(explain);
      }
      return details;
   }
   
   function _format (arr, lvl, explain) {
      if (!explain) return;

      let value = explain.value;
      let desc = readTrimmedDescription(explain);
      let details = readDetails(explain);

      if (value === 1.0 && desc === "queryBoost") return;
      if (details.length===1 && lvl===0 && desc==="sum of") {
         return _format(arr, lvl, details[0]);
      }
      if (details.length===2 && desc==="min of" && details[1].description==="maxBoost") {
         return _format(arr, lvl, details[0]);
      }

      if (desc.startsWith("weight(") && desc.endsWith(") [PerFieldSimilarity], result of")) {
         desc = desc.substring(7, desc.length - 33);
         details = getSimilarityDetails(details);
      }

      arr.push (_level(lvl) + value.toFixed(3) + ', ' + desc);

      ++lvl;
      for (let i = 0; i < details.length; i++) 
         _format (arr, lvl, details[i]);
   }
   


   function formatExplain(hit) {
      let explain = hit._explanation;
      if (!explain) return;    

      let arr = [];       
      _format (arr, 0, explain);
      let src = hit._source;
      let hl = hit.highlight;
      delete hit._source;
      delete hit.highlight;
      hit._explanation = arr;
      if (hl) hit.highlight = hl;
      if (src) hit._source = src;
   }

   
   function _onResponse(data, endpoint) {
      if (typeof(data) !== 'object') return data; 
      if (!data.hits) return data;
      let hits = data.hits.hits;
      if (!Array.isArray(hits)) return data;         
    
      for (let i=0; i<hits.length; i++) formatExplain(hits[i]);
      return data;
   };



   webcurl.plugins.registerResponsePlugin("es-pretty-explain", {
      order: 100,
      onResponse: _onResponse
   });
})();
