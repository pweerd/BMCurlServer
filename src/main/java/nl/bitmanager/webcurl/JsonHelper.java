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
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeType;
import com.fasterxml.jackson.databind.node.ObjectNode;

public class JsonHelper {
    private final static JsonFactory jsonFactory;
    public static final ObjectMapper mapper;

    static {
        jsonFactory = new JsonFactory();
        //jsonFactory.configure(JsonParser.Feature.ALLOW_UNQUOTED_FIELD_NAMES, true);
        //jsonFactory.configure(JsonParser.Feature.ALLOW_SINGLE_QUOTES, true);
        //jsonFactory.configure(JsonGenerator.Feature.QUOTE_FIELD_NAMES, true);
        //jsonFactory.configure(JsonParser.Feature.ALLOW_COMMENTS, true);
        //jsonFactory.configure(JsonFactory.Feature.FAIL_ON_SYMBOL_HASH_OVERFLOW, false); // this trips on many mappings now...
        mapper = new ObjectMapper();

    }
    
    public static JsonGenerator createGenerator() throws IOException {
        return jsonFactory.createGenerator(new ByteArrayOutputStream());
    }
    
    public static String toPretty(JsonNode node) {
        try {
            return mapper.writerWithDefaultPrettyPrinter().writeValueAsString(node);
        } catch (JsonProcessingException e) {
            throw new RuntimeException (e.getMessage(), e);
        }
    }
    public static String toPretty(byte[] data) {
        try {
            data = CompressionHelper.ensureDecompressed(data);
            return data==null ? "NULL" : mapper.writerWithDefaultPrettyPrinter().writeValueAsString(mapper.readTree(data));
        } catch (Exception e) {
            throw new RuntimeException (e.getMessage(), e);
        }
    }

    public static byte[] getBytes(JsonGenerator g) throws IOException {
        g.flush();
        return ((ByteArrayOutputStream)g.getOutputTarget()).toByteArray();
    }
    
    public static JsonNode bytesToJsonNode(byte[] bytes) throws IOException {
        if (bytes==null) return null;
        if (!CompressionHelper.isCompressed(bytes))  return mapper.readTree(bytes);
        
        ByteArrayInputStream inp = new ByteArrayInputStream(bytes);
        GZIPInputStream gz = new GZIPInputStream(inp);
        JsonNode ret = mapper.readTree(gz);
        gz.close();
        return ret;

    }
    public static byte[] jsonNodeToBytes(JsonNode jsonNode) throws IOException{
        return mapper.writeValueAsBytes(jsonNode);
    }
    public static byte[] jsonNodeToCompressedBytes(JsonNode jsonNode) throws IOException{
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        GZIPOutputStream gz = new GZIPOutputStream(out);
        mapper.writeValue(gz, jsonNode);
        gz.finish();
        gz.close();
        return out.toByteArray();
    }
    public static ObjectNode createObjectNode() {
        return mapper.createObjectNode();
    }
    public static ObjectNode createObjectNode(String name, JsonNode v) {
        ObjectNode ret = mapper.createObjectNode();
        ret.set(name, v);
        return ret;
    }
    public static ArrayNode createArrayNode() {
        return mapper.createArrayNode();
    }
    public static ArrayNode createArrayNode(JsonNode v) {
        ArrayNode ret = mapper.createArrayNode();
        ret.add(v);
        return ret;
    }
    
    public static ObjectNode asObjectNode(JsonNode n) {
    	if (n.getNodeType() != JsonNodeType.OBJECT) throw new RuntimeException("Expected json object, but got [" + n.getNodeType() + "].");
    	return (ObjectNode)n;
    }
    public static ObjectNode readObject(JsonNode n, String k, ObjectNode def) {
    	JsonNode x = asObjectNode(n).get(k);
    	return x==null ? def : asObjectNode(x);
    }
}
