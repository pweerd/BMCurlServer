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

   function _alignRight(what, width) {
      str = "" + what;
      pad = width - str.length;
      if (pad > 0) str = " ".repeat(pad) + str;
      return str;
   }

   function _addChild(parent, child) {
      if (parent.children === undefined)
         parent.children = [child];
      else
         parent.children.push(child);
   }
   function _flatten(newLines, lvl, parent, obj) {
      if (parent.children.length === 1) {
         if (obj.line.endsWith("Combined from:")) {
            for (let i = 0; i < obj.children.length; i++) _flatten(newLines, lvl, obj, obj.children[i]);
            return;
         }
      }
      if (obj.children && obj.children.length === 1) {
         if (obj.line.endsWith("max of:") || obj.line.endsWith("sum of:")) {
            for (let i = 0; i < obj.children.length; i++) _flatten(newLines, lvl, obj, obj.children[i]);
            return;
         }
      }
      let line = "-- ".repeat(lvl) + obj.line;
      newLines.push(line);
      if (obj.children) {
         ++lvl;
         for (let i = 0; i < obj.children.length; i++) _flatten(newLines, lvl, obj, obj.children[i]);
      }
   }
   function _replaceExplain(lines) {
      let stack = [{indent:-1}];
      let lvl = 0;
      let score = -1;
      for (let i = 0; i < lines.length; i++) {
         let line = lines[i];
         if (line.length === 0) continue;
         let indent = line.match(/^\s*/)[0].length;
         line = line.substr(indent);

         if (lvl === 0) {
            score = parseFloat(line.match(/^[^ ]*/)[0]);
         }

         for (; lvl >= 0 && indent < stack[lvl].indent; lvl--);

         if (indent > stack[lvl].indent) {
            stack[++lvl] = { indent: indent, line: line };
            _addChild(stack[lvl - 1], stack[lvl]);
            continue;
         }
         if (indent === stack[lvl].indent) {
            stack[lvl] = { indent: indent, line: line };
            _addChild(stack[lvl - 1], stack[lvl]);
            continue;
         }
      }
      if (!stack[1]) return;

      let newLines = [];
      console.log(stack[1]);
      _flatten(newLines, 0, stack[0], stack[1]);
      return { score: score, lines: newLines };
   }

   function _formatExplainAndSummarize(doc, explains, summaryArr) {
      let id = doc.id;
      if (!id) return doc;
      let explain = explains[id];
      if (!explain) return doc;

      let newExplain = _replaceExplain(explain.split('\n'));
      if (!newExplain) return doc;

      if (summaryArr.length < 100) {
         let tmp = [_alignRight(newExplain.score.toFixed(3), 4)];
         tmp.push(" - ");
         let str = JSON.stringify(doc);
         if (str.length > 100) str = str.substr(0, 100);
         tmp.push(str.replaceAll('"', "'"));

         summaryArr.push(tmp.join(''));
      }

      let newDoc = { __explain: newExplain.lines};
      for (p in doc) { newDoc[p] = doc[p]; }
      return newDoc;
   }

   function _onResponse (data, endpoint) {
      if (typeof (data) !== 'object') return data;
      let resp = data.response;
      let dbg = data.debug;
      if (!resp || !dbg) return data;
      let docs = resp.docs;
      if (!Array.isArray(docs)) return data;

      let explain = dbg.explain;
      if (!explain) return data;

      let summary = ["Returned results: ", docs.length];
      summary.push(resp.numFoundExact ? ", found exact: " : ", found about: ");
      summary.push(resp.numFound);
      summary.push(", from: ");
      summary.push(resp.start);
      summary = [summary.join('')];

      for (let i = 0; i < docs.length; i++) docs[i] = _formatExplainAndSummarize(docs[i], explain, summary);

      if (summary.length > 1) {
         let newData = { summary: summary };
         for (p in data) { newData[p] = data[p]; }
         data = newData;
      }
      delete dbg.explain;
      return data;
   };


   webcurl.plugins.registerResponsePlugin("solr-pretty-explain", {
      order: 200,
      onResponse: _onResponse
   });
})();
