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
package nl.bitmanager.io;

import java.io.IOException;
import java.nio.file.FileSystems;
import java.nio.file.Path;
import java.nio.file.WatchEvent;

import static java.nio.file.StandardWatchEventKinds.*;
import java.nio.file.WatchKey;
import java.nio.file.WatchService;
import java.util.HashMap;
import java.util.function.Predicate;

import org.slf4j.Logger;


public class FileWatcher {
    private final WatchService watcher;
    private final HashMap<WatchKey, RegisteredPath> map;
    private final Logger logger;
    private Runner runner;
    
    public int getChangeId() {
        return runner==null ? 0 : runner.changeId;
    }
    
    public FileWatcher(Logger logger) {
        this.logger = logger;
        try {
            watcher = FileSystems.getDefault().newWatchService();
        } catch (IOException e) {
            throw new RuntimeException (e.getMessage(), e);
        }
        map = new HashMap<WatchKey, RegisteredPath>();
    }
    public void register (Path p) throws IOException {
        register (p, null);
    }
    public void register (Path p, Predicate<Path> filter) throws IOException {
        if (runner != null) throw new RuntimeException ("Cannot register a path when the FileWatcher is already watching");
        WatchKey key = p.register(watcher, ENTRY_MODIFY, ENTRY_DELETE);
        RegisteredPath item = new RegisteredPath(key, filter);
        map.put(item.key,  item);
    }
    
    public void start() {
        runner = new Runner(this);
        Thread thread = new Thread(runner);
        thread.setDaemon(true);
        thread.start();
    }
    


    
    static class RegisteredPath {
        public final WatchKey key;
        public final Predicate<Path> filter;
        public RegisteredPath (WatchKey key, Predicate<Path> filter) {
            this.key = key;
            this.filter = filter;
        }
        
        public boolean isInFilter(Path p) {
            return filter==null || filter.test(p);
        }
    }
    
    static class Runner implements Runnable {
        private final WatchService watcher;
        private final HashMap<WatchKey, RegisteredPath> map;
        private final Logger logger;
        private volatile int changeId;

        public Runner (FileWatcher watcher) {
            this.watcher = watcher.watcher;
            this.map = watcher.map;
            this.logger = watcher.logger;
        }
        
        public void run() {
            boolean poll = true;
            if (logger != null) logger.info("Watcher started watching {} directories", map.size());
            while (poll) {
                WatchKey key;
                try {
                    key = watcher.take();
                } catch (InterruptedException e) {
                    if (logger != null) 
                        logger.error("Watcher take() failed", e);
                    break;
                }
                Path dir = (Path) key.watchable();
                RegisteredPath reg = map.get(key);
                boolean changed = false;
                for (WatchEvent<?> event : key.pollEvents()) {
                    Path p = dir.resolve((Path) event.context());
                    if (reg == null || reg.isInFilter(p)) {
                        if (logger != null) logger.info("-- Watcher event: path={}, kind={}", p, event.kind());
                        changed = true;
                    }
                }
                if (changed)
                    ++changeId;
                poll = key.reset();
            }
            if (logger != null) logger.info("Watcher stopped watching {} directories", map.size());
        }
    }
    
}
