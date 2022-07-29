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
   const _CAPACITY = 100;
   let _current = null;
   let _oldest = null;
   let _newest = null;
   let $prevButton, $nextButton;
   let _onChange = webcurl.createEvent("history::onChange");

   class HistoryElt {
      static _count = 0;
      constructor(server, saveset, anchor) {
         this.server = server;
         this.saveset = saveset;
         this.anchor = anchor;
         this.pos = ++HistoryElt._count;
         if (!server) console.trace("NOSERVER", saveset, anchor);
      }

      toString() {
         let arr = [this.server];
         arr.push(", row=");
         arr.push(this.anchor.row);
         arr.push(", detached=");
         arr.push(this.detached ? "T" : "F");
         arr.push(", pos=");
         arr.push(this.pos);
         return arr.join('');
      }

      detach() {
         if (!this.detached) {
            console.log("DETACHING ", this);
            this.detached = true;
            this.anchor.detach();
         }
      }

      reAttach() {
         this.anchor = webcurl.editor.createAnchor(this.anchor.row);
         this.detached = false;
         console.log('REATTACHed anchor', this);
      }
   };

   function _clear() {
      _detachAll();
      _oldest = null;
      _newest = null;
      _updateState(null, false);
   }

   function _detachAll() {
      _detachAnchorChain(_oldest);
   }
   function _reAttach(saveset) {
      let elt = _newest;
      while (elt) {
         //console.log('elt saveset=', elt.saveset, saveset);
         if (elt.saveset === saveset.name) elt.reAttach();
         elt = elt.prev;
      }
   }

   //Detach anchors, starting at from, untl we reach <until>. <until> is not detached
   function _detachAnchorChain(from) {
      for (let elt = from; elt; elt = elt.next) elt.detach();
   }

   function _removeAboveCapacity() {
      let toSkip = _CAPACITY;
      let elt = _newest;
      for (; elt && toSkip > 0; elt = elt.prev) {
         --toSkip;
         _oldest = elt;
      }
      for (; elt; elt = elt.prev) elt.detach();
      if (_oldest) _oldest.prev = null;
   }

   function _push(anchor) {
      let server = webcurl.server.getServer();
      let saveset = webcurl.storage.getSaveSetName();

      if (_current && _current.server === server
         && _current.saveset === saveset
         && anchor.row === _current.anchor.row
         && anchor.document === _current.anchor.document) return;

      let newElt = new HistoryElt(server, saveset, anchor);
      if (!_current) {
         _updateState(_oldest = _newest = newElt, false);
         return;
      }

      _detachAnchorChain(_current.next);
      _current.next = newElt;
      newElt.prev = _current;
      _updateState(_newest = newElt);
      _removeAboveCapacity();
   }

   function _prev() {
      console.log("Prev called", _current);
      if (!_current || !_current.prev) return;
      _updateState(_current.prev, true);
   }
   function _next() {
      console.log("Next called", _current);
      if (!_current || !_current.next) return;
      _updateState(_current.next, true);
   }

   function _updateState(current, notify) {
      console.log("Update state to ", current);
      _current = current
      if (notify) _onChange.notify({ server: current.server, anchor: current.anchor, saveset: current.saveset });
      if (current && current.next) $nextButton.removeClass("disabled"); else $nextButton.addClass("disabled");
      if (current && current.prev) $prevButton.removeClass("disabled"); else $prevButton.addClass("disabled");
   }

   webcurl.registerBootstrap(function () {
      $prevButton = $("#backward_btn").addClass("disabled").on("click", _prev);
      $nextButton = $("#forward_btn").addClass("disabled").on("click", _next);
      webcurl.editor.onBeforeContentReplaced.subscribe(_detachAll);
      webcurl.editor.onAfterContentReplaced.subscribe(function (ev) {
         _reAttach(ev.data.saveset);
      });
   });

   webcurl.history = {
      onChange: _onChange,
      push: _push,
      clear: _clear
   }

})();