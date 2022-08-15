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
import java.nio.file.Files;
import java.nio.file.Path;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import nl.bitmanager.core.Invariant;
import nl.bitmanager.webcurl.CompressionHelper;
import nl.bitmanager.webcurl.JsonHelper;
import nl.bitmanager.webcurl.Main;
import nl.bitmanager.webcurl.Settings;
import nl.bitmanager.webcurl.storage.SaveSets.SaveSet;

public class Store {
    public static final Logger logger = Main.storeLogger;
    public final SaveSets saveSets;
    public final Names names;
    private final Object _lock;
    private final StoreWriter writer;

    
    public Store (Settings settings) throws IOException {
        _lock = new Object();
        Path storeRoot = settings.storageDir;
        Files.createDirectories(storeRoot);
        
        logger.info(Invariant.format("Store-dir=%s, LazyWriterInterval=%.2f min.", storeRoot, settings.storeWriterIntervalMs / 60000f));
        StoreHelper helper = new StoreHelper(storeRoot, logger);
        this.writer = new StoreWriter(this, settings.storeWriterIntervalMs);
        
        this.saveSets = new SaveSets (helper);
        this.names = new Names (helper, this.saveSets);
        
        logger.info("Loaded savesets:");
        for (SaveSet v: saveSets.saveSets.values()) {
            logger.info("-- " + v);
        }
    }
    
    public void saveSaveSet (String name, byte[] bytes) throws IOException {
        logger.info(String.format("SAVE SaveSet (%s, %s btes): %s", name, bytes==null ? -1: bytes.length, JsonHelper.toPretty(bytes)));
        writer.setNextTime();
        saveSets.save (name, bytes); 
    }

    public byte[] loadSaveSet (String name) throws IOException {
        SaveSet ss = saveSets.get(name);
        
        byte[] bytes = ss==null ? null : CompressionHelper.ensureDecompressed(ss.bytes);
        logger.info(String.format("LOAD SaveSet (%s): %d bytes", name, bytes==null ? -1: bytes.length));
        return bytes;
    }
    
    public void saveNames (byte[] bytes) throws IOException {
        writer.setNextTime();
        logger.info(String.format("SAVE Names (%s btes): %s", bytes==null ? -1: bytes.length, JsonHelper.toPretty(bytes)));
        this.names.save (bytes);
    }
    
    public byte[] loadInitialState() throws IOException {
        ObjectNode ret = JsonHelper.createObjectNode();
        ArrayNode jsonNames = names.asJson();
        ret.set("names", jsonNames);
        String topName = jsonNames.get(0).asText();
        
        SaveSet ss = saveSets.get(topName);
        if (ss != null) ret.set("saveset", ss.asJson());

        byte[] bytes = JsonHelper.jsonNodeToBytes(ret);
        logger.info(String.format("LOAD initial => %s bytes", bytes==null ? 0 : bytes.length));
        return bytes;
    }
    
    public void writeUnsaved() throws IOException {
        synchronized(_lock) {
            logger.info ("Write unsaved data");
            saveSets.writeUnsaved();
            names.writeUnsaved();
        }
    }
    
    
    static class StoreWriter implements Runnable {
        public static final Logger logger = LoggerFactory.getLogger("Store-writer");
        private final Store store;
        private final int lazyWriterInterval;
        private long nextTime; 
        public StoreWriter(Store store, int lazyWriterInterval) {
            this.store = store;
            this.lazyWriterInterval = lazyWriterInterval;
            new Thread(this).start();
            setNextTime();
        }
        
        private void setNextTime() {
            nextTime = System.currentTimeMillis() + lazyWriterInterval;
        }

        @Override
        public void run() {
            try {
                while (true) {
                    Thread.sleep(5000);
                    if (System.currentTimeMillis() < nextTime) continue;
                    
                    store.writeUnsaved();
                    setNextTime();
                }
            } catch (Exception e) {
                logger.error("Error in store-writer: " + e.getMessage());
            }
            
        }
    }



}
