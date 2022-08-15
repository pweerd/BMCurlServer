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
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;

import nl.bitmanager.core.Invariant;

public class StoreHelper {
    public final Logger logger;
    public final Path root;
    
    public StoreHelper(Path root, Logger logger) throws IOException {
        this.root = root;
        this.logger = logger;
        if (Files.notExists(root)) Files.createDirectory(root);
    }

    public byte[] loadFile (String fn) throws IOException {
        //logger.info("Loading " + fn);
        Path p = root.resolve(fn);
        try (InputStream inp = Files.newInputStream(p)) {
            byte[] bytes = inp.readAllBytes();
            //logger.info(Invariant.format("-- %d bytes", bytes==null ? 0: bytes.length));
            return bytes ==null || bytes.length==0 ? null: bytes; 
        } catch (java.nio.file.NoSuchFileException e) {
            logger.info("Loading [{}]: not found", fn);
            return null;
        }
    }
    
    public void saveFile (String fn, byte[] bytes) throws IOException {
        logger.info("Saving " + fn);
        try (OutputStream out = Files.newOutputStream(root.resolve(fn))) {
            out.write(bytes);
        }
    }
    
    public List<String> getFileNames (String mask) throws IOException {
        List<String> names = new ArrayList<String>();
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(root, mask)) {
            for (Path path : stream) {
                if (Files.isDirectory(path)) continue;
                names.add(path.getFileName().toString());
            }
        } catch (java.nio.file.NoSuchFileException e) {}
        
        return names;
    }
}
