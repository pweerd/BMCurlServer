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
package nl.bitmanager.webcurl.resolvers;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import nl.bitmanager.webcurl.Main;
import nl.bitmanager.xml.XmlUtils;

public class DnsSuffixResolver implements IDnsResolver {
    public static final Logger logger = Main.dnsLogger;
    private final Pattern expr;
    private final String[] suffixes;
    
    public DnsSuffixResolver (Node node) {
        expr = Pattern.compile(XmlUtils.readStr(node, "@expr"), Pattern.UNICODE_CHARACTER_CLASS);
        NodeList list = XmlUtils.selectMandatoryNodes(node, "replace");
        suffixes = new String[list.getLength()];
        for (int i=0; i<suffixes.length; i++) {
            suffixes[i] = XmlUtils.readStr(list.item(i), "@suffix");
        }
        for (int i=0; i<suffixes.length; i++) {
            if (suffixes[i].startsWith(".")) continue;
            suffixes[i] = "." + suffixes[i];
        }
    }
    
    @Override
    public String tryResolve (String name)  {
        if (name==null) return null;
        if (!expr.matcher(name).find()) return null;
        
        for (int i=0; i<suffixes.length; i++) {
            try {
                String tmp = name + suffixes[i];
                logger.info("Trying to resolve " + tmp);
                InetAddress address = InetAddress.getByName(name + suffixes[i]);
                if (address != null) {
                    logger.info("-- Resolved!");
                    return tmp;
                }
            } catch (UnknownHostException e) {
            }
        }
        return null;
    }

}
