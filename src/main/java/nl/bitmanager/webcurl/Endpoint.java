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

import java.net.InetSocketAddress;
import java.net.Proxy;
import java.util.List;
import java.util.regex.Pattern;

import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import com.fasterxml.jackson.databind.node.ObjectNode;

import nl.bitmanager.core.Invariant;
import nl.bitmanager.webcurl.templates.StoredTemplateCollections;
import nl.bitmanager.xml.XmlUtils;
import nl.bitmanager.xml.XmlUtils.TrimFlags;
import okhttp3.OkHttpClient;
import okhttp3.Request;

public class Endpoint {
    private final String _toString;
    public final String name;
    public final String responsePluginsExpr;
    private final TimedHttpClients clients;
    public final Timeout timeout;
    private final List<HeaderPair> extraHeaders;
    
    private final Pattern[] selectors;
    public final ObjectNode templates;
    public final String autocompleteProcessor;
    public final boolean ignoreCertsErrors;

    public Endpoint(StoredTemplateCollections storedTemplateCollections, Timeout timeout) {
        name = "default";
        responsePluginsExpr = null;
        this.timeout = timeout;
        clients = new TimedHttpClients(null, false, timeout);
        selectors = null;
        extraHeaders = HeaderCollection.NONE.headers;
        ignoreCertsErrors = false;
        autocompleteProcessor = null;
        templates = storedTemplateCollections.getCombinedTemplates();
        _toString = Invariant.format("%s: [name=%s, autocomplete=, ignoreCertErr=false, templates=*]", 
                getClass().getSimpleName(), name
        );
    }
    
    @Override
    public String toString() {
        return _toString;
    }

    public Endpoint(Node node, HeaderCollections headerCollections, StoredTemplateCollections storedTemplateCollections, Timeout def) {
        this.timeout = Timeout.create(def, node);
        name = XmlUtils.readStr(node, "@name");
        ignoreCertsErrors = XmlUtils.readBool(node, "@ignore_certificate_errors", false);
        extraHeaders = headerCollections.getHeaders(XmlUtils.readStr(node, "@headers", (String)null)).headers;
        def = Timeout.create(def, node);
        
        String templateNames = XmlUtils.readStr(node, "@templates", "*", TrimFlags.Trim);
        templates = storedTemplateCollections.getCombinedTemplates(templateNames);
        autocompleteProcessor = XmlUtils.readStr(node, "@autocomplete", (String)null);

        responsePluginsExpr = XmlUtils.readStr(node, "@response_plugins", "*", TrimFlags.Trim);

        Node proxyNode = XmlUtils.selectSingleNode(node, "proxy");
        Proxy.Type type = Proxy.Type.DIRECT;
        if (proxyNode == null)
            clients = new TimedHttpClients(null, ignoreCertsErrors, this.timeout);
        else {
            type = XmlUtils.readEnum(proxyNode, Proxy.Type.class, "@type", Proxy.Type.HTTP);
            String addr = XmlUtils.readStr(proxyNode, "@addr");
            int port = XmlUtils.readInt(proxyNode, "@port");
            clients = new TimedHttpClients(new Proxy(type, new InetSocketAddress(addr, port)), ignoreCertsErrors, this.timeout);
        }

        NodeList list = XmlUtils.selectMandatoryNodes(node, "selectors/select");
        int N = list.getLength();
        selectors = new Pattern[N];
        for (int i = 0; i < N; i++) {
            String expr = XmlUtils.readStr(list.item(i), "@expr");
            selectors[i] = Pattern.compile(expr, Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CHARACTER_CLASS);
        }
        _toString = Invariant.format("%s: [name=%s, timeout=%s, autocomplete=%s, ignoreCertErr=%s, proxy=%s, templates=%s]", 
                getClass().getSimpleName(), name, timeout, autocompleteProcessor, ignoreCertsErrors, 
                type == Proxy.Type.DIRECT ? "None" : type,
                templateNames        
        );
    }
    
    public OkHttpClient getClient() {
        return clients.getClient();
    }
    public OkHttpClient getClient(Timeout timeout) {
        return clients.getClient(timeout);
    }


    public boolean isForUrl(String url) {
        if (selectors == null)
            return true;
        for (int i = 0; i < selectors.length; i++) {
            if (selectors[i].matcher(url).find())
                return true;
        }
        return false;
    }
    
    public Request.Builder createRequestBuilder (String url) {
        Request.Builder bldr = new Request.Builder().url(url);

        boolean acceptPresent = false;
        for (HeaderPair h: extraHeaders) {
            bldr.addHeader(h.key,  h.value);
            if ("Accept".equals(h.key)) acceptPresent = true;
        }
        if (!acceptPresent) bldr.addHeader("Accept", "application/json");
        return bldr;
    }


}