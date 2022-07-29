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

import java.text.NumberFormat;
import java.util.Formatter;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

/** 
 * Make stuff independant of the locale
 */
public class Invariant {
    public final static Locale rootLocale = Locale.ROOT;
    public final static NumberFormat numFormat = NumberFormat.getInstance(Locale.ROOT);
    
    @SuppressWarnings("resource")
    public static String format(String format, Object... args) {
        return new Formatter(new StringBuilder(256), rootLocale).format(rootLocale, format, args).toString();
    }

    @SuppressWarnings("resource")
    public static Appendable format(Appendable sb, String format, Object... args) {
        new Formatter(sb, rootLocale).format(rootLocale, format, args);
        return sb;
    }
    @SuppressWarnings("resource")
    public static StringBuilder format(StringBuilder sb, String format, Object... args) {
        new Formatter(sb, rootLocale).format(rootLocale, format, args);
        return sb;
    }
    
    
    public static String toLower(String txt) {
        return txt==null ? null : txt.toLowerCase(rootLocale); 
    }
    public static String toUpper(String txt) {
        return txt==null ? null : txt.toUpperCase(rootLocale); 
    }

    
    public static RuntimeException exception (String format, Object... args) {
        return new RuntimeException (format (format, args));
    }
    
    public static RuntimeException exception (Throwable cause, String format, Object... args) {
        return new RuntimeException (format (format, args), cause);
    }

    public static int toInt32(String txt) {
        int ret=0;
        try {
            ret = numFormat.parse(txt).intValue();;
        } catch (Exception e) {
            throwInvalid (txt, "int32", e);
        }
        return ret; 
    }
    public static int toInt32(String txt, int def) {
        int ret=0;
        try {
            ret = (txt==null || txt.length()==0) ? def : numFormat.parse(txt).intValue();
        } catch (Exception e) {
            throwInvalid (txt, "int32", e);
        }
        return ret; 
    }

    public static long toInt64(String txt) {
        long ret=0;
        try {
            ret = numFormat.parse(txt).longValue();
        } catch (Exception e) {
            throwInvalid (txt, "int64", e);
        }
        return ret; 
    }
    public static long toInt64(String txt, long def) {
        long ret=0;
        try {
            ret = (txt==null || txt.length()==0) ? def : numFormat.parse(txt).longValue();
        } catch (Exception e) {
            throwInvalid (txt, "int64", e);
        }
        return ret; 
    }
    
    public static float toFloat(String txt) {
        float ret=0;
        try {
            ret = numFormat.parse(txt).floatValue();
        } catch (Exception e) {
            throwInvalid (txt, "float", e);
        }
        return ret; 
    }
    public static float toFloat(String txt, float def) {
        float ret=0;
        try {
            ret = (txt==null || txt.length()==0) ? def : numFormat.parse(txt).floatValue();
        } catch (Exception e) {
            throwInvalid (txt, "float", e);
        }
        return ret; 
    }
     
    public static double toDouble(String txt) {
        double ret=0;
        try {
            ret = numFormat.parse(txt).doubleValue();
        } catch (Exception e) {
            throwInvalid (txt, "double", e);
        }
        return ret; 
    }
    public static double toDouble(String txt, double def) {
        double ret=0;
        try {
            ret = (txt==null || txt.length()==0) ? def : numFormat.parse(txt).doubleValue();;
        } catch (Exception e) {
            throwInvalid (txt, "double", e);
        }
        return ret; 
    }
    
    
    public static int toTimeSpan (String v, int def) {
        return (v==null || v.length()==0) ? def : toTimeSpan(v, TimeUnit.MILLISECONDS);
    }
    public static int toTimeSpan (String v, int def, TimeUnit defUnit) {
        return (v==null || v.length()==0) ? def : toTimeSpan(v, defUnit);
    }

    public static int toTimeSpan (String v) {
        return toTimeSpan (v, TimeUnit.MILLISECONDS);
    }
    public static int toTimeSpan (String v, TimeUnit defUnit) {
        if (v!=null) {
            int N = v.length();
            if (N>0) {
                try {
                    if (v.endsWith("ms")) return Invariant.toInt32(v.substring(0, N-2));
                    int multiplier = 1;
                    switch (v.charAt(v.length()-1)) {
                        case 's': multiplier=1000; break;
                        case 'm': multiplier=60*1000; break;
                        case 'h': multiplier=3600*1000; break;
                        case 'd': multiplier=24*3600*1000; break;
                        default: 
                            multiplier = toMultiplier(defUnit); 
                            N++; //compensate for the N-1
                            break;
                    }
                    return (int)(Invariant.toFloat(v.substring(0, N-1)) * multiplier);
                } catch (Exception e) { }
            }
        }
        throw new RuntimeException ("Invalid timespan [" + v + "]. Should be a number or have 'ms', 's', 'm', 'h', 'd' as suffix.");
    }
    
    private static int toMultiplier(TimeUnit unit) {
        switch (unit) {
            case MILLISECONDS: return 1;
            case SECONDS: return 1000;
            case MINUTES: return 60*1000;
            case HOURS: return 60*60*1000;
            case DAYS: return 24*60*60*1000;

            default: throw new RuntimeException ("Unexpected time unit [" + unit + "]. Should be >= MILLISECONDS.");
        }
    }

    public static boolean toBool(String txt) {
        if (txt != null) {
            String lc = toLower(txt);
            if (lc.equals("true") || lc.equals("1") || lc.equals("-1")) return true;
            if (lc.equals("false") || lc.equals("0")) return false;
        }
        throwInvalid (txt, "bool", null);
        return false; //keep compiler happy 
    }
    public static boolean toBool(String txt, boolean def) {
        return (txt==null || txt.length()==0) ? def : toBool (txt);
    }
    
    public static <T extends Enum<T>> T toEnum (Class<T> cls, String txt) {
        T[] arr = cls.getEnumConstants();
        if (txt != null && txt.length()>0) {
            for (int i=0; i<arr.length; i++) {
                if (txt.equalsIgnoreCase(arr[i].name())) return arr[i];
            }
        }
        throw invalidEnum (cls, txt, arr);
    }

    public static <T extends Enum<T>> T toEnum (Class<T> cls, String txt, T def) {
        if (txt == null || txt.length()==0) return def;

        T[] arr = cls.getEnumConstants();
        for (int i=0; i<arr.length; i++) {
            if (txt.equalsIgnoreCase(arr[i].name())) return arr[i];
        }
        throw invalidEnum (cls, txt, arr);
    }
    
    private static <T extends Enum<T>> RuntimeException invalidEnum (Class<T> cls, String txt, T[] values) {
        StringBuilder sb = new StringBuilder();
        Invariant.format(sb, "Cannot convert [%s] into [%s].\nPossible values are: ", txt, cls.getSimpleName());
        for (int i=0; i<values.length; i++) {
            if (i>0) sb.append(", ");
            sb.append (values[i].name());
        }
        sb.append (".");
        return exception (sb.toString());
    }

    
    private static void throwInvalid (String value, String type, Exception e) {
        StringBuilder sb = new StringBuilder();
        format (sb, "Cannot convert [%s] into [%s]", value, type);
        if (e==null)
            sb.append('.');
        else {
            sb.append(": ");
            sb.append(e.getMessage());
        }
        throw new RuntimeException (sb.toString(), e);
    }
    
    
    
}