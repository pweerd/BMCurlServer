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
import java.util.HashSet;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.TextNode;

import nl.bitmanager.webcurl.CompressionHelper;
import nl.bitmanager.webcurl.JsonHelper;

public class Names {
    public final StoreHelper store;
    public boolean dirty;
    public byte[] bytes;
    
    public Names (StoreHelper store, SaveSets sets) throws IOException {
        this.store = store;
        
        bytes = CompressionHelper.ensureDecompressed (store.loadFile("names.gz"));
        ArrayNode arr = asJson();
        
        HashSet<String> existing = new HashSet<String>(); 
        for (JsonNode x: arr) {
            existing.add(x.asText());
        }
        
        for (String k: sets.saveSets.keySet()) {
            if (existing.contains(k)) continue;
            arr.add(new TextNode(k));
            dirty = true;
        }
        
        bytes = JsonHelper.jsonNodeToCompressedBytes(arr);
        store.logger.info("Arr=" + arr.toString());
        store.logger.info("Bytes={}", (bytes==null ? -1 : bytes.length));
    }
    
    public ArrayNode asJson() throws IOException {
        ArrayNode arr =  bytes==null ? JsonHelper.createArrayNode() : (ArrayNode)JsonHelper.bytesToJsonNode(bytes);
        if (arr.size()==0)
            arr.add("default");
        return arr;
    }

    public void save(byte[] names) throws IOException {
        byte[] tmp = CompressionHelper.ensureCompressed(names);
        if (Arrays.equals(tmp, bytes)) 
            store.logger.info("Update namelist: ignored: equal");
        else {
            store.logger.info("Updating namelist: mark dirty");
            bytes = tmp; 
            dirty = true;
        }
    }
    
    @Override
    public String toString() {
        try {
            return JsonHelper.toPretty(asJson());
        } catch (IOException e) {
            return "ERROR: " + e.getMessage();
        }
    }


    public void writeUnsaved() throws IOException {
        if (dirty) {
            store.saveFile("names.gz", bytes);
            dirty = false;
        }
    }
    
    

}
