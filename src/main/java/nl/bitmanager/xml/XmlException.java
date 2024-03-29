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

import nl.bitmanager.core.Invariant;

/** 
 * Specific Exception for XML related errors.
 */
public class XmlException extends RuntimeException {
    private static final long serialVersionUID = -5270380327159143905L;

    public XmlException(String msg) {
        super(msg);
    }

    public XmlException(String format, Object... args) {
        super(Invariant.format(format, args));
    }

    public XmlException(Throwable inner, String format, Object... args) {
        super (Invariant.format(format, args), inner);
    }

    public XmlException(Throwable inner) {
        super(inner.getMessage(), inner);
    }
}
