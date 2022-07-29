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

import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.w3c.dom.Node;

import nl.bitmanager.webcurl.Main;
import nl.bitmanager.xml.XmlUtils;

public class DnsValueResolver implements IDnsResolver {
    public static final Logger logger = Main.dnsLogger;
    private final Pattern expr;
    private final String replVal;
    
    public DnsValueResolver (Node node) {
        expr = Pattern.compile(XmlUtils.readStr(node, "@expr"), Pattern.UNICODE_CHARACTER_CLASS);
        replVal = XmlUtils.readStr(node, "replace/@value");
    }
    
    
    public static boolean canParseFromNode (Node x) {
        return XmlUtils.selectSingleNode(x, "replace/@value") != null;
    }

    
    @Override
    public String tryResolve (String name)  {
        if (name==null) return null;
        if (!expr.matcher(name).find()) return null;
        return replVal;
    }

}
