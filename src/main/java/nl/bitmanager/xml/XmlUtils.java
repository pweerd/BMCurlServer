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
package nl.bitmanager.xml;

import java.util.concurrent.TimeUnit;

import javax.xml.namespace.QName;
import javax.xml.xpath.XPathConstants;
import javax.xml.xpath.XPathExpression;
import javax.xml.xpath.XPathFactory;

import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import nl.bitmanager.core.Invariant;

public class XmlUtils {
    
    private static final XPathFactory  factory=XPathFactory.newInstance();
    
    public enum TrimFlags {NoTrim, Trim, TrimToNull};
    public static final int EV_TRIM = 1; 
    public static final int EV_DEFAULT_AT_EMPTY = 2; 
    public static final int EV_NULL_AT_EMPTY = 4; 
    
    public static String readStr (Node node, String xpath, String def) {
        return evaluateToStr (node, xpath, def, TrimFlags.TrimToNull);
    }
    public static String readStr (Node node, String xpath) {
        return evaluateToStr (node, xpath, TrimFlags.TrimToNull);
    }
    public static String readStr (Node node, String xpath, String def, TrimFlags trimFlags) {
        return evaluateToStr (node, xpath, def, trimFlags);
    }
    public static String readStr (Node node, String xpath, TrimFlags trimFlags) {
        return evaluateToStr (node, xpath, trimFlags);
    }
    
    public static int readTimeSpan (Node node, String xpath, int def) {
        return Invariant.toTimeSpan(readStr(node, xpath, (String)null), def);
    }
    public static int readTimeSpan (Node node, String xpath, int def, TimeUnit defUnit) {
        return Invariant.toTimeSpan(readStr(node, xpath, (String)null), def, defUnit);
    }
    public static int readTimeSpan (Node node, String xpath) {
        return Invariant.toTimeSpan(readStr(node, xpath));
    }
    public static int readTimeSpan (Node node, String xpath, TimeUnit defUnit) {
        return Invariant.toTimeSpan(readStr(node, xpath), defUnit);
    }

    public static int readInt(Node node, String expr, int def) {
        String txt = evaluateToStr (node, expr, null, TrimFlags.TrimToNull);
        return Invariant.toInt32(txt, def);
    }
    public static int readInt(Node node, String expr) {
        String txt = evaluateToStr (node, expr, TrimFlags.TrimToNull);
        return Invariant.toInt32(txt);
    }
    
    public static boolean readBool (Node node, String expr, boolean def) {
        String txt = evaluateToStr (node, expr, null, TrimFlags.TrimToNull);
        return Invariant.toBool(txt, def);
    }
    public static boolean readBool(Node node, String expr) {
        String txt = evaluateToStr (node, expr, TrimFlags.TrimToNull);
        return Invariant.toBool(txt);
    }

    public static float readFloat(Node node, String expr, float def) {
        String txt = evaluateToStr (node, expr, null, TrimFlags.TrimToNull);
        return Invariant.toFloat(txt, def);
    }
    public static float ReadFloat(Node node, int maxParents, String expr) {
        String txt = evaluateToStr (node, expr, TrimFlags.TrimToNull);
        return Invariant.toFloat(txt);
    }

    public static <T extends Enum<T>> T readEnum (Node node, Class<T> cls, String expr, T def) {
        String txt = evaluateToStr (node, expr, null, TrimFlags.TrimToNull);
        return Invariant.toEnum (cls, txt, def);
    }
    public static <T extends Enum<T>> T readEnum (Node node, Class<T> cls, String expr) {
        String txt = evaluateToStr (node, expr, null, TrimFlags.TrimToNull);
        return Invariant.toEnum (cls, txt);
    }
    
    public static Node selectSingleNode (Node node, String expr) {
        return (Node)evaluate(node, expr, XPathConstants.NODE);
    }
    public static NodeList selectNodes (Node node, String expr) {
        return (NodeList)evaluate(node, expr, XPathConstants.NODESET);
    }
    
    public static Node selectMandatoryNode (Node node, String expr) {
        Node ret = (Node)evaluate(node, expr, XPathConstants.NODE);
        if (ret==null) throwMissingNodes(expr);
        return ret;
    }
    public static NodeList selectMandatoryNodes (Node node, String expr) {
        NodeList ret = (NodeList)evaluate(node, expr, XPathConstants.NODESET);
        if (ret==null || ret.getLength()==0) throwMissingNodes(expr);
        return ret;
    }



    
    private static XPathExpression createXPath (String xpathExpr) throws Exception {
        return factory.newXPath().compile(xpathExpr);
    }
    
    private static Object evaluate (Node node, String expr, QName what) {
        try {
            if (expr==null || expr.length()==0) return node;
            return createXPath(expr).evaluate(node, what);
        } catch (Exception e) {
            throw new XmlException (e, "Cannot evaluate XPath expression: [%s]\nExpr=[%s]", e.getMessage(), expr);
        }
    }
    
    private static String evaluateToStr (Node node, String expr, String def, TrimFlags tflags) {
        Node x = (Node)evaluate (node, expr, XPathConstants.NODE);
        if (x==null) return def;
        String txt = x.getTextContent();
        if (txt != null) {
            switch (tflags) {
                case Trim: txt = txt.trim(); break;
                case TrimToNull:
                    txt = txt.trim();
                    if (txt.length()==0) txt = null;
                    break;
            }
        }
        return txt==null ? def : txt;
    }

    private static String evaluateToStr (Node node, String expr, TrimFlags tflags) {
        Node x = (Node)evaluate (node, expr, XPathConstants.NODE);
        if (x==null) throwMissing(expr);

        String txt = x.getTextContent();
        if (txt != null) {
            switch (tflags) {
                case Trim: txt = txt.trim(); break;
                case TrimToNull:
                    txt = txt.trim();
                    if (txt.length()==0) txt = null;
                    break;
            }
        }
        if (txt==null) throwMissing (expr);
        return txt;
    }
    
    private static void throwMissing(String xpath) {
        throw new XmlException ("Missing value for xpath [%s]", xpath);
    }
    private static void throwMissingNodes(String xpath) {
        throw new XmlException ("XPath expression [%s] did not return nodes", xpath);
    }
}
