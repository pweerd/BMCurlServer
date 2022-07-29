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

   function alignLeft(what, width) {
      str = "" + what;
      pad = width - str.length;
      if (pad > 0) str = str + " ".repeat(pad);
      return str;
   }
   function alignRight(what, width) {
      str = "" + what;
      pad = width - str.length;
      if (pad > 0) str = " ".repeat(pad) + str;
      return str;
   }

   function formatHit(hit) {
      let arr = [];
      arr.push((hit._score === null || hit._score === undefined) ? "null" : alignRight(hit._score.toFixed(3), 4));
      arr.push(' - ');
      arr.push(hit._id);

      if (hit._source) {
         arr.push(' - ');
         let str = JSON.stringify(hit._source);
         if (str.length > 100) str = str.substr(0, 100);
         arr.push(str.replaceAll('"', "'"));
      }
      return arr.join('');
   }

   function _onResponse (data) {
      if (typeof (data) !== 'object') return data;
      if (!data.hits) return data;
      let hits = data.hits.hits;
      if (!Array.isArray(hits)) return data;

      let summ = [];
      for (let i = 0; i < hits.length; i++) summ.push(formatHit(hits[i]));
      if (summ.length === 0) return data;

      newData = {};
      newData['summary'] = summ;
      for (p in data) {
         newData[p] = data[p];
      }
      return newData;
   }


   webcurl.plugins.registerResponsePlugin("es-summarizer", {
      order: 100,
      onResponse: _onResponse
   });
})();