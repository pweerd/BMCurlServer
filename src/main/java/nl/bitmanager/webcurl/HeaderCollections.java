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
package nl.bitmanager.webcurl;

import java.util.HashMap;

import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import nl.bitmanager.xml.XmlUtils;

public class HeaderCollections {
       private final HashMap<String, HeaderCollection> collections;
       private final HeaderCollection none;
       
       public HeaderCollections (Node node) {
           collections = new HashMap<String, HeaderCollection>();
           NodeList list = node == null ? null : XmlUtils.selectNodes(node, "header_collection");
           if (list != null) {
               for (int i=0; i<list.getLength(); i++) {
                   HeaderCollection headerColl = new HeaderCollection(list.item(i));
                   collections.put(headerColl.name, headerColl);
               }
           }
           
           none = new HeaderCollection("none");
       }
       
       public HeaderCollection getHeaders(String name) {
           HeaderCollection ret = name==null ? null : collections.get(name);
           return ret==null ? none : ret;
       }
       
   }