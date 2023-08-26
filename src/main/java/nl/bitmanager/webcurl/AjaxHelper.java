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

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeType;
import com.fasterxml.jackson.databind.node.ObjectNode;

import fi.iki.elonen.NanoHTTPD;
import fi.iki.elonen.NanoHTTPD.Method;
import fi.iki.elonen.NanoHTTPD.Response.IStatus;
import nl.bitmanager.core.Invariant;
import okhttp3.Headers;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class AjaxHelper {
    static final Logger logger = Main.ajaxLogger;
    static final MediaType jsonMediaType = MediaType.parse("application/json");
    static final Pattern timeoutPattern=Pattern.compile("[\\?&]c_timeout=(\\d+)([&]?)");

    static AjaxResult execute (Settings settings, Method method, String url, byte[] bytes) throws IOException {
        //Interpret timeout / _timeout in the url. Remove _timeout=
        int timeout = Integer.MIN_VALUE;
        int removeStart = 0;
        int removeEnd = 0;
        Matcher m = timeoutPattern.matcher(url);
        int ix = 0;
        while (true) {
            if (ix >= url.length()) break;
            if (!m.find(ix)) break;
            int start = m.start()+1; //skip the ? or &
            int end = m.end();
            ix = end+1;
            //System.out.printf("MATCH at %s\n", start);
            
            int tmp = Invariant.toInt32(url.substring(m.start(1), m.end(1)));
            removeStart = start;
            removeEnd = end;
            timeout = tmp;
            break;
        }
        if (removeEnd > 0) url = url.substring(0, removeStart) + url.substring(removeEnd);
        
        if (settings.debug && timeout != Integer.MIN_VALUE) logger.debug("GOT c_timeout={}, url={}", timeout, url);
        
        Endpoint ep = settings.getEndpointFor(url);
        Request.Builder bldr = ep.createRequestBuilder(url);
        RequestBody body = createRequestBody(bytes);
        int bodyLen = body==null? 0: (int)body.contentLength();
        switch (method) {
            case GET: break;
            case DELETE:
                logger.info("Delete {} bytes", bodyLen); 
                bldr.delete(body);
                break;
            case POST: 
                logger.info("Post {} bytes", bodyLen); 
                bldr.addHeader("Content-Length", Integer.toString(bodyLen));
                bldr.post(body); 
                break;
            case PUT: 
                logger.info("Put {} bytes", bodyLen); 
                bldr.addHeader("Content-Length", Integer.toString(bodyLen));
                bldr.put(body); 
                break;
            default: throw new RuntimeException ("Unexpected method: " + method);
        }

        Timeout to = ep.timeout;
        OkHttpClient client = ep.getClient(to);
        logger.info("Endpoint: {}", ep);
        //logger.info(Invariant.format("Verifier=: %s, sslSocketFactory=%s", client.hostnameVerifier(), client.sslSocketFactory()));
        
        if (timeout != Integer.MIN_VALUE) to = Timeout.create(to, timeout);
        Request request = bldr.build();
        if (settings.debug) {
            Headers hdrs = request.headers();
            int N = hdrs.size();
            logger.info("Sending {} headers:", N);
            for (int i=0; i<N; i++) 
                logger.info("-- {}={}", hdrs.name(i), hdrs.value(i));
        }
        try (Response response = client.newCall(request).execute()) {
            return new AjaxResult(ep, response);
        }
    }

    /**
     * Transform the array of bytes into a RequestBody 
     * Eventual convert a _file_body hash into an array of bytes by reading the supplied filename
     */
    private static RequestBody createRequestBody (byte[] body) throws IOException {
    	if (body==null) return null;
    	
    	JsonNode bodyNode = JsonHelper.bytesToJsonNode(body);
    	ObjectNode fileNode = JsonHelper.readObject(bodyNode, "_file_body", null);
    	if (fileNode != null) {
    		JsonNode fn = fileNode.get("file");
    		if (fn != null) {
    			Path p = Paths.get(fn.asText());
    			
        		byte[] fileBytes = Files.readAllBytes(p);
        		JsonNode type = fileNode.get("type");
        		String mimeType = type != null ? type.asText() : NanoHTTPD.getMimeTypeForFile(p.getFileName().toString());
        		return RequestBody.create(MediaType.parse(mimeType), fileBytes);
    		}
    	}
    	return RequestBody.create(jsonMediaType, body);
    }
    
    
    public static class AjaxResult {
        public final Endpoint ep;
        public final byte[] result;
        public final IStatus status;

        public AjaxResult(Endpoint ep, Response response) throws IOException {
            this.ep = ep;
            String msg = response.message();

            if (msg!=null && msg.length()>0) 
                status = new Status(response.code(), msg);
            else
            {
                IStatus tmp = fi.iki.elonen.NanoHTTPD.Response.Status.lookup(response.code());
                status = tmp!=null ? tmp : new Status(response.code(), msg);
            }
            this.result = response.body().bytes();
        }
        
        public static class Status implements IStatus {
            public final String message;
            public final int code;
            
            public Status (int code, String message) {
                this.code = code;
                this.message = message;
            }

            @Override
            public String getDescription() {
                return message;
            }

            @Override
            public int getRequestStatus() {
                return code;
            }
            
        }
    }}
