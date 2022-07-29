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
import java.io.InputStream;
import java.io.PrintWriter;
import java.nio.ByteBuffer;
import java.nio.charset.Charset;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

import org.slf4j.Logger;

import com.fasterxml.jackson.databind.node.ObjectNode;

import fi.iki.elonen.NanoHTTPD;
import fi.iki.elonen.NanoHTTPD.Response.IStatus;
import fi.iki.elonen.NanoHTTPD.Response.Status;
import nl.bitmanager.core.CoreUtils;
import nl.bitmanager.core.Invariant;
import nl.bitmanager.webcurl.AjaxHelper.AjaxResult;
import nl.bitmanager.webcurl.storage.Store;

public class HttpServer extends NanoHTTPD  {
    public static final Logger logger = Main.httpLogger;
    public static final Charset utf8 = Charset.forName("utf8");
    public static final String mimeJs = "text/javascript";
    public static final byte[] EMPTY_JSON = new byte[] {(byte)'{', (byte)'}'};

    private final Path webRoot;
    private final Store store;

    public HttpServer(int port, Store historyStore, String webroot) throws IOException {
        super(port);
        logger.info("Starting with port=" + port);
        this.webRoot = Paths.get(webroot);
        this.store = historyStore;
        
        NanoHTTPD.mimeTypes(); //Init mimetypes: NanoHttpd initialisation is bogus
        start(NanoHTTPD.SOCKET_READ_TIMEOUT, false);
    }
    
    @Override
    public Response serve(IHTTPSession session) {
        try {
            return _serve(session);
        } catch (Exception e) {
            String msg = CoreUtils.getStackTrace(e);
            logger.error(msg);    
            Response ret = newTextResponse(Status.INTERNAL_ERROR, NanoHTTPD.MIME_PLAINTEXT, msg);
            ret.setGzipEncoding(false);
            return ret;
        }
    }
    
    private Response _serve(IHTTPSession session) throws Exception {
        Settings settings = Settings.get();
        String path = getPath(session);
        String q = session.getQueryParameterString();
        if (settings.debug)
            logger.debug(q==null ? "{}: {}" : "{}: {}?{}", session.getMethod(), path, session.getQueryParameterString());        

        if ("/service".equals(path)) return handleAjax(settings, session);
        
        if (path.startsWith("/storage/initial_state")) return handleInitialState(session); 
        if (path.startsWith("/storage/saveset/")) return handleSaveSet(session); 
        if ("/storage/names".equals(path)) return handleNames(session);

        switch (session.getMethod()) {
            default: return newResponse404();
            case GET:
                break;
        }
        
        switch (path) {
            case "/": 
                return loadFileResponse("index.html", NanoHTTPD.MIME_HTML);
            case "/stop": 
                stop();
                return newFixedLengthResponse("OK");
            case "/error": 
                throw new RuntimeException ("forced error");
            case "/plugins": 
                return loadPlugins();
            case "/endpoint_type": 
                return handleEndpointType(settings, session);
        }
        
        if (path.startsWith("/") || path.startsWith("/lib") || path.startsWith("/kb") || path.startsWith("/src") || path.startsWith("/webcurl") || path.startsWith("/icons")) {
            return loadFileResponse(path.substring(1), null);
        }
        
        return newResponse404();
    }
    

    private static String getPath (IHTTPSession session) {
        String p = session.getUri();
        return p.endsWith("/") && p.length() != 1 ? p.substring(0, p.length()-1) : p;
    }
    
    // Url=/storage/saveset/
    private Response handleSaveSet(IHTTPSession session) throws IOException {
        String path = getPath(session);
        String fn = path.substring(17); 

        switch (session.getMethod()) {
            case GET: 
                return newJsonResponse (store.loadSaveSet(fn));
                
            case POST: 
                store.saveSaveSet(fn, readBody(session));
                return newEmptyJsonResponse();
            default: return newResponse404();
        }
    }

    // Url=/storage/names
    private Response handleNames(IHTTPSession session) throws IOException {
        switch (session.getMethod()) {
            case POST: 
                store.saveNames(readBody(session));
                return newEmptyJsonResponse();
            default: return newResponse404();
        }
    }

    
    private Response newJsonResponse(byte[] bytes) throws IOException {
        if (bytes==null) return newResponse404();
        return newFixedLengthResponse(Status.OK, "application/json", new ByteArrayInputStream (bytes), bytes.length);
    }
    private Response newEmptyJsonResponse() throws IOException {
        return newJsonResponse(EMPTY_JSON);
    }
    
    private Response handleInitialState(IHTTPSession session) throws IOException {
        byte[] bytes = store.loadInitialState();
        return newFixedLengthResponse(Status.OK, "application/json", new ByteArrayInputStream (bytes), bytes.length);
    }

