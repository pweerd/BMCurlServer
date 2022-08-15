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
package nl.bitmanager.webcurl.storage;

import java.io.IOException;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;

import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import nl.bitmanager.core.Invariant;
import nl.bitmanager.webcurl.CompressionHelper;
import nl.bitmanager.webcurl.JsonHelper;

public class SaveSets {
    public final StoreHelper store;
    public final HashMap<String, SaveSet> saveSets; 

    public SaveSets(StoreHelper store) throws IOException {
        this.store = store;
        this.saveSets = new HashMap<String, SaveSet>();
        
        List<String> fileNames = store.getFileNames("ss_*.gz");
        for (String fn: fileNames) {
            byte[] bytes = store.loadFile(fn);
            String name = fn.substring(3, fn.length()-3);
            SaveSet ss = new SaveSet(name, bytes);
            saveSets.put (name, ss);
            Store.logger.info("Adding " + ss);
         }
    }
    
    public SaveSet get(String name) throws IOException {
        SaveSet ret = saveSets.get(name);
        if (ret==null) {
            byte[] bytes = store.loadFile("ss_" + name + ".gz");
            if (bytes==null) return null;
            ret = new SaveSet(name, bytes, false); 
            saveSets.put(name, ret);
        }
        return ret;
    }
    
    
    
    public void save (String name, byte[] bytes) throws IOException {
        bytes = CompressionHelper.ensureCompressed(bytes);
        SaveSet x = saveSets.get(name);
        String msg;
        if (x == null) {
            saveSets.put(name, new SaveSet (name, bytes, true));
            msg = "created new";
        } else {
            if (Arrays.equals(x.bytes, bytes)) 
                msg = "ignored (equal)";
            else {
                msg = "mark dirty";
                x.bytes = bytes;
                x.dirty = true;
            }
        }
        store.logger.info(Invariant.format("Update saveset [%s]: %s", name, msg));
    }

    
    public void writeUnsaved() throws IOException {
        for (SaveSet xx: saveSets.values()) {
            store.logger.info(Invariant.format("Check [%s] for unsaved date. dirty=%s", xx.name, xx.dirty));
            if (!xx.dirty) continue;
            store.saveFile("ss_" + xx.name + ".gz", xx.bytes);
            xx.dirty = false;
        }
    }

    
    public static class SaveSet {
        public final String name;
        public byte[] bytes;
        public boolean dirty;
        
        public SaveSet (String name, byte[] bytes) {
            this(name, bytes, false);
        }
        public SaveSet (String name, byte[] bytes, boolean dirty) {
            this.name = name;
            this.bytes = bytes;
            this.dirty = dirty;
        }
        
        public ObjectNode asJson() throws IOException {
            return (ObjectNode)JsonHelper.bytesToJsonNode(bytes);
        }
        
        @Override
        public String toString() {
            try {
                ObjectNode node = asJson();
                String x = node.get("editorContent").asText();
                ArrayNode servers = (ArrayNode)node.get("servers");
                String server = servers==null || servers.size()==0 ? "": servers.get(0).asText();
                return Invariant.format("Saveset [%s, content: %d bytes, recent server: %s]", name, x.length(), server); 
            } catch (IOException e) {
                return "ERROR: " + e.getMessage();
            }
        }

    }

}
