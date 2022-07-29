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
package nl.bitmanager.webcurl.templates;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Iterator;

import org.slf4j.Logger;

import com.fasterxml.jackson.databind.node.ObjectNode;

import nl.bitmanager.core.Invariant;
import nl.bitmanager.webcurl.JsonHelper;

public class StoredTemplateCollections {
    private final HashMap<String, StoredTemplateCollection> map;
    
    public StoredTemplateCollections() {
        map = new HashMap<String, StoredTemplateCollection>();
    }

    public void loadFromDirectory (Path dir) {
        try {
            Files.list(dir).filter(StoredTemplateCollections::fileFilter).forEach(p->addFromFile(p));
        } catch (IOException e) {
            throw new RuntimeException (e.getMessage(), e);
        }
    }
    
    public static boolean fileFilter(Path p) {
        if (!Files.isRegularFile(p)) return false;
        String fn = p.getFileName().toString();
        return fn.endsWith(".json");
    }
    
    public void addFromFile (Path fn) {
        StoredTemplateCollection coll = new StoredTemplateCollection(fn);
        StoredTemplateCollection existing = map.get(coll.name);
        if (existing != null) {
            throw new RuntimeException(Invariant.format("Cannot load multiple templates with the same name. Existing: [%s], other: [%s].", existing.fileName, coll.fileName));
        }
        map.put(coll.name, coll);
    }
    
    public ObjectNode getCombinedTemplates () {
        ObjectNode ret = JsonHelper.createObjectNode();
        for (StoredTemplateCollection coll: map.values()) {
            Iterator<String> iter = coll.templates.fieldNames();
            while (iter.hasNext()) {
                String key = iter.next();
                if (ret.get(key) == null) ret.set(key,  coll.templates.get(key));
            }
        }
        return ret;
    }
    public ObjectNode getCombinedTemplates (String names) {
        if ("*".equals(names)) return getCombinedTemplates();
        
        ObjectNode ret = JsonHelper.createObjectNode();
        if (names != null) {
            for (String name: names.toLowerCase().split("[|;, ]")) {
                StoredTemplateCollection coll = map.get(name);
                if (coll == null) throw new RuntimeException (Invariant.format("Template collection [%s] not found.", name));
                Iterator<String> iter = coll.templates.fieldNames();
                while (iter.hasNext()) {
                    String key = iter.next();
                    if (ret.get(key) == null) ret.set(key,  coll.templates.get(key));
                }
            }
        }
        return ret;
    }
    
    public void dumpTemplates (Logger logger) {
        logger.info("Dumping {} template collections", map.size());
        for (StoredTemplateCollection coll: map.values()) {
            logger.info("-- coll {}: {} templates", coll.name, coll.templates.size());
            Iterator<String> iter = coll.templates.fieldNames();
            while (iter.hasNext()) {
               logger.info("-- -- {}", iter.next());
            }
        }
    }
}
