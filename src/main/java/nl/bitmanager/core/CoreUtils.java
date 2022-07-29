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
package nl.bitmanager.core;

import java.io.PrintWriter;
import java.io.StringWriter;

public class CoreUtils {
    /**
     * Get the current stacktrace as a String
     */
    public static String getStackTrace() {
        return getStackTrace(2, true);
    }
    
    /**
     * Get the current stacktrace as a String
     * @param from The amount of frames to skip
     * @param prependDashes Determines whether to start new lines with '-- ' or not
     */
    public static String getStackTrace(int from, boolean prependDashes ) {
        StringBuilder bld = new StringBuilder();
        StackTraceElement[]  trace = Thread.currentThread().getStackTrace();
        for (int i=from; i<trace.length; i++) {
            if (prependDashes) bld.append("-- ");
            bld.append(trace[i]);
            bld.append("\r\n");
        }
        return bld.toString();
    }

    public static String getStackTrace(final Throwable throwable) {
        final StringWriter sw = new StringWriter();
        final PrintWriter pw = new PrintWriter(sw, true);
        throwable.printStackTrace(pw);
        return sw.getBuffer().toString();
   }
    
    /**
     * Prints the current stacktrace to stdout
     */
    public static void printStackTrace () {
        System.out.println(getStackTrace(2, true));
    }

    /**
     * Prints the current stacktrace to stdout
     * @param reason The reason why the trace was printed.
     */
    public static void printStackTrace (String reason) {
        System.out.println("Dump stack: " + reason);
        System.out.println(getStackTrace(2, true));
    }

    /**
     * Returns the 'pointer' to an object in hex format.
     * To be used as an ID for an individual object
     */
    public static String getPointer (Object x) {
        int ptr = (x==null) ? 0 : System.identityHashCode(x);
        return Invariant.format("%08X",  ptr);
    }
    
    public static boolean equals (String x, String y) {
        if (x==y) return true;
        if (x==null) return false;
        return x.equals(y);
    }
    public static boolean equalsIgnoreCase (String x, String y) {
        if (x==y) return true;
        if (x==null) return false;
        return x.equalsIgnoreCase(y);
    }

    public static <T extends AutoCloseable> T close (T x) {
        return close(x, false);
    }
    public static <T extends AutoCloseable> T close (T x, boolean mustExcept) {
        if (x != null) {
            try {
                x.close();
            } catch (Exception e) {
                if (mustExcept) throw wrapRTE(e);
                System.err.printf("Error while closing [%s]: %s.\n", x.getClass().getName(), e.getMessage());
                e.printStackTrace();
            }
        }
        return null;
    }
    
    public static <T> T close (T obj) {
        return close(obj, false);
    }
    public static <T> T close (T obj, boolean mustExcept) {
        if (obj != null && (obj instanceof AutoCloseable)) close ((AutoCloseable)obj, mustExcept);
        return null;
    }
    
    public static RuntimeException wrapRTE (Exception e) {
        return new RuntimeException (e.getMessage(), e);
    }
    
}
