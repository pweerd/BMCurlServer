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

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

import com.fasterxml.jackson.databind.node.ObjectNode;

import nl.bitmanager.core.CoreUtils;
import nl.bitmanager.core.Invariant;
import nl.bitmanager.webcurl.JsonHelper;

public class StoredTemplateCollection {
    public final String fileName;
    public final String name;
    public final ObjectNode templates;

    public StoredTemplateCollection(Path file) {
        fileName = file.getFileName().toString();
        int idx = fileName.lastIndexOf('.');
        name = idx > 0 ? fileName.substring(0, idx) : fileName;
        InputStream inp=null;
        try {
            inp =Files.newInputStream(file);
            templates = (ObjectNode)JsonHelper.mapper.readTree(inp);
        } catch (Exception e) {
            throw new RuntimeException (Invariant.format("Load template-file [%s] failed: %s.", fileName, e.getMessage()), e);
        } finally {
            CoreUtils.close(inp, false);
        }
    }
}
