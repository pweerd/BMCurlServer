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

import java.util.ArrayList;
import java.util.List;

import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import nl.bitmanager.xml.XmlUtils;

public class HeaderCollection {
    public static final HeaderCollection NONE = new HeaderCollection("none"); 
    public final String name;
    public final List<HeaderPair> headers;

    public HeaderCollection(String name) {
        this.name = name;
        headers = new ArrayList<HeaderPair>();
    }

    public HeaderCollection(Node node) {
        name = XmlUtils.readStr(node, "@name");
        headers = new ArrayList<HeaderPair>();
        NodeList list = XmlUtils.selectNodes(node, "header");
        if (list != null) {
            for (int i = 0; i < list.getLength(); i++) {
                Node hdr = list.item(i);
                String k = XmlUtils.readStr(hdr, "@key");
                String v = XmlUtils.readStr(hdr, "@value");
                headers.add(new HeaderPair(k, v));
            }
        }
    }
}