    private static byte[] readBody (IHTTPSession session) throws IOException {
        InputStream strm = session.getInputStream();
        int bodySize = (int)((HTTPSession)session).getBodySize();
        if (bodySize==0)
            return strm.readAllBytes();
        else
            return strm.readNBytes(bodySize);
    }

    private Response handleAjax(Settings settings, IHTTPSession session) throws IOException {
        //logger.info(Invariant.format("AJAX: url=%s", getParam(session, "url")));
        String url = settings.resolveName(getParam(session, "url"));
        //logger.info(Invariant.format("AJAX: resolved=%s", url));
        
        Method m = session.getMethod();
        byte[] bytes = null;
        if (m != Method.GET) 
            bytes = readBody(session);
        
        long t0 = System.currentTimeMillis();
        AjaxResult ajaxResult = AjaxHelper.execute(settings, session.getMethod(), url, bytes);
        bytes = ajaxResult.result;
        logger.debug(Invariant.format("-- ret code=%d, length=%d", ajaxResult.status.getRequestStatus(), bytes.length));
        Response resp = newFixedLengthResponse(ajaxResult.status, "application/json", new ByteArrayInputStream(bytes), bytes.length);
        resp.addHeader("X_endpoint", ajaxResult.ep.name);
        resp.addHeader("X_took", Long.toString(System.currentTimeMillis() - t0));
        return resp;
    }
    
    private Response handleEndpointType(Settings settings, IHTTPSession session) throws IOException {
        String url = settings.resolveName(getParam(session, "url")); 
        Endpoint ep = settings.getEndpointFor(url);
        ObjectNode root = JsonHelper.createObjectNode();
        if (ep!=null) {
            root.put("endpoint", ep.name);
            root.put("autocomplete", ep.autocompleteProcessor);
            root.set("templates", ep.templates);
            root.put("responsePluginsExpr", ep.responsePluginsExpr);
        }
        return newJsonResponse(JsonHelper.jsonNodeToBytes(root));
    }
    
    
    
    private static void throwMissing(String key) {
        throw new RuntimeException ("Missing url-parameter [" + key + "]");
    }

    private String getParam (IHTTPSession session, String key) {
        List<String> values = session.getParameters().get(key);
        if (values == null || values.size()==0) throwMissing(key);
        return values.get(0);
    }

    private static Response newOKBytesResponse (byte[] bytes, String mime) {
        return newFixedLengthResponse (Status.OK, mime, new ByteArrayInputStream(bytes), bytes.length);
    }
    
    private static String getMimeType(String fn) {
        int idx = fn.indexOf('?');
        return NanoHTTPD.getMimeTypeForFile(idx < 0 ? fn : fn.substring(0, idx));
    }
    private Response loadFileResponse (String fn, String mime) throws IOException {
        byte[] bytes = Files.readAllBytes(webRoot.resolve(fn));
        if (mime==null) mime = getMimeType(fn);
        logger.debug("==> {}, bytes={}, mime={}", bytes==null ? -1 :  fn, bytes.length, mime);
        return newOKBytesResponse(bytes, mime);
    }
    

    private Response loadPlugins () throws IOException {
        ByteArrayOutputStream buf = new  ByteArrayOutputStream();
        PrintWriter wtr = new PrintWriter(buf);
        
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(webRoot.resolve("plugins"), "*.js")) {
            for (Path path : stream) {
                if (Files.isDirectory(path)) continue;
                byte[] bytes = Files.readAllBytes(path);
                String fn = path.getFileName().toString();
                String fnOnly = fn.substring(0, fn.length()-3);
                
                wtr.printf ("//Loaded from %s\n", fn);
                wtr.printf("webcurl.plugins.setFilename (\"%s\");\n", fnOnly);
                wtr.print ("try {\n");
                wtr.flush();
                buf.write(bytes,  0,  bytes.length);
                wtr.printf ("} catch (e) {\n   console.error('Error during init of \"%s\": ' + e)};\n", fn);
                wtr.flush();
            }
            wtr.print ("\nwebcurl.plugins.initialize();\n");
            wtr.flush();
        }
        byte[] allBytes = buf.toByteArray();
        return newFixedLengthResponse (Status.OK, mimeJs, new ByteArrayInputStream(allBytes), allBytes.length);
    }
    
    private static Response newResponse404() {
        return newFixedLengthResponse(Status.NOT_FOUND, NanoHTTPD.MIME_HTML, null, 0);
    }
    
    private static Response newTextResponse (IStatus status, String mimeType, String txt) {
        if (mimeType==null) mimeType = NanoHTTPD.MIME_PLAINTEXT;
        if (txt==null) txt="";
        ByteBuffer bytes = utf8.encode(txt);
        return newFixedLengthResponse(status, mimeType, new ByteArrayInputStream(bytes.array(), 0, bytes.limit()), bytes.limit());
    }


}
