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

import java.util.HashMap;

import org.slf4j.Logger;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import nl.bitmanager.core.Invariant;
import nl.bitmanager.webcurl.Main;
import nl.bitmanager.xml.XmlUtils;

public class DnsResolvers implements IDnsResolver {
    public static final Logger logger = Main.dnsLogger;
    private IDnsResolver[] resolvers;
    private final HashMap<String,String> cache;
    
    public DnsResolvers (Node node) {
        NodeList list = XmlUtils.selectMandatoryNodes(node, "resolve");
        resolvers = new IDnsResolver[list.getLength()];
        for (int i=0; i<resolvers.length; i++) {
            Node sub = list.item(i);
            if (DnsValueExprResolver.canParseFromNode(sub)) 
                resolvers[i] = new DnsValueExprResolver(sub);
            else if (DnsValueResolver.canParseFromNode(sub)) 
                resolvers[i] = new DnsValueResolver(sub);
            else 
                resolvers[i] = new DnsSuffixResolver(sub);
        }
        cache = new  HashMap<String,String>();
    }
    
    @Override
    public String tryResolve (String name)  {
        if (name==null) return null;
        
        //Convert the name to lowercase and check the cache
        String lcName = Invariant.toLower(name);
        String repl;
        synchronized (cache) {
            repl = cache.get(lcName);
        }
        if (repl != null) return repl;
        
        //Try to resolve the name, if unresolvable, just take the name
        for (int i=0; i<resolvers.length; i++) {
            repl = resolvers[i].tryResolve(lcName);
            if (repl != null) break;
        }
        if (repl==null) repl = lcName;
        logger.info(Invariant.format("DnsResolver: Host [%s] => [%s]", name, repl));

        //Update the cache
        synchronized (cache) {
            cache.putIfAbsent(lcName, repl);
        }
        return repl;
    }
}