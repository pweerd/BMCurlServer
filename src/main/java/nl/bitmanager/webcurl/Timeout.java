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

import org.w3c.dom.Node;

import nl.bitmanager.core.Invariant;
import nl.bitmanager.xml.XmlUtils;

/**
 * Holds the call/connect timeout for a http-connection
 */
public class Timeout {
        public final int connectTimeout;
        public final int callTimeout;
        private final int hc;
        public static final Timeout DEFAULT = new Timeout (5000, 120000); //1 sec , 2 minutes
        
        public Timeout (int connectTimeout, int callTimeout) {
            this.connectTimeout = connectTimeout;
            this.callTimeout = callTimeout;
            hc = getClass().hashCode() ^ (67 * connectTimeout) ^ (23 * callTimeout);
        }
        
        public static Timeout create (Timeout def, int callTimeout) {
            return (def.callTimeout == callTimeout) ? def : new Timeout (def.connectTimeout, callTimeout);
        }
        public static Timeout create (Timeout def, int connectTimeout, int callTimeout) {
            return (def.callTimeout == callTimeout && def.connectTimeout == connectTimeout) ? def : new Timeout (connectTimeout, callTimeout);
        }
        public static Timeout create (Timeout def, Node node) {
            int callTimeout = XmlUtils.readTimeSpan (node, "@timeout", def.callTimeout);
            int connectTimeout = XmlUtils.readTimeSpan (node, "@connect_timeout", def.connectTimeout);
            return (def.callTimeout == callTimeout && def.connectTimeout == connectTimeout) ? def : new Timeout (connectTimeout, callTimeout);
        }
        
        @Override
        public int hashCode() {
            return hc;
        }
        
        @Override
        public boolean equals(Object oth) {
            if (oth==this) return true;
            if (oth==null || oth.getClass() != getClass()) return false;
            Timeout other = (Timeout)oth;
            return other.connectTimeout == connectTimeout && other.callTimeout == callTimeout;
        }
        
        private static StringBuilder appendTime (StringBuilder sb, int ms) {
            if (ms < 2000) sb.append(ms).append("ms");
            else {
                double secs = ms / 1000.0;
                if (secs<120) Invariant.format(sb, "%.2fs", secs);
                else          Invariant.format(sb, "%.2fm", secs / 60);
            }
            return sb;
        }
        public String toString() {
            StringBuilder sb = new StringBuilder();
            appendTime (sb.append("[call="), callTimeout);
            appendTime (sb.append(", conn="), connectTimeout).append(']');
            return sb.toString();
        }
        
        
    }
