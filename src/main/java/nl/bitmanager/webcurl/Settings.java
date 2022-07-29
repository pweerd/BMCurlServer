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

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.attribute.FileTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.concurrent.TimeUnit;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import nl.bitmanager.core.Invariant;
import nl.bitmanager.webcurl.resolvers.DnsResolvers;
import nl.bitmanager.webcurl.resolvers.IDnsResolver;
import nl.bitmanager.webcurl.resolvers.NopDnsResolver;
import nl.bitmanager.webcurl.templates.StoredTemplateCollections;
import nl.bitmanager.xml.XmlUtils;

public class Settings {
    private static Settings current;
    private static Path settingsPath;
    private static Path settingsRoot;
    
    public final FileTime lastModified;
    public final int serverPort;
    public final Timeout timeout;
    public final int storeWriterIntervalMs;
    public final Path storageDir;
    public final Path templatePath;
    public final Path settingsRoot() {return settingsRoot;}
    private final HeaderCollections headerCollections;
    private final HashMap<String, Endpoint> endpointMap;
    private final List<Endpoint> endpointList;
    private final Endpoint defaultEndpoint;
    private final IDnsResolver nameResolver;
    private final StoredTemplateCollections storedTemplateCollections;
    private static int changeId;

    public final boolean debug;

    public static Settings get() {
        try {
            if (changeId == Main.getChangeId()) return current;
            Main.logger.info(Main.logHeader);
            int chgid = Main.getChangeId();
            Main.logger.info("Re-loading settings. Change-id={}, new change-id={}", changeId, chgid);
            changeId = chgid;
            return current = new Settings(settingsPath);
        } catch (Throwable e) {
            throw new RuntimeException (e.getMessage(), e);
        }
    }
    public static Settings get(String fn) {
        changeId = Main.getChangeId();
        settingsPath = Paths.get(fn).toAbsolutePath();
        settingsRoot = settingsPath.getParent();
        return current = new Settings(settingsPath);
    }
    
    public Path resolve (String p) {
        return settingsRoot.resolve(p);
    }
    public Path resolve (Path p) {
        return settingsRoot.resolve(p);
    }

    private Settings(Path f)  {
        try {
            lastModified = Files.getLastModifiedTime(settingsPath);
            DocumentBuilder bldr = DocumentBuilderFactory.newInstance().newDocumentBuilder();
            Document doc = bldr.parse(Files.newInputStream(settingsPath));
            Element docElt = doc.getDocumentElement();
            debug = XmlUtils.readBool(docElt, "@debug", false);

            storeWriterIntervalMs = XmlUtils.readTimeSpan(docElt, "storage/@lazy_interval", 5*60, TimeUnit.SECONDS);
            storageDir = settingsRoot.resolve("storage");
            Files.createDirectories(storageDir);

            templatePath = settingsRoot.resolve("templates");
            Files.createDirectories(templatePath);

            Node serverNode = XmlUtils.selectMandatoryNode(docElt, "server");
            serverPort = XmlUtils.readInt(serverNode, "@port");

            //Read headers
            headerCollections = new HeaderCollections(XmlUtils.selectSingleNode(docElt, "header_collections"));
            
            storedTemplateCollections = new StoredTemplateCollections();
            storedTemplateCollections.loadFromDirectory(templatePath);
            storedTemplateCollections.dumpTemplates(Main.logger);
            
            //Read endpoints
            endpointMap = new HashMap<String, Endpoint>();
            endpointList = new ArrayList<Endpoint>();
            Timeout t = Timeout.DEFAULT;
            Node endpointsNode = XmlUtils.selectSingleNode(docElt, "endpoints");
            if (endpointsNode != null) {
                t = Timeout.create(Timeout.DEFAULT, endpointsNode);
                NodeList nodes = XmlUtils.selectMandatoryNodes(endpointsNode, "endpoint");
                if (nodes != null) {
                    int N = nodes.getLength();
                    for (int i = 0; i < N; i++) {
                        Endpoint x = new Endpoint(nodes.item(i), headerCollections, storedTemplateCollections, t);
                        endpointMap.put(x.name, x);
                        endpointList.add(x);
                    }
                }
            }
            timeout = t;
            defaultEndpoint = new Endpoint(storedTemplateCollections, timeout);
            Main.logger.info ("Default timeouts: {}", t);


            Node resolversNode = XmlUtils.selectSingleNode(docElt, "resolvers");
            nameResolver = resolversNode == null ? new NopDnsResolver() : new DnsResolvers(resolversNode);
            
            Main.logger.info ("Dumping " + endpointList.size() + " endpoints:");
            for (Endpoint ep: endpointList) Main.logger.info ("-- " + ep);
            Main.logger.info (Invariant.format("Store: interval=%.2f minutes, dir=%s", storeWriterIntervalMs/(60*1000.0), storageDir));
            
        } catch (Exception e) {
            throw new RuntimeException ("Load settings from [" + f.toString() + "] failed: " + e.getMessage(), e);
        }
    }

    public Endpoint getEndpoint(String name) {
        if (name == null)
            return defaultEndpoint;
        Endpoint ret = endpointMap.get(name);
        return ret == null ? defaultEndpoint : ret;
    }

    public Endpoint getEndpointFor(String url) {
        Endpoint ret = defaultEndpoint;
        for (Endpoint ept : endpointList) {
            if (ept.isForUrl(url)) {
                ret = ept;
                break;
            }
        }
        if (debug) Main.logger.info("Endpoint for url[{}]: {}", url, ret);
        return ret;
    }

    public String resolveName(String name) {
        if (name == null)
            return null;

        int ixStart = name.indexOf("://");
        if (ixStart < 0)
            ixStart = 0;
        else
            ixStart = ixStart + 3; // start of the name

        int ixEnd = name.length();
        int ix;
        ix = name.indexOf("?", ixStart);
        if (ix > 0 && ix < ixEnd) ixEnd = ix;
        ix = name.indexOf(":", ixStart);
        if (ix > 0 && ix < ixEnd) ixEnd = ix;
        ix = name.indexOf("/", ixStart);
        if (ix > 0 && ix < ixEnd) ixEnd = ix;

        String tmp = nameResolver.tryResolve(name.substring(ixStart, ixEnd));
        Main.logger.info("Translated host from [{}]->[{}]", name, tmp);
        if (tmp == null)
            return name;

        tmp = name.substring(0, ixStart) + tmp + name.substring(ixEnd);
        // Main.logger.info(Invariant.format("%s resolves to %s", name, tmp));
        return tmp;
    }

}
