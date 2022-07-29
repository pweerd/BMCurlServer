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

import java.io.File;
import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import nl.bitmanager.core.Invariant;

public class IOUtils {
    private static final String startDir = _getStartDir();
    private static final String loadDir = getLoadDir(IOUtils.class);
    private static final char sep = File.separatorChar;
    
    private static char lastChar (String x) {
        char ch = 0;
        if (x!=null) {
            int len = x.length();
            if (len > 0) ch = x.charAt(len-1);
        }
        return ch;
    }
    public static String appendSlash (String x) {
        String ret=x;
        if (x!=null) {
            char ch = lastChar(x);
            if (ch!=sep && ch!='/' && ch!='\\') ret = x+sep; 
        }
        return ret;
    }
    public static String removeSlash (String x) {
        String ret=x;
        if (x!=null) {
            int N = x.length();
            int i = N;
            for (i=N; i>0; i--) {
                char ch = x.charAt(i-1);
                if (ch!=sep && ch!='/' && ch!='\\') break;
            }
            if (i < N) ret = x.substring(0, i);
        }
        return ret;
    }

    public static String combineStr (String root, String rel) {
        if (rel==null || rel.length()==0) return root;
        return Paths.get(root).resolve(rel).toAbsolutePath().toString();
    }
    public static String combineStr (Path root, String rel) {
        Path ret = (rel==null || rel.length()==0) ? root : root.resolve(rel).toAbsolutePath();
        return ret.toString();
    }
    
    public static Path combine (String root, String rel) {
        Path r = Paths.get(root);
        if (rel==null || rel.length()==0) return r;
        return r.resolve(rel).toAbsolutePath();
    }
    public static Path combine (Path root, String rel) {
        if (rel==null || rel.length()==0) return root;
        return root.resolve(rel).toAbsolutePath();
    }

    /** 
     * Returns the directory from where a class was loaded
     */
    public static String getLoadDir(Class<?> cls) {
        try {
            File root = new File(cls.getProtectionDomain().getCodeSource().getLocation().toURI());
            if (root.isFile()) root = root.getParentFile();
            return root.getPath();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    /** 
     * Returns the directory from where bmCore was loaded
     */
    public static String getLoadDir() {
        return loadDir;
    }
    
    /** 
     * Returns the working directory at the time the JVM was started
     */
    public static String getStartDir() {
        return startDir;
    }
    private static String _getStartDir() {
        String tmp = System.getProperty("user.dir");
        if (tmp==null || tmp.length()==0) tmp = ".";
        Path root = Paths.get (tmp).toAbsolutePath();
        return root.toString();
    }
    
    public static void saveToFile (String fn, String content, Charset encoding)  {
        try {
           Files.writeString(Paths.get(fn), content, encoding != null ? encoding : StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new RuntimeException (e);
        }
    }
    
    /**
     * Tries to locate fn in the current directory or higher. If not found,
     * throws an exception
     * 
     * @param fn
     *            the file to search for
     * @return the full qualified name of the found file
     */
    public static String locateFileToRoot(String fn) {
        return locateFileToRoot(loadDir, fn);
    }

    /**
     * Tries to locate fn in the current directory or higher.
     * 
     * @param fn
     *            the file to search for
     * @return the full qualified name of the found file or null
     */
    public static String optLocateFileToRoot(String fn) {
        return optLocateFileToRoot(loadDir, fn);
    }

    /**
     * Tries to locate fn in directory dir or higher. If not found, throws an
     * exception
     * 
     * @param fn
     *            the file to search for
     * @param dir
     *            the directory to search the file in
     * @return the full qualified name of the found file
     */
    public static String locateFileToRoot(String dir, String fn) {
        if (dir==null) dir = loadDir;
        String ret = optLocateFileToRoot(dir, fn);
        if (ret != null)
            return ret;

        File d;
        try {
            d = new File(dir).getCanonicalFile();
        } catch (IOException e) {
            throw new RuntimeException (e.getMessage(), e);
        }
        throw Invariant.exception("Cannot find '%s' in '%s' or higher.", fn, d.getPath());
    }

    /**
     * Tries to locate fn in directory dir or higher.
     * 
     * @param fn
     *            the file to search for
     * @param dir
     *            the directory to search the file in
     * @return the full qualified name of the found file or null
     */
    public static String optLocateFileToRoot(String dir, String fn) {
        if (dir==null) dir = loadDir;
        try {
            File d = new File(dir).getCanonicalFile();
            while (d != null) {
                File combined = new File(d, fn);
                if (combined.exists())
                    return combined.getPath();
                d = d.getParentFile();
            }
            return null;
        } catch (Exception e) {
            throw new RuntimeException (e.getMessage(), e);
        }
    }

    public static File forceDirectories (String fn, boolean isDir) {
        File f = new File (fn);
        if (!isDir) f = f.getParentFile();
        _forceDirectories (f);
        return f;
    }
    public static File forceDirectories (File f, boolean isDir) {
        if (!isDir) f = f.getParentFile();
        _forceDirectories (f);
        return f;
    }
    
    static void _forceDirectories(File dir)
    {
       if (dir==null || dir.exists()) return;

       _forceDirectories(dir.getParentFile());
       try
       {
           dir.mkdir();
       }
       catch (Exception err)
       {
          throw new RuntimeException ("Cannot create [" + dir + "]: " + err.getMessage(), err);
       }
    }

}
