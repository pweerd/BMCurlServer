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

public class CompressionHelper {
    public static boolean isCompressed(byte[] bytes) {
        return (bytes != null && bytes.length>1 && bytes[0] == (byte)0x1F && bytes[1] == (byte)0x8B);
    }
    
    public static byte[] ensureCompressed (byte[] bytes) throws IOException {
        if (bytes==null || bytes.length==0) return bytes;
        if (bytes.length>1 && bytes[0] == (byte)0x1F && bytes[1] == (byte)0x8B) return bytes;
        
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        GZIPOutputStream gz = new GZIPOutputStream(out);
        gz.write(bytes);
        gz.finish();
        gz.close();
        return out.toByteArray();
    }
    
    public static byte[] ensureDecompressed (byte[] bytes) throws IOException {
        if (bytes==null || bytes.length==0) return bytes;
        if (bytes.length>1 && bytes[0] == (byte)0x1F && bytes[1] == (byte)0x8B) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ByteArrayInputStream inp = new ByteArrayInputStream(bytes);
            GZIPInputStream gz = new GZIPInputStream(inp);
            byte[] buf = new byte[4096];
            while (true) {
                int read = gz.read(buf);
                if (read<0) break;
                out.write(buf, 0, read);
            }
            gz.close();
            return out.toByteArray();
        }
        return bytes;
    }
}
